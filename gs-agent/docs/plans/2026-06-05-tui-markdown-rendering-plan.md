# gs-agent TUI Markdown 渲染方案

本文档用于指导 `gs-agent` 的 TUI Markdown 渲染升级。目标不是一次性做完整浏览器级 Markdown，而是把 agent 回答、工具结果、网页摘要和说明文档渲染到终端里，做到稳定、可滚动、可增量刷新、中文宽度正确。

## 参考方案分析

### Glamour / Glow

Charmbracelet 的 Glamour 是终端 Markdown 渲染的成熟方案。它把 Markdown 渲染成 ANSI 样式文本，支持自定义样式和指定 word wrap 宽度。Glamour 的一个重要设计点是渲染器保持纯函数式，同样输入得到同样输出；终端颜色降级等能力由外层处理。Glow 则基于 Glamour 做成完整 Markdown 阅读器。

对 `gs-agent` 的启发：

- Markdown 渲染函数应尽量是纯函数，不在渲染阶段修改 TUI state。
- 样式应做成 theme，而不是散落在渲染逻辑里。
- word wrap 必须在渲染器入口显式传入宽度。

### Rich / Textual

Rich 的 `Markdown` renderable 使用 Markdown parser，并把结构元素渲染成 `Text`、`Syntax`、`Rule`、`Table` 等终端对象。Textual 的 Markdown widget 进一步把 Markdown 做成可聚焦、可更新、可跳转锚点、有目录事件的组件，并提示高频 append 时需要注意刷新频率。

对 `gs-agent` 的启发：

- 不要只做字符串替换，应有 block / inline 两层结构。
- 代码块、表格、横线、链接、标题应有独立 renderer。
- streaming 回答不能每个 token 都完整重排，应做节流和脏区刷新。

### Aider / agent 类 CLI

Aider 的终端输出系统支持 rich formatted output、Markdown streaming、spinner/waiting 状态，并针对流式输出做刷新节流。agent 场景和普通 Markdown viewer 的区别是内容会持续增长，且中间可能出现未闭合代码块、列表、表格。

对 `gs-agent` 的启发：

- 需要支持“未完成 Markdown”的容错渲染。
- 流式阶段使用轻量增量渲染，最终完成后再做一次完整规范渲染。
- 渲染耗时应可测量，超过阈值时降低刷新频率。

### Markdown TUI viewer / editor

mdtui、mdterm 等 Markdown TUI 更偏文档阅读和编辑，常见能力包括文件树、live preview、代码高亮、表格、引用、链接、目录、并行滚动。它们说明完整文档阅读和 agent 回答阅读不是同一个优先级：agent TUI 应先优化回答和工具结果，而不是做完整 Markdown IDE。

对 `gs-agent` 的启发：

- 第一阶段不做文件浏览、编辑预览、图片、mermaid、数学公式。
- 表格和代码块是 agent 输出中最值得优先支持的复杂结构。
- 目录和锚点可以后置，等 Markdown 组件用于长文档后再做。

## 当前实现问题

当前 [src/tui/components.gs](../../src/tui/components.gs) 的 `Markdown` 组件属于轻量扫描实现：

- 行级识别 `#`、`##`、`-`、代码围栏。
- inline 只支持 `**bold**` 和 `` `code` ``。
- 没有 AST，渲染和解析耦合。
- 没有表格、blockquote、ordered list、task list、链接、分割线。
- 代码块没有语言信息和语法高亮。
- wrap 发生在已经加样式后的字符串上，ANSI 与中文宽度容易互相影响。
- streaming 过程中遇到未闭合代码块时只能靠 `inCode` 状态粗略处理。

## 设计目标

1. **稳定优先**：任何不完整或非法 Markdown 都应显示为可读文本，而不是抛错。
2. **中文宽度正确**：所有布局使用 `visibleWidth` / `charWidth`，不能按 `.length`。
3. **渲染无副作用**：Markdown renderer 不修改 state，只返回行数组和 metadata。
4. **支持 streaming**：增量内容可快速预览，完成后可完整重排。
5. **主题可配置**：样式从 theme 读取，支持无色模式。
6. **适配 TUI viewport**：渲染结果是稳定行数组，外层负责滚动条、焦点和局部刷新。

