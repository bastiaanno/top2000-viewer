/* UPDATED BY BASTIAANNO */
import fs from "fs";
import pm2 from "@pm2/io";
const websocketConnections = pm2.counter({
  name: "Websocket Connections",
  id: "app/websocket/connections",
});
import express from "express";
var app = express();
var certs = {
  key: fs.readFileSync("Top2000-key.pem"),
  cert: fs.readFileSync("Top2000.pem"),
  ca: fs.readFileSync("Top2000-chain.pem"),
};
import https from "https";

var httpsServer = https.Server(certs, app);
//var http = require("http").Server(app);
import * as socket_io from "socket.io";
var io = new socket_io.Server(httpsServer);

import schedule from "node-schedule";

import levenshtein from "js-levenshtein";
import {
  songAt,
  removeParentheses,
  isLastSongInHour,
  findHour,
  isLive,
  showHourOverview,
  getFilePath,
} from "./modules/helpers.js";

//SET UP __dirname

import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

var config = JSON.parse(fs.readFileSync("config.json"));
var filePath = getFilePath();
var songs = JSON.parse(fs.readFileSync(filePath + "songs.json"));
var hours = JSON.parse(fs.readFileSync(filePath + "hours.json"));
var votes = JSON.parse(fs.readFileSync(filePath + "votes.json"));
var presenters = JSON.parse(fs.readFileSync(filePath + "presenters.json"));
var maxSongsNum;
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

httpsServer.listen(config.ports.https);

getData();
setInterval(getData, config.polling.interval);

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
  https
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
  var newTitle = isNaN(originalNewTitle.charAt(1))
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
    if (isLive(month, date, hour)) {
      console.log("We are live!");
      if (!config.testMode) {
        if (findHour(date, hour) > 0) {
          var hourStart = hours[findHour(date, hour)].start_id - 1;
          if (hours[findHour(date, hour) + 1] != undefined) {
            var hourEnd = hours[findHour(date, hour) + 1].start_id - 1;
          } else {
            var hourEnd = 1;
          }
          var searchFrom = Math.min(
            config.evergreen ? 1000 : 2000,
            hourStart + 5
          );
          var searchTo = Math.max(hourEnd - 5, 1);
        }
      } else {
        var searchFrom = config.evergreen ? 1000 : 2000;
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
        if (config.top2000) var matchFrom = 2000;
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
          } else {
            console.log("voter '" + voter + "' not found");
          }
        });
      }
    }
  }
}

var everyHour = new schedule.RecurrenceRule();
everyHour.minute = 0;
var j = schedule.scheduleJob(everyHour, showHourOverview);

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

export { config, hours, songs, presenters, io };
