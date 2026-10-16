import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const sources = [here, join(here, '../../features/learning')]
const files = sources.flatMap((dir) =>
  readdirSync(dir)
    .filter((f) => /\.(tsx?|css)$/.test(f) && !f.includes('.test.'))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') })),
)
// Defined in the tokens, the app styles, or locally by a component (CSS `--x:` or an inline style key `'--x'`)
const defined = new Set(
  [readFileSync(join(here, 'tokens.css'), 'utf8'), readFileSync(join(here, '../styles.css'), 'utf8'), ...files.map((f) => f.text)].flatMap(
    (text) => [...text.matchAll(/(--[\w-]+)['"]?\s*:/g)].map((m) => m[1]),
  ),
)

describe('learning kit tokens', () => {
  // An undefined var() makes a colour silently fall back (Kiki's dots turned black after the --learning- rename)
  it('defines every CSS variable the kit and learning screens use', () => {
    const missing: string[] = []
    for (const { name: file, text } of files) {
      for (const [, name] of text.matchAll(/var\((--[\w-]+)/g)) {
        if (!defined.has(name)) missing.push(`${file}: ${name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