## 总体架构

```text
Markdown text
  -> normalize
  -> block parser
  -> inline parser
  -> layout engine(width, theme)
  -> rendered lines + source map + metadata
  -> viewport(scroll, height)
  -> screen diff renderer
```

建议新增模块：

```text
src/tui/markdown/
  parser.gs       block parser
  inline.gs       inline token parser
  layout.gs       block -> display rows
  theme.gs        semantic styles
  renderer.gs     public renderMarkdown()
  streaming.gs    append/finalize cache
```

保留 `components.gs` 中的 `Markdown(options)` 作为组件入口，但内部委托给新 renderer。

## 数据结构

### Block

```javascript
{
  type: "paragraph" | "heading" | "code" | "list" | "quote" | "table" | "hr",
  level: 1,
  ordered: false,
  checked: undefined,
  lang: "",
  text: "",
  rows: [],
  children: [],
  startLine: 0,
  endLine: 0
}
```

### Inline Token

```javascript
{
  type: "text" | "strong" | "em" | "code" | "link",
  text: "",
  href: "",
  children: []
}
```

### Render Result

```javascript
{
  lines: [],
  total: 0,
  headings: [],
  links: [],
  diagnostics: []
}
```

## 支持范围

### P0

- paragraph
- heading `#` 到 `######`
- fenced code block
- unordered list `-` / `*`
- ordered list `1.`
- inline code
- bold
- italic
- link `[text](url)`，默认显示为 `text <url>`
- blockquote `>`
- horizontal rule
- 中文宽度 wrap
- 未闭合代码块容错

### P1

- task list `- [ ]` / `- [x]`
- table
- nested list 两层缩进
- code block 语言标签显示
- JSON / diff / shell 的轻量高亮
- link 收集和编号：`[1] url`
- callout：`> [!NOTE]`

### P2

- TOC / anchor jump
- 搜索命中高亮
- Mermaid / math 的纯文本 fallback
- 复制当前 code block
- 终端 hyperlink OSC 8

## 具体渲染规则

### 标题

- H1：bold + accent，前后留一行。
- H2/H3：bold + accent，不额外放大。
- H4-H6：bold，不使用过多颜色。
- 标题不画大字号 ASCII，避免占空间。

### 段落

- 普通段落按宽度 wrap。
- 段落之间保留一空行，但连续空行压缩为一行。
- 中文、英文、inline code 混排时按 terminal cell width 断行。

### 列表

- 第一行前缀：`- `、`1. `、`[ ] `、`[x] `。
- 后续 wrap 行缩进到文本起点。
- 嵌套第一阶段最多支持两层，超出时降级为普通缩进文本。

### 代码块

```text
--- js ---
  const x = 1
-----------
```

- 顶部显示语言标签，没有语言则显示 `code`。
- 内容不执行 Markdown inline 渲染。
- 长行默认横向截断或 soft wrap，由调用方配置。
- 颜色：代码内容 muted，语言标签 dim，边框 border。

### 表格

第一版 table layout：

- 解析 `| a | b |` 和 separator 行。
- 计算每列最大宽度，但总宽超过 viewport 时按比例压缩。
- 单元格内容 wrap，高度按最大行数对齐。
- 表格过窄时降级为 definition list：

```text
a: value
b: value
```

### 链接

终端默认不可点击时：

```text
OpenAI <https://openai.com>
```

如果后续语言侧/终端侧支持 OSC 8 hyperlink，可配置为只显示带下划线文本。

## Streaming 渲染

agent 回答流式输出时建议分两层：

### 快速预览模式

- 每 80-120ms 最多渲染一次。
- 只重排最近 N 行或最近一个 block。
- 未闭合 code fence 按代码块显示到当前末尾。
- 未闭合 inline 标记按普通文本显示。

### 完整模式

