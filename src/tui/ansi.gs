// ANSI 小工具集中放在这里，避免界面代码里到处散落转义序列。
let stdText = require("@std/text");

export let ESC = "\x1b";
export let RESET = "\x1b[0m";
export let BOLD = "\x1b[1m";
export let DIM = "\x1b[2m";
export let INVERSE = "\x1b[7m";
export let UNDERLINE = "\x1b[4m";

let colorsEnabled = true;

export let Color = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
};

export let Theme = {
  accent: "cyan",
  muted: "gray",
  success: "green",
  warning: "yellow",
  error: "red",
  info: "blue",
  text: "white",
  border: "gray",
  focus: "brightCyan",
};

export function setColorEnabled(enabled) {
  colorsEnabled = !!enabled;
}

export function isColorEnabled() {
  return colorsEnabled;
}

export function fg(color) {
  if (!colorsEnabled) {
    return "";
  }
  return "\x1b[" + String(color) + "m";
}

export function colorCode(nameOrCode) {
  if (typeof nameOrCode === "number") {
    return nameOrCode;
  }
  let name = String(nameOrCode || "");
  if (name in Theme) {
    name = Theme[name];
  }
  if (name in Color) {
    return Color[name];
  }
  return Color.white;
}

export function color(text, nameOrCode) {
  if (!colorsEnabled) {
    return String(text);
  }
  return fg(colorCode(nameOrCode)) + String(text) + RESET;
}

export function styleText(text, styles) {
  if (!colorsEnabled) {
    return String(text);
  }
  let codes = "";
  if (!styles) {
    return String(text);
  }
  if (styles.bold) {
    codes = codes + BOLD;
  }
  if (styles.dim) {
    codes = codes + DIM;
  }
  if (styles.inverse) {
    codes = codes + INVERSE;
  }
  if (styles.underline) {
    codes = codes + UNDERLINE;
  }
  if (styles.fg) {
    codes = codes + fg(colorCode(styles.fg));
  }
  if (codes === "") {
    return String(text);
  }
  return codes + String(text) + RESET;
}

export function clearScreen() {
  return "\x1b[2J\x1b[H";
}

export function clearLine() {
  return "\x1b[2K";
}

export function enterAlternateScreen() {
  return "\x1b[?1049h";
}

export function leaveAlternateScreen() {
  return "\x1b[?1049l";
}

export function moveTo(row, col) {
  return "\x1b[" + String(row) + ";" + String(col) + "H";
}

export function hideCursor() {
  return "\x1b[?25l";
}

export function showCursor() {
  return "\x1b[?25h";
}

export function enableMouse() {
  return "\x1b[?1000h\x1b[?1002h\x1b[?1006h";
}

export function enableMouseWheel() {
  return "\x1b[?1000h\x1b[?1006h";
}

export function disableMouse() {
  return "\x1b[?1006l\x1b[?1002l\x1b[?1000l";
}

export function style(text, code) {
  if (!colorsEnabled) {
    return String(text);
  }
  return code + text + RESET;
}

export function repeatText(text, count) {
  let out = "";
  for (let i = 0; i < count; i = i + 1) {
    out = out + text;
  }
  return out;
}

// 第一版只去掉常见 CSI 序列，后续可扩展 OSC/APC。
export function stripAnsi(text) {
  return stdText.stripAnsi(text);
}

export function charWidth(ch) {
  return stdText.width(ch);
}

export function chars(text) {
  return stdText.chars(text);
}

export function visibleWidth(text) {
  return stdText.width(text);
}

export function truncateToWidth(text, width) {
  let source = String(text);
  let out = "";
  let used = 0;
  let i = 0;
  while (i < source.length) {
    let rest = source.slice(i);
    if (rest.startsWith(ESC + "[")) {
      let end = rest.indexOf("m");
      if (end >= 0) {
        out = out + rest.slice(0, end + 1);
        i = i + end + 1;
        continue;
      }
    }

    let ch = stdText.chars(rest)[0];
    let next = stdText.width(ch);
    if (used + next > width) {
      break;
    }
    out = out + ch;
    used = used + next;
    i = i + ch.length;
  }
  return out;
}

export function padRight(text, width) {
  let clean = truncateToWidth(text, width);
  let spaces = width - visibleWidth(clean);
  if (spaces < 0) {
    spaces = 0;
  }
  return clean + repeatText(" ", spaces);
}

export function line(text, width) {
  return padRight(text, width);
}
