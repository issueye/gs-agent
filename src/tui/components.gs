import { BOLD, DIM, INVERSE, RESET, charWidth, chars, color, line, repeatText, styleText, visibleWidth } from "@/tui/ansi";
import { loadingFrame } from "@/tui/loading";
import { border, clampScroll, renderLines, scrollTitle, splitLines, takeLine, wrapText } from "@/tui/widgets";

let stdMarkdown = require("@std/markdown");

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

function nodeText(node) {
  if (!node) {
    return "";
  }
  if (node.text) {
    return String(node.text);
  }
  let out = "";
  if (node.children) {
    for (let child of node.children) {
      if (child.type === "link") {
        let label = nodeText(child);
        let url = child.url || "";
        out = out + label;
        if (url !== "") {
          out = out + " <" + url + ">";
        }
      } else {
        out = out + nodeText(child);
      }
    }
  }
  return out;
}

function styledInline(node) {
  if (!node) {
    return "";
  }
  if (node.type === "text") {
    return node.text || "";
  }
  if (node.type === "code") {
    return styleText(" " + (node.text || "") + " ", { inverse: true });
  }
  if (node.type === "strong") {
    return styleText(nodeText(node), { bold: true, fg: "text" });
  }
  if (node.type === "em") {
    return styleText(nodeText(node), { dim: true, fg: "text" });
  }
  if (node.type === "link") {
    let label = nodeText(node);
    let url = node.url || "";
    if (url !== "") {
      return styleText(label, { underline: true, fg: "info" }) + styleText(" <" + url + ">", { dim: true, fg: "muted" });
    }
    return styleText(label, { underline: true, fg: "info" });
  }
  if (node.type === "softbreak" || node.type === "hardbreak") {
    return "\n";
  }
  if (node.children) {
    let out = "";
    for (let child of node.children) {
      out = out + styledInline(child);
    }
    return out;
  }
  return nodeText(node);
}

function styledInlineList(children) {
  let out = "";
  for (let child of children) {
    out = out + styledInline(child);
  }
  return out;
}

function pushWrapped(out, text, width, style) {
  let rows = wrapText(text, width);
  for (let row of rows) {
    if (style) {
      out.push(styleText(row, style));
    } else {
      out.push(row);
    }
  }
}

function pushCode(out, block, width) {
  let lang = block.lang || "code";
  let title = " " + lang + " ";
  let fill = width - visibleWidth(title);
  if (fill < 0) {
    fill = 0;
  }
  out.push(styleText(title + repeatText("-", fill), { dim: true, fg: "border" }));
  for (let raw of splitLines(block.text || "")) {
    let rows = wrapText("  " + raw, width);
    for (let row of rows) {
      out.push(styleText(row, { fg: "muted" }));
    }
  }
  out.push(styleText(repeatText("-", width), { dim: true, fg: "border" }));
}

function renderMarkdownBlocks(blocks, width) {
  let out = [];
  for (let block of blocks) {
    if (block.type === "heading") {
      if (out.length > 0) {
        out.push("");
      }
      let prefix = repeatText("#", block.level || 1) + " ";
      pushWrapped(out, prefix + styledInlineList(block.children || []), width, { bold: true, fg: "accent" });
      continue;
    }

    if (block.type === "paragraph") {
      pushWrapped(out, styledInlineList(block.children || []), width, undefined);
      out.push("");
      continue;
    }

    if (block.type === "list") {
      for (let item of block.children || []) {
        let rows = wrapText(styledInlineList(item.children || []), width - 2);
        for (let i = 0; i < rows.length; i = i + 1) {
          if (i === 0) {
            out.push(styleText("- ", { fg: "accent" }) + rows[i]);
          } else {
            out.push("  " + rows[i]);
          }
        }
      }
      out.push("");
      continue;
    }

    if (block.type === "code") {
      pushCode(out, block, width);
      out.push("");
      continue;
    }

    if (block.type === "blockquote") {
      let childRows = renderMarkdownBlocks(block.children || [], width - 2);
      for (let row of childRows) {
        out.push(styleText("> ", { fg: "muted" }) + styleText(row, { fg: "muted" }));
      }
      continue;
    }

    if (block.type === "hr") {
      out.push(styleText(repeatText("-", width), { dim: true, fg: "border" }));
      continue;
    }
  }

  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }
  if (out.length === 0) {
    out.push("");
  }
  return out;
}

