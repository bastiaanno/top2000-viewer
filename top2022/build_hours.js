const fs = require("fs");
var songsUnpruned = JSON.parse(fs.readFileSync("songs-unpruned.json"));
var hours = [];
var date;
var dateHour;
var i = 1;
var hour;
songsUnpruned.positions.forEach((position) => {
  date = new Date(position.broadcastUnixTime);
  console.log(dateHour, date.getHours());
  if (date.getHours() == dateHour) {
    console.log("skip");
    hour = {
      day: parseInt(date.getDate()),
      hour: parseInt(dateHour),
      start_id: parseInt(position.position.current),
      hourOfTotal: i,
    };
  } else {
    dateHour = date.getHours();
    i++;
    hours.push(hour);
  }
});
fs.writeFileSync("hours.json", JSON.stringify(hours));
