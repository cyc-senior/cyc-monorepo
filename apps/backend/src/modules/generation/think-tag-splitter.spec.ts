import { ThinkTagSplitter } from './think-tag-splitter'

/** Feeds chunks through a splitter and joins what came out. */
function split(chunks: string[]) {
  const splitter = new ThinkTagSplitter()
  let content = ''
  let thought = ''
  for (const part of [
    ...chunks.map((c) => splitter.push(c)),
    splitter.flush(),
  ]) {
    content += part.content
    thought += part.thought
  }
  return { content, thought }
}

describe('ThinkTagSplitter', () => {
  it('passes plain content through', () => {
    expect(split(['{"a":', '1}'])).toEqual({ content: '{"a":1}', thought: '' })
  })

  it('separates a tag pair inside one chunk', () => {
    expect(split(['<think>plan</think>{"a":1}'])).toEqual({
      content: '{"a":1}',
      thought: 'plan',
    })
  })

  it('finds tags split across chunks', () => {
    expect(split(['<thi', 'nk>pla', 'n</th', 'ink', '>{"a"', ':1}'])).toEqual({
      content: '{"a":1}',
      thought: 'plan',
    })
  })

  it('splits every character into its own chunk', () => {
    const text = 'x<think>a<b</think>{"a":"<t"}'
    expect(split([...text])).toEqual({ content: 'x{"a":"<t"}', thought: 'a<b' })
  })

  it('does not hold back text that only looks like a tag start at the end', () => {
    const splitter = new ThinkTagSplitter()
    expect(splitter.push('{"a":"<')).toEqual({ content: '{"a":"', thought: '' })
    expect(splitter.push('b"}')).toEqual({ content: '<b"}', thought: '' })
  })

  it('keeps an unterminated thought as thought', () => {
    expect(split(['<think>still thinking'])).toEqual({
      content: '',
      thought: 'still thinking',
    })
  })
})
