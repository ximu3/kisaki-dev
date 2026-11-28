import MarkdownIt from 'markdown-it'
import { footnote } from '@mdit/plugin-footnote'

const reader = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true }).use(
  footnote,
)

export function readMarkdown(input: string | null | undefined) {
  const words: string[] = []
  const attachments = new Set<string>()

  function visit(tokens: ReturnType<typeof reader.parse>) {
    for (const token of tokens) {
      if (token.type === 'image') {
        const source = token.attrGet('src')
        if (typeof source === 'string' && source.startsWith('attachment:')) {
          attachments.add(source.slice('attachment:'.length))
        }
        words.push(token.content)
      } else if (token.children) {
        visit(token.children)
      } else if (['text', 'code_inline', 'code_block', 'fence'].includes(token.type)) {
        words.push(token.content)
      }
    }
  }

  if (input) {
    visit(reader.parse(input, {}))
  }
  return { text: words.join(' '), inlineImages: [...attachments] }
}
