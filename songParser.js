const fs = require("fs");
async function getData() {
  const req = await fetch(
    "https://www.nporadio5.nl/api/charts/evergreen-top-1000-van-2023-11-20",
    {
      cache: "default",
      credentials: "include",
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        "sentry-trace": "829431b98b67413ca012301420eb0e1e-84d23efa7d6cfc38-0",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      method: "GET",
      mode: "cors",
      redirect: "follow",
      referrer: "https://www.nporadio4.nl/thema/klassieke-top-400-lijst",
      referrerPolicy: "strict-origin-when-cross-origin",
    }
  );
  var data = await req.json();
  var out = {
    chartDate: data.chartDate,
    isActive: data.editionIsActive,
    positions: [],
    hours: [],
  };
  var currentHour;
  var hourCounter = 1;
  data.positions.reverse().forEach((position) => {
    if (position.broadcastTime !== currentHour)
      out.hours.push({
        day: parseInt(position.broadcastTime.split(" ")[1]),
        hour: parseInt(position.broadcastTime.split(" ")[4].split(":")[0]),
        start_id: position.position.current,
        hourOftotal: hourCounter++,
      });
    currentHour = position.broadcastTime;
    out.positions.push({
      edition: "2023",
      id: position.position.current,
      previous: position.position.previous,
      broadcastUnixTime: position.broadcastUnixTime,
      title: position.track.title,
      artist: position.track.artist,
    });
  });
  return out;
}

getData().then((out) => {
  if (!fs.existsSync("./evergreen/" + new Date().getFullYear())) {
    fs.mkdirSync("./evergreen/" + new Date().getFullYear());
  }
  fs.writeFileSync(
    "./evergreen/" + new Date().getFullYear() + "/hours.json",
    JSON.stringify(out.hours)
  );
  fs.writeFileSync(
    "./evergreen/" + new Date().getFullYear() + "/songs.json",
    JSON.stringify(out.positions)
  );
});
