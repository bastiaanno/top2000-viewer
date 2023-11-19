/* UPDATED BY BASTIAANNO */
var fs = require("fs");
const pm2 = require("@pm2/io");
const websocketConnections = pm2.counter({
  name: "Websocket Connections",
  id: "app/websocket/connections",
});
var express = require("express");
var app = express();
var certs = {
  key: fs.readFileSync("Top2000-key.pem"),
  cert: fs.readFileSync("Top2000.pem"),
  ca: fs.readFileSync("Top2000-chain.pem"),
};
var https = require("https").Server(certs, app);
//var http = require("http").Server(app);
var io = require("socket.io")(https);

var schedule = require("node-schedule");

const levenshtein = require("js-levenshtein");

var twilio = require("twilio");
const accountSid = "ACCOUNT_SID";
const authToken = "AUTH_TOKEN";
const twilioClient = twilio(accountSid, authToken);

var config = JSON.parse(fs.readFileSync("config.json"));
var filePath;
if (config.evergreen) {
  filePath = "evergreen" + "/" + config.editionYear + "/";
} else if (config.top2000) {
  filePath = "top" + config.editionYear + "/";
} else {
  throw "No edition type specified!";
}

var songs = JSON.parse(fs.readFileSync(filePath + "songs.json"));
var hours = JSON.parse(fs.readFileSync(filePath + "hours.json"));
var votes = JSON.parse(fs.readFileSync(filePath + "votes.json"));
var presenters = JSON.parse(fs.readFileSync(filePath + "presenters.json"));

if (config.evergreen) maxSongsNum = 1000;
if (config.top2000) maxSongsNum = 2000;

for (var i = 0; i < maxSongsNum; i++) {
  if (config.testMode) {
    songs[i].voters = ["te"];
  } else {
    songs[i].voters = [];
  }
}

for (var i = 0; i < votes.length; i++) {
  for (var j = 0; j < votes[i].votes.length; j++) {
    songs[votes[i].votes[j] - 1].voters.push(votes[i].abbreviation);
  }
}

var lastRequestTime = 0;

var currentSong = {
  title: "...",
  artist: "...",
  startTime: 0,
  stopTime: 0,
};
var previousSong = {
  title: "",
  artist: "",
  startTime: 0,
  stopTime: 0,
};
var nextSong = {
  title: "",
  artist: "",
  startTime: 0,
  stopTime: 0,
};

var previousTitle = "";
var previousArtist = "";

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/layout.css", function (req, res) {
  if (config.evergreen) {
    res.sendFile(__dirname + "/evergreen.css");
  } else {
    res.sendFile(__dirname + "/layout.css");
  }
});

app.get("/client.js", function (req, res) {
  res.sendFile(__dirname + "/client.js");
});
app.get("/favicon.ico", function (req, res) {
  res.sendFile(__dirname + "/favicon.ico");
});
app.get("/apple-touch-icon.png", function (req, res) {
  res.sendFile(__dirname + "/apple-touch-icon.png");
});

app.use(express.static("public"));

io.on("connection", function (socket) {
  var address = socket.handshake.address;
  console.log(
    "New socket connection established with user agent " +
      socket.request.headers["user-agent"]
  );
  websocketConnections.inc();
  console.log("sending song");
  socket.emit("new song", {
    currentSong: currentSong,
    previousSong: previousSong,
    nextSong: nextSong,
  });
  io.on("disconnect", () => {
    websocketConnections.dec();
  });
  if (config.testMode) {
    console.log("test mode enabled, showing hour overview");
    setTimeout(showHourOverview, 5000);
  }
});

https.listen(config.ports.https);

getData();
setInterval(getData, 1000);

