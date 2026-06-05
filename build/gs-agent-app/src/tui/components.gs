import { BOLD, DIM, INVERSE, RESET, charWidth, chars, color, line, repeatText, styleText, visibleWidth } from "@/tui/ansi";
import { loadingFrame } from "@/tui/loading";
import { border, clampScroll, renderLines, scrollTitle, splitLines, takeLine, wrapText } from "@/tui/widgets";

function optionText(options, name, fallback) {
  if (options && name in options) {
    return options[name];
  }
  return fallback;
}

function optionNumber(options, name, fallback) {
  if (options && name in options) {
    return options[name];
  }
  return fallback;
}

function optionBool(options, name, fallback) {
  if (options && name in options) {
    return options[name];
  }
  return fallback;
}

function emptyLines(width, height) {
  let out = [];
  for (let i = 0; i < height; i = i + 1) {
    out.push(line("", width));
  }
  return out;
}

function splitAtChar(text, index) {
  let list = chars(text);
  let col = index;
  if (col < 0) {
    col = 0;
  }
  if (col > list.length) {
    col = list.length;
  }
  return {
    before: list.slice(0, col).join(""),
    after: list.slice(col).join(""),
  };
}

function cropAroundCursor(text, cursor, width) {
  if (width < 1) {
    return "";
  }
  let list = chars(text);
  let col = cursor;
  if (col < 0) {
    col = 0;
  }
  if (col > list.length) {
    col = list.length;
  }

  let beforeBudget = Math.floor((width - 1) * 0.62);
  let afterBudget = width - 1 - beforeBudget;
  let before = [];
  let beforeWidth = 0;
  for (let i = col - 1; i >= 0; i = i - 1) {
    let ch = list[i];
    let next = charWidth(ch);
    if (beforeWidth + next > beforeBudget) {
      break;
    }
    before.unshift(ch);
    beforeWidth = beforeWidth + next;
  }

  let after = [];
  let afterWidth = 0;
  for (let i = col; i < list.length; i = i + 1) {
    let ch = list[i];
    let next = charWidth(ch);
    if (afterWidth + next > afterBudget) {
      break;
    }
    after.push(ch);
    afterWidth = afterWidth + next;
  }

  return line(before.join("") + INVERSE + " " + RESET + after.join(""), width);
}

function alignLine(row, width, align) {
  let used = visibleWidth(row);
  if (used >= width) {
    return line(row, width);
  }
  let spaces = width - used;
  if (align === "right") {
    return repeatText(" ", spaces) + row;
  }
  if (align === "center") {
    let left = Math.floor(spaces / 2);
    let right = spaces - left;
    return repeatText(" ", left) + row + repeatText(" ", right);
  }
  return line(row, width);
}

export function Text(options) {
  let width = optionNumber(options, "width", 1);
  let height = optionNumber(options, "height", 0);
  let value = optionText(options, "text", "");
  let wrap = optionBool(options, "wrap", true);
  let scroll = optionNumber(options, "scroll", 0);
  let align = optionText(options, "align", "left");
  let fg = optionText(options, "color", "");
  let bold = optionBool(options, "bold", false);
  let dim = optionBool(options, "dim", false);
  let inverse = optionBool(options, "inverse", false);
  let underline = optionBool(options, "underline", false);

  let rows = [];
  if (wrap) {
    rows = wrapText(value, width);
  } else {
    rows = splitLines(value);
  }

  let maxScroll = rows.length - height;
  if (height <= 0 || maxScroll < 0) {
    maxScroll = 0;
  }
  scroll = clampScroll(scroll, maxScroll);

  let out = [];
  let count = rows.length;
  if (height > 0) {
    count = height;
  }
  for (let i = 0; i < count; i = i + 1) {
    let row = takeLine(rows, scroll + i);
    row = alignLine(row, width, align);
    if (fg !== "" || bold || dim || inverse || underline) {
      row = styleText(row, {
        fg: fg,
        bold: bold,
        dim: dim,
        inverse: inverse,
        underline: underline,
      });
    }
    out.push(line(row, width));
  }
  return out;
}

export function Spacer(options) {
  let width = optionNumber(options, "width", 1);
  let height = optionNumber(options, "height", 1);
  return emptyLines(width, height);
}

export function Container(options) {
  let width = optionNumber(options, "width", 1);
  let height = optionNumber(options, "height", 0);
  let children = optionText(options, "children", []);
  let gap = optionNumber(options, "gap", 0);
  let out = [];

  for (let i = 0; i < children.length; i = i + 1) {
    let child = children[i];
    for (let row of child) {
      out.push(line(row, width));
    }
    if (gap > 0 && i < children.length - 1) {
      for (let g = 0; g < gap; g = g + 1) {
        out.push(line("", width));
      }
    }
  }

  if (height > 0) {
    return renderLines(out, width, height);
  }
  return out;
}

