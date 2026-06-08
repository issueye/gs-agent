export function buildConversationTitle(input) {
  const compact = String(input || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!compact) {
    return 'New Conversation'
  }

  if (compact.length <= 48) {
    return compact
  }

  return `${compact.slice(0, 45).trimEnd()}...`
}
