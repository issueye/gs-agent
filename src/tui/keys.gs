let PASTE_START = "\x1b[200~";
let PASTE_END = "\x1b[201~";

function key(id, text) {
  return {
    id: id,
    text: text,
  };
}

function mouse(button, col, row, final) {
  let id = "mouse";
  let action = "down";
  if (final === "m") {
    action = "up";
  }
  if (button === 64) {
    action = "wheelUp";
  } else if (button === 65) {
    action = "wheelDown";
  }
  return {
    id: id,
    text: "",
    action: action,
    button: button,
    col: col,
    row: row,
  };
}

function pushPrintable(keys, text) {
  for (let ch of String(text)) {
    if (ch >= " " && ch !== "\x7f") {
      keys.push(key("text", ch));
    }
  }
}

// 第一版按键解析覆盖 agent TUI 必需的快捷键，复杂协议后续再补。
export function parseKeys(data) {
  let keys = [];
  if (!data) {
    return keys;
  }

  if (data.startsWith(PASTE_START) && data.endsWith(PASTE_END)) {
    keys.push(key("paste", data.slice(PASTE_START.length, data.length - PASTE_END.length)));
    return keys;
  }

  let i = 0;
  while (i < data.length) {
    let rest = data.slice(i);

    if (rest.startsWith("\x1b[<")) {
      let finalM = rest.indexOf("M");
      let finalm = rest.indexOf("m");
      let finalIndex = finalM;
      let final = "M";
      if (finalIndex < 0 || (finalm >= 0 && finalm < finalIndex)) {
        finalIndex = finalm;
        final = "m";
      }
      if (finalIndex >= 0) {
        let body = rest.slice(3, finalIndex);
        let parts = body.split(";");
        if (parts.length === 3) {
          keys.push(mouse(Number(parts[0]), Number(parts[1]), Number(parts[2]), final));
          i = i + finalIndex + 1;
          continue;
        }
      }
    }

    if (rest.startsWith("\x1b[A")) {
      keys.push(key("up", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[B")) {
      keys.push(key("down", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[C")) {
      keys.push(key("right", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[D")) {
      keys.push(key("left", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[5~")) {
      keys.push(key("pageUp", ""));
      i = i + 4;
    } else if (rest.startsWith("\x1b[6~")) {
      keys.push(key("pageDown", ""));
      i = i + 4;
    } else if (rest.startsWith("\x1b[Z")) {
      keys.push(key("shift+tab", ""));
      i = i + 3;
    } else {
      let ch = Array.from(data.slice(i))[0];
      if (ch === "\x03") {
        keys.push(key("ctrl+c", ""));
      } else if (ch === "\x11") {
        keys.push(key("ctrl+q", ""));
      } else if (ch === "\x12") {
        keys.push(key("ctrl+r", ""));
      } else if (ch === "\x13") {
        keys.push(key("ctrl+s", ""));
      } else if (ch === "\x0f") {
        keys.push(key("ctrl+o", ""));
      } else if (ch === "\t") {
        keys.push(key("tab", ""));
      } else if (ch === "\r" || ch === "\n") {
        keys.push(key("enter", ""));
      } else if (ch === "\x7f" || ch === "\b") {
        keys.push(key("backspace", ""));
      } else if (ch === "\x1b") {
        keys.push(key("escape", ""));
      } else {
        pushPrintable(keys, ch);
      }
      i = i + ch.length;
    }
  }

  return keys;
}
