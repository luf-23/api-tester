import { describe, expect, it } from 'vitest'
import { formatReleaseNotes, releaseNotesToPlainText } from './releaseNotes'

describe('release notes formatting', () => {
  it('removes HTML while keeping readable link text', () => {
    expect(
      releaseNotesToPlainText(
        '<p><strong>Full Changelog</strong>: <a class="commit-link" href="https://example.test"><code>v2.3.0...v2.4.0</code></a></p>'
      )
    ).toBe('Full Changelog: v2.3.0...v2.4.0')
  })

  it('normalizes Markdown and release note arrays', () => {
    expect(
      formatReleaseNotes([
        { note: '**Highlights**\n- [Fixed networking](https://example.test/fix)' },
        { note: '<p>Improved &amp; polished</p>' },
      ])
    ).toBe('Highlights\n- Fixed networking\nImproved & polished')
  })
})