- 模型结束后完整 parse + layout。
- 生成稳定 headings / links / diagnostics。
- 写入 session 和 answer 后，详情区使用完整结果。

接口建议：

```javascript
let stream = createMarkdownStream({ width, theme });
stream.append(delta);
let preview = stream.renderPreview(scroll, height);
let final = stream.finalize();
```

## 组件 API

现有组件保持兼容：

```javascript
Markdown({
  width,
  height,
  text,
  scroll,
  title,
});
```

新增可选项：

```javascript
Markdown({
  width,
  height,
  text,
  scroll,
  title,
  theme: "agent",
  mode: "final" | "stream",
  codeWrap: true,
  showLinks: true,
  showDiagnostics: false,
});
```

底层函数：

```javascript
renderMarkdown(text, {
  width,
  theme,
  codeWrap,
  showLinks,
});
```

## 与 Agent TUI 集成

优先替换两个位置：

1. `Details` 区展示 assistant answer / message content 时使用 Markdown。
2. `tool_result` 如果 content 是 JSON，先做 JSON pretty + 语义高亮；如果 result/text 是 Markdown，再走 Markdown。

推荐策略：

- `answer` 事件：Markdown 渲染。
- `message assistant`：Markdown 渲染。
- `message user`：纯文本。
- `tool_result`：默认 JSON 渲染，若 result 中有 `markdown` 或 `contentType=text/markdown` 再 Markdown。
- 错误：纯文本 + error color。

## 性能策略

- `renderMarkdown` 结果按 `textHash + width + theme` 缓存。
- scroll 变化不重新 parse，只做 viewport 裁剪。
- width 变化才重新 layout。
- streaming 阶段节流刷新，避免每 token 重排。
- 渲染耗时超过 30ms 时记录 debug log，超过 80ms 时降低刷新频率。

## 测试计划

### P0 Fixtures

- 中文段落 wrap。
- bold / italic / inline code 混排。
- 未闭合 code fence。
- ordered / unordered list。
- blockquote。
- link 展示。
- ANSI 样式不影响 visible width。

### P1 Fixtures

- table 宽度压缩。
- task list。
- nested list。
- diff code block。
- streaming append + finalize 结果一致。

### 回归断言

- renderer 不修改输入 state。
- 同样 text + width 输出稳定。
- height/scroll 只影响 viewport，不影响总行数。
- 非法 Markdown 不抛错。

## 实施阶段

### 第一阶段：替换现有组件内部实现

- 新增 `src/tui/markdown/*`。
- 实现 block parser、inline parser、layout。
- `components.Markdown` 改为调用 `renderMarkdown`。
- 补 `markdown-smoke-test.gs`。

### 第二阶段：接入 Agent Details

- assistant message / answer 使用 Markdown 视图。
- tool JSON 继续用纯 JSON，避免复杂结果误判。
- 增加详情区渲染模式标记。

### 第三阶段：Streaming

- agent provider 支持 streaming event 后，增加 `createMarkdownStream`。
- tick 中按节流刷新 preview。
- run 完成后 finalize。

### 第四阶段：表格和代码高亮

- 增加 table layout。
- 增加 JSON/diff/shell 轻量语法高亮。
- 增加 link index 和打开链接能力。

## 语言侧建议

后续如果语言侧继续增强，最有价值的是：

- 标准库 `@std/markdown`：返回 block AST。
- 标准库 `@std/text.width/wrap/truncate`：统一 CJK/emoji/ANSI 宽度。
- 标准库轻量 highlighter：JSON/diff/shell。
- HTTP fetch 的 HTML -> Markdown 工具，可服务 `web_fetch`。

## 参考资料

- Glamour: https://github.com/charmbracelet/glamour
- Rich Markdown: https://rich.readthedocs.io/en/stable/markdown.html
- Textual Markdown widget: https://textual.textualize.io/widgets/markdown/
- Aider terminal interface overview: https://deepwiki.com/Aider-AI/aider/2.5-repository-mapping
- mdtui: https://mdtui.pages.dev/
