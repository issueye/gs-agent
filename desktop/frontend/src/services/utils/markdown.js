import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

markdown.renderer.rules.table_open = () => (
  '<div class="markdown-table-scroll scrollbar-thin" tabindex="0"><table>'
)
markdown.renderer.rules.table_close = () => '</table></div>'

export function hasVisibleMarkdownContent(value) {
  return normalizeVisibleText(value).length > 0
}

export function renderMarkdown(value) {
  const source = String(value || '')
  if (!source.trim()) {
    return ''
  }
  return markdown.render(source)
}

function normalizeVisibleText(value) {
  return String(value || '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .trim()
}