function isTableSeparator(row) {
  let text = String(row || "").trim();
  if (!text.includes("|")) {
    return false;
  }
  let clean = text.replaceAll("|", "").replaceAll(":", "").replaceAll("-", "").trim();
  return clean === "";
}

function tableCells(row) {
  let text = String(row || "").trim();
  if (text.startsWith("|")) {
    text = text.slice(1);
  }
  if (text.endsWith("|")) {
    text = text.slice(0, text.length - 1);
  }
  let cells = text.split("|");
  let out = [];
  for (let cell of cells) {
    out.push(cell.trim());
  }
  return out;
}

function tableLine(cells, widths, width) {
  let row = "|";
  for (let i = 0; i < widths.length; i = i + 1) {
    row = row + " " + line(takeLine(cells, i), widths[i]) + " |";
  }
  return line(row, width);
}

function tableRenderWidth(width) {
  let maxWidth = Math.floor(width * 0.8);
  if (maxWidth < 24) {
    maxWidth = width;
  }
  if (maxWidth > width) {
    maxWidth = width;
  }
  return maxWidth;
}

function tablePad(row, tableWidth, fullWidth) {
  let indent = 2;
  if (fullWidth - tableWidth < indent) {
    indent = 0;
  }
  return line(repeatText(" ", indent) + line(row, tableWidth), fullWidth);
}

function renderTables(markdown, width) {
  let rows = splitLines(markdown);
  let out = [];
  let changed = false;
  let i = 0;
  while (i < rows.length) {
    let canStartTable = false;
    if (i + 1 < rows.length) {
      if (rows[i].includes("|")) {
        if (isTableSeparator(rows[i + 1])) {
          canStartTable = true;
        }
      }
    }
    if (canStartTable) {
      let table = [tableCells(rows[i])];
      i = i + 2;
      while (i < rows.length) {
        if (!rows[i].includes("|")) {
          break;
        }
        if (rows[i].trim() === "") {
          break;
        }
        table.push(tableCells(rows[i]));
        i = i + 1;
      }
      let renderWidth = tableRenderWidth(width);
      let columns = table[0].length;
      let colWidth = Math.floor((renderWidth - columns * 3 - 1) / columns);
      if (colWidth < 4) {
        colWidth = 4;
      }
      let widths = [];
      for (let c = 0; c < columns; c = c + 1) {
        widths.push(colWidth);
      }
      out.push(tablePad(styleText(repeatText("-", renderWidth), { dim: true, fg: "border" }), renderWidth, width));
      out.push(tablePad(styleText(tableLine(table[0], widths, renderWidth), { bold: true, fg: "accent" }), renderWidth, width));
      out.push(tablePad(styleText(repeatText("-", renderWidth), { dim: true, fg: "border" }), renderWidth, width));
      for (let r = 1; r < table.length; r = r + 1) {
        out.push(tablePad(tableLine(table[r], widths, renderWidth), renderWidth, width));
      }
      out.push(tablePad(styleText(repeatText("-", renderWidth), { dim: true, fg: "border" }), renderWidth, width));
      changed = true;
      continue;
    }
    out.push(rows[i]);
    i = i + 1;
  }
  return {
    changed: changed,
    text: out.join("\n"),
  };
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

  let tableRendered = renderTables(markdown, width);
  if (tableRendered.changed) {
    markdown = tableRendered.text;
  }
  let doc = stdMarkdown.parse(markdown);
  let rows = renderMarkdownBlocks(doc.children || [], width);

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
