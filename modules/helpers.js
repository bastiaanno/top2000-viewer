import { config, hours, io, presenters, songs } from "../index.js";
function songAt(id) {
  return songs.positions[id - 1];
}
function removeParentheses(text) {
  return text.replace(/\)[^)]*\)/, "");
}
function getHourCount(date, hour) {
  return hours.findIndex((item) => item.day == date && item.hour == hour);
}
// given an hour of the day (0-23), figures out which DJ is presenting then
function presenterInHour(hour) {
  console.log("Finding presenter for hour", hour);
  for (let i = presenters.length - 1; i >= 0; i--) {
    let presenter = presenters[i];
    if (hour >= presenter["hour"]) {
      return presenter["name"];
    }
  }
  return "(DJ onbekend)";
}

// given an (1-based) song ID, check if this is the last song of an hour
function isLastSongInHour(id) {
  for (let i = 0; i < hours.length; i++) {
    return id === hours[i]["start_id"] + 1 ? true : false;
  }
}
function findHour(date, hour) {
  for (var i = 0; i < hours.length; i++) {
    if (hours[i].day === date && hours[i].hour === hour) {
      return i;
    }
  }
  return -2;
}
function isLive(month, date, hour) {
  return (
    config.testMode ||
    (month === 12 && date >= 25) ||
    (config.evergreen &&
      month === 11 &&
      date >= 20 &&
      24 >= date &&
      hour >= 6 &&
      hour <= 20)
  );
}
function showHourOverview() {
  console.log("showing hour overview");
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
      date >= 20 &&
      24 >= date &&
      hour >= 6 &&
      20 >= hour)
  ) {
    console.log("We are live!");
    var songsInHour = [];
    var topHour = findHour(date, hour);
    var hourStart = hours.at(topHour).start_id - 1;
    var hourEnd = hours.at(topHour + 1).start_id - 1;
    console.log(hourStart, hourEnd);
    for (var i = hourStart; i > hourEnd; i--) {
      var song = songs.positions[i];
      song["id"] = i + 1;
      songsInHour.push(song);
    }
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
function getFilePath() {
  if (!config.evergreen && !config.top2000) throw "No edition type specified!";
  return (
    (config.evergreen ? "evergreen" : "" + config.top2000 ? "top" : "") +
    +config.editionYear +
    "/"
  );
}
export {
  songAt,
  removeParentheses,
  getHourCount,
  presenterInHour,
  isLastSongInHour,
  findHour,
  isLive,
  showHourOverview,
  getFilePath,
};
