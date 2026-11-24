const OPEN = '<think>'
const CLOSE = '</think>'

/** Text of one streamed chunk, split into the answer and the reasoning. */
export interface SplitChunk {
  content: string
  thought: string
}

/**
 * Separates inline `<think>…</think>` reasoning from a streamed answer (models
 * served without a reasoning parser put it in the content). A tag may arrive
 * split across chunks (`<thi` + `nk>`), so a possible partial tag at the end
 * of a chunk is held back until the next one shows what it is.
 */
export class ThinkTagSplitter {
  private inThink = false
  private pending = ''

  push(chunk: string): SplitChunk {
    const out: SplitChunk = { content: '', thought: '' }
    let buffer = this.pending + chunk
    this.pending = ''

    for (;;) {
      const tag = this.inThink ? CLOSE : OPEN
      const at = buffer.indexOf(tag)
      if (at === -1) {
        const keep = partialTagLength(buffer, tag)
        this.emit(out, buffer.slice(0, buffer.length - keep))
        this.pending = buffer.slice(buffer.length - keep)
        return out
      }
      this.emit(out, buffer.slice(0, at))
      buffer = buffer.slice(at + tag.length)
      this.inThink = !this.inThink
    }
  }

  /** Whatever was held back, at the end of the stream. */
  flush(): SplitChunk {
    const out: SplitChunk = { content: '', thought: '' }
    this.emit(out, this.pending)
    this.pending = ''
    return out
  }

  private emit(out: SplitChunk, text: string): void {
    if (this.inThink) {
      out.thought += text
    } else {
      out.content += text
    }
  }
}

/** Length of the longest end of `text` that could be the start of `tag`. */
function partialTagLength(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (tag.startsWith(text.slice(text.length - n))) {
      return n
    }
  }
  return 0
}
