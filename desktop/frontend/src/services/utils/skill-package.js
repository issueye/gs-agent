import JSZip from 'jszip'

const supportRoots = new Set(['assets', 'references', 'scripts'])

export async function parseSkillZip(file) {
  if (!file) {
    throw new Error('请选择一个 zip 技能包。')
  }
  if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
    throw new Error('技能包必须是 .zip 文件。')
  }

  const zipData = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : file
  const zip = await JSZip.loadAsync(zipData)
  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  const skillEntries = entries.filter((entry) => entry.name.split('/').pop() === 'SKILL.md')
  if (skillEntries.length !== 1) {
    throw new Error('zip 技能包中必须且只能包含一个 SKILL.md。')
  }

  const skillEntry = skillEntries[0]
  const skillDir = skillEntry.name.includes('/') ? skillEntry.name.slice(0, skillEntry.name.lastIndexOf('/') + 1) : ''
  const skillText = await skillEntry.async('string')
  const parsed = parseSkillMarkdown(skillText)
  const files = []

  for (const entry of entries) {
    if (entry.name === skillEntry.name) {
      continue
    }
    if (!entry.name.startsWith(skillDir)) {
      continue
    }
    const rel = normalizeZipPath(entry.name.slice(skillDir.length))
    if (!isSupportedFile(rel)) {
      continue
    }
    files.push({
      path: rel,
      content: await entry.async('string'),
    })
  }

  return {
    id: '',
    name: parsed.metadata.name,
    description: parsed.metadata.description,
    path: parsed.metadata?.metadata?.gateway_path || parsed.metadata.name,
    content: parsed.body,
    version: parsed.metadata?.metadata?.version || 'v1',
    source: `zip:${file.name}`,
    metadata: {
      import_file: file.name,
      support_file_count: files.length,
      ...(parsed.metadata.metadata || {}),
    },
    files,
  }
}

export function parseSkillMarkdown(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) {
    throw new Error('SKILL.md 缺少 YAML frontmatter。')
  }

  const lines = normalized.split(/\r?\n/)
  if (lines[0].trim() !== '---') {
    throw new Error('SKILL.md frontmatter 格式无效。')
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end < 0) {
    throw new Error('SKILL.md frontmatter 缺少结束分隔符。')
  }

  const metadata = parseSimpleYaml(lines.slice(1, end))
  metadata.name = String(metadata.name || '').trim()
  metadata.description = String(metadata.description || '').trim()
  if (!metadata.name) {
    throw new Error('SKILL.md frontmatter 缺少 name。')
  }
  if (!metadata.description) {
    throw new Error('SKILL.md frontmatter 缺少 description。')
  }

  return {
    metadata,
    body: lines.slice(end + 1).join('\n').replace(/^\n/, '').trim(),
  }
}

function parseSimpleYaml(lines) {
  const root = {}
  let section = root
  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) {
      continue
    }
    const indent = rawLine.match(/^\s*/)?.[0]?.length || 0
    const trimmed = rawLine.trim()
    const index = trimmed.indexOf(':')
    if (index < 0) {
      continue
    }
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()
    if (indent === 0) {
      if (!rawValue) {
        root[key] = {}
        section = root[key]
      } else {
        root[key] = unquoteYaml(rawValue)
        section = root
      }
      continue
    }
    section[key] = unquoteYaml(rawValue)
  }
  return root
}

function unquoteYaml(value) {
  const text = String(value || '').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
  }
  return text
}

function normalizeZipPath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/')
}

function isSupportedFile(path) {
  if (!path || path.includes('..')) {
    return false
  }
  return supportRoots.has(path.split('/')[0])
}