function getData() {
  if (config.hideShadow) {
    io.emit("hideShadow", true);
  }
  // if the song is still playing, we don't need to do anything
  var date = new Date();
  var now = date.getTime();
  console.log(
    "current time = " + now + ", song ending at = " + currentSong.stopTime
  );
  if (now < currentSong.stopTime + 3000) {
    // three seconds slack
    return;
  }

  // okay, song finished... if Top 2000 is in progress, just assume next song has started
  if (currentSong.id && currentSong.id != "...") {
    // don't do this if this is the last song of the hour, because then
    // we'll get the news first
    // (except if the minute is >= 2, because then the news has ended)

    if (
      !isLastSongInHour(currentSong.id) ||
      (date.getMinutes() >= 2 && date.getMinutes() < 30)
    ) {
      // note that currentSong.id is 1-based
      if (currentSong.id >= 2) {
        io.emit("new song", {
          currentSong: songAt(currentSong.id - 1),
          previousSong: songAt(currentSong.id),
          nextSong: songAt(currentSong.id - 2),
        });
      } else if (currentSong.id === 2) {
        io.emit("new song", {
          currentSong: songAt(currentSong.id - 1),
          previousSong: songAt(currentSong.id),
        });
      }
    }
  }

  // do request

  // but don't bother the server too often
  if (now < lastRequestTime + 5000) {
    return;
  }
  lastRequestTime = now;

  if (config.evergreen) var host = "www.nporadio5.nl";
  if (config.top2000) var host = "www.nporadio2.nl";
  var options = {
    host: host,
    port: 443,
    path: "/api/tracks",
  };
  console.log("Requesting from https://" + host + options.path + "/");
  require("https")
    .get(options, function (response) {
      response.setEncoding("utf8");
      var data = "";
      response.on("data", function (chunk) {
        data += chunk;
      });
      response.on("end", function () {
        handleResponse(data);
      });
    })
    .on("error", function (e) {
      console.log("requested current song, but got error: " + e.message);
      io.emit("error", e.message);
    });
}

function handleResponse(data) {
  console.log("SUCCESS: got response for currently playing song");
  try {
    var json = JSON.parse(data);
  } catch (e) {
    console.log("Error while parsing JSON: " + e.message);
    console.log("    in JSON string: " + data);
    io.emit("error", "Returned JSON was invalid: " + e.message);
    // ...
    return;
  }
  var newArtist = json["data"][0]["artist"];
  var originalNewTitle = json["data"][0]["title"];
  var newTitle = typeof originalNewTitle.substring(
    isNaN(originalNewTitle.charAt(1))
  )
    ? originalNewTitle
    : originalNewTitle.substring(originalNewTitle.indexOf(" ") + 1);
  console.log("current song: " + newArtist + " - " + newTitle);

  if (previousArtist !== newArtist || previousTitle !== newTitle) {
    previousArtist = newArtist;
    previousTitle = newTitle;

    console.log("this is indeed a new song!");

    previousSong = currentSong;
    var d = new Date();
    d.setTime(d.getTime() - config.tz * 60 * 60 * 1000);
    var date = d.getDate();
    var hour = d.getHours();
    var month = d.getMonth() + 1;
    if (
      config.testMode ||
      (month === 12 && date >= 25) ||
      (config.evergreen &&
        month === 11 &&
        date >= 14 &&
        18 >= date &&
        hour >= 6 &&
        hour <= 20)
    ) {
      console.log("We are live!");
      if (!config.testMode) {
        if (findHour(date, hour) > 0) {
          var hourStart = hours[findHour(date, hour)].start_id - 1;
          if (hours[findHour(date, hour) + 1] != undefined) {
            var hourEnd = hours[findHour(date, hour) + 1].start_id - 1;
          } else {
            var hourEnd = 1;
          }
          if (config.evergreen) var searchFrom = Math.min(1000);
          if (config.top2000) var searchFrom = Math.min(2000);
          var searchTo = Math.max(hourEnd - 5, 1);
        }
      } else {
        if (config.evergreen) var searchFrom = Math.min(1000);
        if (config.top2000) var searchFrom = Math.min(2000);
        var searchTo = 1;
      }

      var closestMatch = -1;
      var closestLevenshtein = 10000000;

      for (var i = searchFrom; i >= searchTo; i--) {
        var l = levenshtein(newArtist, songs[i - 1].artist);
        l += levenshtein(
          removeParentheses(newTitle),
          removeParentheses(songs[i - 1].title)
        );
        if (l < closestLevenshtein) {
          closestMatch = i;
          closestLevenshtein = l;
        }
        if (l === 0) {
          break;
        }
      }

      if (closestLevenshtein > 25) {
        console.log(json["data"][0]);
        currentSong = {
          title: newTitle,
          artist: newArtist,
          id: "...",
          startTime: Date.parse(json["data"][0]["startdatetime"]),
          stopTime: Date.parse(json["data"][0]["enddatetime"]),
        };
        nextSong = null;
      } else {
        currentSong = songAt(closestMatch);
        if (config.evergreen) var matchFrom = 1000;
        if (config.top2000) var matchFrom = 1000;
        if (closestMatch < matchFrom) {
          previousSong = songAt(closestMatch + 1);
        }
        if (closestMatch > 1) {
          nextSong = songAt(closestMatch - 1);
        } else {
          nextSong = null;
        }
      }
      io.emit(
        "editionSlogan",
        config.evergreen ? config.slogans.radio5 : config.slogans.radio2
      );
    } else {
      currentSong = {
        // 'id': '...',
        title: newTitle,
        artist: newArtist,
      };
      nextSong = null;
    }
    currentSong["startTime"] = Date.parse(json["data"][0]["startdatetime"]);
    currentSong["stopTime"] = Date.parse(json["data"][0]["enddatetime"]);
    console.log("Informing websocket subscribers");
    io.emit("new song", {
      currentSong: currentSong,
      previousSong: previousSong,
      nextSong: nextSong,
    });
    if (typeof (nextSong !== "undefined") && nextSong !== null) {
      if (
        typeof nextSong.voters !== "undefined" &&
        nextSong.voters.length > 0
      ) {
        nextSong.voters.forEach((voter) => {
          if (
            typeof votes.find((x) => x.abbreviation == voter) !== "undefined"
          ) {
            voterName = votes.find((x) => x.abbreviation == voter).name;
            voterPhoneNumber = votes.find((x) => x.abbreviation == voter).phone;
            whatsappEnabled = votes.find(
              (x) => x.abbreviation == voter
            ).whatsappEnabled;
            //if (whatsappEnabled) {
            //    twilioClient.messages
            //        .create({
            //            body: voterName + ",\nhet volgende liedje in de top2000 is een liedje waar je op hebt gestemd:\n" +
            //                nextSong.title + " - " + nextSong.artist + "\nop plaats //" + nextSong.id,
            //            from: 'whatsapp:+14155238886',
            //            to: 'whatsapp:' + voterPhoneNumber
            //        })
            //        .then(message => console.log(message.sid))
            //        .done();
            //    console.log("sending whatsapp message to " + voterName);
            //}
          } else {
            console.log("voter '" + voter + "' not found");
          }
        });
      }
    }
  }
}

