import { charWidth, chars, color, line, repeatText, styleText } from "@/tui/ansi";

export function splitLines(text) {
  return String(text || "").replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

export function takeLine(lines, index) {
  if (index < 0 || index >= lines.length) {
    return "";
  }
  return lines[index];
}

export function border(width, char) {
  if (!char) {
    char = "-";
  }
  return repeatText(char, width);
}

export function clampScroll(value, max) {
  if (value < 0) {
    return 0;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function wrapTextLine(text, width) {
  if (width < 1) {
    return [""];
  }

  let list = chars(text);
  let rows = [];
  let current = "";
  let used = 0;

  for (let ch of list) {
    let next = charWidth(ch);
    if (used > 0 && used + next > width) {
      rows.push(current);
      current = "";
      used = 0;
    }
    current = current + ch;
    used = used + next;
  }

  rows.push(current);
  return rows;
}

export function wrapText(text, width) {
  let source = splitLines(text);
  let out = [];
  for (let row of source) {
    let wrapped = wrapTextLine(row, width);
    for (let item of wrapped) {
      out.push(item);
    }
  }
  if (out.length === 0) {
    out.push("");
  }
  return out;
}

export function viewportLines(lines, offset, height) {
  let out = [];
  for (let i = 0; i < height; i = i + 1) {
    out.push(takeLine(lines, offset + i));
  }
  return out;
}

export function renderLines(lines, width, height) {
  let out = [];
  for (let i = 0; i < height; i = i + 1) {
    out.push(line(takeLine(lines, i), width));
  }
  return out;
}

export function joinColumns(left, right, leftWidth, rightWidth) {
  let out = [];
  let height = left.length;
  if (right.length > height) {
    height = right.length;
  }
  for (let i = 0; i < height; i = i + 1) {
    out.push(line(takeLine(left, i), leftWidth) + "|" + line(takeLine(right, i), rightWidth));
  }
  return out;
}

export function banner(options) {
  let width = options.width;
  let title = options.title || "GS TUI";
  let wide = options.wide;
  let minWidth = options.minWidth || 76;
  let bannerColor = options.color || "accent";

  if (wide && width >= minWidth) {
    return wide.map(function(row) {
      return styleText(line(row, width), { bold: true, fg: bannerColor });
    });
  }

  return [
    styleText(line(title, width), { bold: true, fg: bannerColor }),
  ];
}

export function scrollTitle(title, offset, bodyHeight, total) {
  if (total <= bodyHeight) {
    return title;
  }
  let start = offset + 1;
  let end = offset + bodyHeight;
  if (end > total) {
    end = total;
  }
  return title + " " + String(start) + "-" + String(end) + "/" + String(total);
}
