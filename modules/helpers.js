import fs from "fs";
import { config } from "../index.js";
function songAt(id) {
  return songs[id - 1];
}
function removeParentheses(text) {
  return text.replace(/\)[^)]*\)/, "");
}
function getHourCount(date, hour) {
  return (
    (config.evergreen ? 14 : 24) * (date + 1 - (config.evergreen ? 20 : 25)) +
    hour
  );
}
export { songAt, removeParentheses, getHourCount };
