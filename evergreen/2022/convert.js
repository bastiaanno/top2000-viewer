const fs = require("fs");
var songsUnpruned = JSON.parse(fs.readFileSync("songs-unpruned.json"));
var positions = [];
songsUnpruned.data.cms_chart_editions.data[0].positions.forEach((song) => {
  position = {
    edition: "2022",
    id: parseInt(song.position),
    title: song.title,
    artist: song.artist,
    year: song.year,
    previous: parseInt(song.last_position),
  };
  positions.push(position);
});
fs.writeFileSync("songs.json", JSON.stringify(positions));