export function Box(options) {
  let width = optionNumber(options, "width", 1);
  let height = optionNumber(options, "height", 0);
  let title = optionText(options, "title", "");
  let content = optionText(options, "content", []);
  let padding = optionNumber(options, "padding", 0);
  let focused = optionBool(options, "focused", false);
  let borderColor = optionText(options, "color", "border");
  if (focused) {
    borderColor = optionText(options, "focusColor", "focus");
  }

  if (width < 4) {
    width = 4;
  }

  let innerWidth = width - 2 - padding * 2;
  if (innerWidth < 1) {
    innerWidth = 1;
  }
  let body = [];
  for (let row of content) {
    body.push(line(row, innerWidth));
  }

  let bodyHeight = body.length;
  if (height > 0) {
    bodyHeight = height - 2;
    if (bodyHeight < 0) {
      bodyHeight = 0;
    }
  }

  let topFill = width - 2;
  let titleText = "";
  if (title !== "") {
    titleText = " " + title + " ";
  }
  let top = "+" + titleText + repeatText("-", topFill - visibleWidth(titleText)) + "+";
  if (focused) {
    top = styleText(top, { bold: true, fg: borderColor });
  } else {
    top = color(top, borderColor);
  }

  let out = [line(top, width)];
  for (let i = 0; i < bodyHeight; i = i + 1) {
    let row = takeLine(body, i);
    let leftPad = repeatText(" ", padding);
    out.push(color("|", borderColor) + leftPad + line(row, innerWidth) + leftPad + color("|", borderColor));
  }
  out.push(line(color("+" + repeatText("-", width - 2) + "+", borderColor), width));
  return out;
}

export function Input(options) {
  let width = optionNumber(options, "width", 1);
  let title = optionText(options, "title", "Input");
  let value = optionText(options, "value", "");
  let cursor = optionNumber(options, "cursor", chars(value).length);
  let placeholder = optionText(options, "placeholder", "");
  let focused = optionBool(options, "focused", true);
  let meta = optionText(options, "meta", "");
  let prompt = optionText(options, "prompt", "> ");

  let inputWidth = width - visibleWidth(prompt);
  if (inputWidth < 1) {
    inputWidth = 1;
  }
  let shown = "";
  if (value === "" && placeholder !== "") {
    shown = styleText(line(placeholder, inputWidth), { dim: true, fg: "muted" });
  } else if (focused) {
    shown = cropAroundCursor(value, cursor, inputWidth);
  } else {
    shown = line(value, inputWidth);
  }

  let out = [];
  out.push(styleText(line(title, width), { bold: true, fg: "accent" }));
  out.push(prompt + shown);
  if (meta !== "") {
    out.push(styleText(line(meta, width), { dim: true, fg: "muted" }));
  }
  return out;
}

export function Loading(options) {
  let width = optionNumber(options, "width", 20);
  let tick = optionNumber(options, "tick", 0);
  let label = optionText(options, "label", "working");
  let active = optionBool(options, "active", true);
  let status = "ok";
  if (active) {
    status = loadingFrame(tick);
  }
  return [
    line(color(status, active ? "warning" : "success") + " " + label, width),
  ];
}

function renderInlineMarkdown(row) {
  let text = String(row);
  let out = "";
  let i = 0;
  while (i < text.length) {
    let rest = text.slice(i);
    if (rest.startsWith("**")) {
      let end = text.indexOf("**", i + 2);
      if (end >= 0) {
        out = out + styleText(text.slice(i + 2, end), { bold: true, fg: "text" });
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith("`")) {
      let end = text.indexOf("`", i + 1);
      if (end >= 0) {
        out = out + styleText(" " + text.slice(i + 1, end) + " ", { inverse: true });
        i = end + 1;
        continue;
      }
    }
    let ch = chars(text.slice(i))[0];
    out = out + ch;
    i = i + ch.length;
  }
  return out;
}

export function Markdown(options) {
  let width = optionNumber(options, "width", 1);
  let height = optionNumber(options, "height", 0);
  let markdown = optionText(options, "text", "");
  let scroll = optionNumber(options, "scroll", 0);
  let title = optionText(options, "title", "");
  let showTitle = title !== "";
  let bodyHeight = height;
  if (showTitle && bodyHeight > 0) {
    bodyHeight = bodyHeight - 1;
  }
  if (bodyHeight < 0) {
    bodyHeight = 0;
  }

  let rows = [];
  let inCode = false;
  for (let raw of splitLines(markdown)) {
    let row = raw;
    if (row.startsWith("```")) {
      inCode = !inCode;
      rows.push(styleText(border(width), { dim: true, fg: "border" }));
      continue;
    }
    if (inCode) {
      let codeRows = wrapText("  " + row, width);
      for (let item of codeRows) {
        rows.push(styleText(item, { dim: true, fg: "muted" }));
      }
      continue;
    }
    if (row.startsWith("# ")) {
      rows.push(styleText(line(row.slice(2), width), { bold: true, fg: "accent" }));
      continue;
    }
    if (row.startsWith("## ")) {
      rows.push(styleText(line(row.slice(3), width), { bold: true, fg: "accent" }));
      continue;
    }
    if (row.startsWith("- ")) {
      let wrapped = wrapText("  - " + row.slice(2), width);
      for (let item of wrapped) {
        rows.push(renderInlineMarkdown(item));
      }
      continue;
    }
    let wrapped = wrapText(row, width);
    for (let item of wrapped) {
      rows.push(renderInlineMarkdown(item));
    }
  }

  let maxScroll = rows.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  scroll = clampScroll(scroll, maxScroll);

  let out = [];
  if (showTitle) {
    out.push(styleText(line(scrollTitle(title, scroll, bodyHeight, rows.length), width), { bold: true, fg: "accent" }));
  }
  if (height > 0) {
    for (let i = 0; i < bodyHeight; i = i + 1) {
      out.push(line(takeLine(rows, scroll + i), width));
    }
    return out;
  }
  for (let row of rows) {
    out.push(line(row, width));
  }
  return out;
}
