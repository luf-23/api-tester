import CodeMirror from '@uiw/react-codemirror'
import { bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { tags as t } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

const jsonHighlight = HighlightStyle.define([
  { tag: t.string, color: 'var(--tok-str)' },
  { tag: t.number, color: 'var(--tok-num)' },
  { tag: t.bool, color: 'var(--tok-bool)' },
  { tag: t.null, color: 'var(--text-muted)' },
  { tag: t.keyword, color: 'var(--tok-bool)' },
  { tag: [t.bracket, t.separator], color: 'var(--text-secondary)' },
  { tag: t.propertyName, color: 'var(--accent-strong)' },
])

const jsonEditorChrome = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--fs-caption)',
    border: '1px solid color-mix(in srgb, var(--border-strong) 55%, var(--border-subtle))',
    borderRadius: 'calc(var(--radius-ui) + 1px)',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-panel)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-code)',
    lineHeight: '1.45',
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    padding: '10px 6px 10px 0',
    minHeight: 'unset',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in srgb, var(--bg-shell) 88%, var(--bg-panel))',
    color: 'var(--text-muted)',
    borderRight: '1px solid color-mix(in srgb, var(--border-strong) 45%, var(--border-subtle))',
    paddingRight: '2px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 6px 0 10px',
    minWidth: '36px',
    fontSize: '11px',
  },
  '&.cm-focused': {
    outline: 'none',
    boxShadow: '0 0 0 3px var(--accent-soft)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--accent)',
  },
  '.cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--accent-soft) 55%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--accent-soft) 85%, transparent) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
  },
  '.cm-diagnostic-error': {
    borderBottom: '2px dotted color-mix(in srgb, var(--status-4xx, #d14545) 65%, transparent)',
  },
  '.cm-tooltip.cm-tooltip-lint': {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-strong)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    boxShadow: '0 8px 22px rgba(0, 0, 0, 0.14)',
  },
})

const jsonExtensions = [
  json(),
  syntaxHighlighting(jsonHighlight),
  bracketMatching(),
  linter(jsonParseLinter()),
  lintGutter(),
  jsonEditorChrome,
]

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function JsonBodyEditor({ value, onChange, placeholder }: Props) {
  return (
    <div className="json-body-cm-wrap">
      <CodeMirror
        className="json-body-cm"
        value={value}
        height="100%"
        theme="none"
        indentWithTab
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          closeBrackets: true,
          bracketMatching: false,
          defaultKeymap: true,
          history: true,
          indentOnInput: true,
          syntaxHighlighting: false,
        }}
        extensions={jsonExtensions}
        onChange={onChange}
      />
    </div>
  )
}
