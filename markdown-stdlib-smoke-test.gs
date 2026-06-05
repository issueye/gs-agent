let markdown = require("@std/markdown");
let text = require("@std/text");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(text.width("你好") === 4, "text width cjk");
assert(text.width("\x1b[31m你好\x1b[0m") === 4, "text width ansi");
assert(text.truncateWidth("你好a", 4) === "你好", "truncate width");
assert(text.padRightWidth("你", 4) === "你  ", "pad width");

let source = "# 标题\n\n- **重点**\n- [文档](https://example.com/docs)\n\n```gs\nprintln(\"ok\")\n";
let doc = markdown.parse(source);
assert(doc.type === "document", "markdown doc");
assert(doc.children[0].type === "heading", "heading parsed");
assert(doc.children[1].type === "list", "list parsed");
assert(doc.children[2].type === "code", "code parsed");
assert(doc.diagnostics.length >= 1, "unclosed fence diagnostic");

let rendered = markdown.renderTerminal("你好世界", { width: 4 });
assert(rendered.lines.length === 2, "render wraps cjk");
assert(text.width(rendered.lines[0]) === 4, "render line width");

let stream = markdown.createStream({ width: 8 });
stream.append("# 回答\n\n");
stream.append("你好世界");
let preview = stream.snapshot();
assert(preview.lines.length >= 2, "stream preview");
let final = stream.finalize();
assert(final.document.type === "document", "stream finalize document");

let html = markdown.fromHTML("<h1>Title</h1><p>Hello <a href=\"/docs\">docs</a></p>", {
  baseUrl: "https://example.com",
  includeLinks: true,
});
assert(html.includes("# Title"), "html heading");
assert(html.includes("[docs](https://example.com/docs)"), "html link");

println("markdown-stdlib:ok");
