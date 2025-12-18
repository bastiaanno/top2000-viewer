import fs from "fs";
var songsUnpruned = JSON.parse(fs.readFileSync("songs-unpruned.json"));
var positions = [];
songsUnpruned.positions.forEach((song) => {
  var position = {
    edition: "2025",
    id: parseInt(song.position.current),
    title: song.track.title,
    artist: song.track.artist,
    year: song.year,
    previous: parseInt(song.position.previous),
    broadCastUnixTime: song.broadcastUnixTime,
    coverUrl: song.coverUrl,
    detailUrl: song.detailUrl,
    historyUrl: song.historyUrl,
  };
  positions.push(position);
});
fs.writeFileSync("songs.json", JSON.stringify(positions));
