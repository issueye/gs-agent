import { BOLD, RESET, color, padRight, truncateToWidth } from "@/tui/ansi";

let SPINNER = ["-", "\\", "|", "/"];

export function loadingFrame(tick) {
  let index = tick % SPINNER.length;
  return SPINNER[index];
}

export function loadingText(options) {
  let tick = options.tick;
  let label = options.label;
  let active = options.active;
  let width = options.width;

  if (!label) {
    label = "working";
  }
  if (!width) {
    width = 24;
  }

  let text = "";
  if (active) {
    text = color(loadingFrame(tick), "warning") + " " + label;
  } else {
    text = color("ok", "success") + " " + label;
  }

  return padRight(truncateToWidth(text, width), width);
}

export function compactLoading(active, tick, label) {
  if (active) {
    return BOLD + loadingFrame(tick) + RESET + " " + label;
  }
  return "ok " + label;
}