function songAt(id) {
  return songs[id - 1];
}

function findHour(date, hour) {
  for (var i = 0; i < hours.length; i++) {
    if (hours[i].day === date && hours[i].hour === hour) {
      return i;
    }
  }
  return -1;
}

var everyHour = new schedule.RecurrenceRule();
everyHour.minute = 0;
var j = schedule.scheduleJob(everyHour, showHourOverview);

function showHourOverview() {
  console.log("showing hour overview");

  var d = new Date();
  d.setTime(d.getTime() - config.tz * 60 * 60 * 1000);
  var date = d.getDate();
  var hour = d.getHours();
  var month = d.getMonth() + 1;
  if (config.testMode) {
    date = config.evergreen ? 20 : 25;
    hour = config.evergreen ? 8 : 0;
  }
  if (
    config.testMode ||
    (month === 12 && date >= 25) ||
    (config.evergreen &&
      month === 11 &&
      date >= 20 &&
      24 >= date &&
      hour >= 6 &&
      20 >= hour)
  ) {
    console.log("We are live!");
    var songsInHour = [];
    console.log(date, hour);
    var topHour = findHour(date, hour);
    var hourStart = hours[topHour].start_id - 1;
    var hourEnd = hours[topHour + 1].start_id - 1;

    for (var i = hourStart; i > hourEnd; i--) {
      var song = songs[i];
      song["id"] = i + 1;
      songsInHour.push(song);
    }
    //console.log(songsInHour);

    var presenter = presenterInHour(hour);
    io.emit("hour overview", {
      date: date,
      hour: hour,
      hourCount: getHourCount(date, hour),
      songs: songsInHour,
      presenter: presenter,
      hoursTotal: config.evergreen
        ? config.hours.evergreen
        : config.hours.top2000,
    });
    io.emit("editionInfo", config.evergreen ? "Evergreen top 1000" : "Top2000");
  }
}

var everyMinute = new schedule.RecurrenceRule();
var j = schedule.scheduleJob(everyHour, function () {
  console.log("time update");
  var d = new Date();
  d.setTime(d.getTime() - config.tz * 60 * 60 * 1000);
  io.emit("time", {
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  });
});

function getHourCount(date, hour) {
  return 24 * (date - 25) + hour;
}

// given an hour of the day (0-23), figures out which DJ is presenting then
function presenterInHour(hour) {
  for (let i = presenters.length - 1; i >= 0; i--) {
    let presenter = presenters[i];
    if (hour >= presenter["hour"]) {
      return presenter["name"];
    }
  }
  return "(DJ onbekend)";
}

function removeParentheses(text) {
  return text.replace(/\)[^)]*\)/, "");
}

// given an (1-based) song ID, check if this is the last song of an hour
function isLastSongInHour(id) {
  for (let i = 0; i < hours.length; i++) {
    if (id === hours[i]["start_id"] + 1) {
      return true;
    }
  }
  return false;
}
