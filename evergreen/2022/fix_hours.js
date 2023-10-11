const fs = require("fs");
var hoursUnpruned = JSON.parse(fs.readFileSync("hours_unpruned.json"));
var hours = [];
hoursUnpruned.forEach((hour) => {
  (hour = {
    start_id: hour.start_id,
    day: hour.day,
    hour: hour.hour + 5,
    hourOfTotal: 1,
  }),
    hours.push(hour);
});
fs.writeFileSync("hours.json", JSON.stringify(hours));
