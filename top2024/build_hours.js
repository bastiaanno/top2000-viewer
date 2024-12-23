const fs = require("fs");
const songsUnpruned = JSON.parse(fs.readFileSync("songs-unpruned.json"));
const hours = [];
let dateHour = null;
let i = 0;
let hour = null;

songsUnpruned.positions.reverse().forEach((position) => {
  const date = new Date(position.broadcastUnixTime);
  const currentHour = date.getHours();

  if (currentHour !== dateHour) {
    if (hour) {
      hours.push(hour);
    }
    dateHour = currentHour;
    i++;
    hour = {
      day: date.getDate(),
      hour: currentHour,
      start_id: position.position.current,
      hourOfTotal: i,
    };
  }
});

// Push the last hour object
if (hour) {
  hours.push(hour);
}

fs.writeFileSync("hours.json", JSON.stringify(hours, null, 2));
