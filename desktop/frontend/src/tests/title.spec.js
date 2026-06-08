import { describe, expect, it } from 'vitest'
import { buildConversationTitle } from '@/services/utils/title'

describe('buildConversationTitle', () => {
  it('returns a trimmed title for short input', () => {
    expect(buildConversationTitle('  hello codex  ')).toBe('hello codex')
  })

  it('compacts whitespace and truncates long input', () => {
    expect(buildConversationTitle('one   two   three   four   five   six   seven   eight')).toBe(
      'one two three four five six seven eight',
    )

    expect(buildConversationTitle('x'.repeat(60))).toBe(`${'x'.repeat(45)}...`)
  })
})
