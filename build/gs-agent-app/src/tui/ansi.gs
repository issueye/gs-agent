// ANSI 小工具集中放在这里，避免界面代码里到处散落转义序列。
export let ESC = "\x1b";
export let RESET = "\x1b[0m";
export let BOLD = "\x1b[1m";
export let DIM = "\x1b[2m";
export let INVERSE = "\x1b[7m";

export function fg(color) {
  return "\x1b[" + String(color) + "m";
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

export function style(text, code) {
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
  return String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

export function charWidth(ch) {
  if (!ch) {
    return 0;
  }

  let code = ch.codePointAt(0);
  if (code === 0) {
    return 0;
  }

  // CJK、全角标点和常见 emoji 在终端里通常占两列。
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff)
  ) {
    return 2;
  }

  return 1;
}

export function chars(text) {
  return Array.from(String(text));
}

export function visibleWidth(text) {
  let clean = chars(stripAnsi(text));
  let width = 0;
  for (let ch of clean) {
    width = width + charWidth(ch);
  }
  return width;
}

export function truncateToWidth(text, width) {
  let clean = chars(stripAnsi(text));
  let out = "";
  let used = 0;
  for (let ch of clean) {
    let next = charWidth(ch);
    if (used + next > width) {
      break;
    }
    out = out + ch;
    used = used + next;
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
