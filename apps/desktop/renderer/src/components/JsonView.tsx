import { useMemo } from 'react'

function highlight(line: string): React.ReactNode {
  /* Lightweight tokenizer: matches keys, strings, numbers, booleans, nulls, punctuation. */
  const parts: React.ReactNode[] = []
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?(?:e[-+]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],])/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index))
    if (m[1]) {
      const cls = m[2] ? 'tok-key' : 'tok-str'
      parts.push(
        <span key={i++} className={cls}>{m[1]}</span>
      )
      if (m[2]) parts.push(<span key={i++} className="tok-punc">{m[2]}</span>)
    } else if (m[3]) {
      parts.push(<span key={i++} className="tok-num">{m[3]}</span>)
    } else if (m[4]) {
      parts.push(<span key={i++} className="tok-bool">{m[4]}</span>)
    } else if (m[5]) {
      parts.push(<span key={i++} className="tok-null">{m[5]}</span>)
    } else if (m[6]) {
      parts.push(<span key={i++} className="tok-punc">{m[6]}</span>)
    }
    last = re.lastIndex
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

export function JsonView({ text }: { text: string }) {
  const lines = useMemo(() => text.split('\n'), [text])
  return (
    <div className="json-view">
      {lines.map((line, i) => (
        <div key={i} className="json-view__row">
          <div className="json-view__ln">{i + 1}</div>
          <div className="json-view__txt">{highlight(line)}</div>
        </div>
      ))}
    </div>
  )
}
