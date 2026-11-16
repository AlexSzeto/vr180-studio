import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import { html } from 'htm/preact'
import {
  ContentEditablePillInput,
  normalizeSuggestionKey,
  splitPastedText,
} from './content-editable-pill-input.mjs'
import { TooltipProvider } from '../overlays/tooltip.mjs'

describe('splitPastedText', () => {
  test('commitAll is true when the raw text contains a delimiter', () => {
    expect(splitPastedText('a, b, c').commitAll).toBe(true)
    expect(splitPastedText('a,b').commitAll).toBe(true)
    expect(splitPastedText('a\nb').commitAll).toBe(true)
    expect(splitPastedText('alpha,').commitAll).toBe(true)
  })

  test('commitAll is false for delimiter-free text', () => {
    expect(splitPastedText('alpha').commitAll).toBe(false)
    expect(splitPastedText('  alpha  ').commitAll).toBe(false)
  })

  test('parts splits, trims, and drops empty segments', () => {
    expect(splitPastedText('a, b, c').parts).toEqual(['a', 'b', 'c'])
    expect(splitPastedText('alpha,').parts).toEqual(['alpha'])
    expect(splitPastedText('  alpha  ').parts).toEqual(['alpha'])
    expect(splitPastedText('').parts).toEqual([])
    expect(splitPastedText(',,').parts).toEqual([])
  })
})

describe('normalizeSuggestionKey', () => {
  test('trims, ignores case, and treats underscores as spaces', () => {
    expect(normalizeSuggestionKey('Long_Hair ')).toBe(
      normalizeSuggestionKey('long hair'),
    )
  })

  test('does not merge words that have no separator', () => {
    expect(normalizeSuggestionKey('long hair')).not.toBe(
      normalizeSuggestionKey('longhair'),
    )
  })
})

describe('ContentEditablePillInput unknown-value indicator', () => {
  afterEach(() => cleanup())

  const renderInput = (props) =>
    html`<${ContentEditablePillInput} onValuesChange=${() => {}} ...${props} />`

  const flaggedValues = (container) =>
    [...container.querySelectorAll('[data-pill][data-pill-unknown]')].map((p) =>
      p.getAttribute('data-value'),
    )

  test('flags refresh in place as the suggestion list changes', () => {
    const values = ['a', 'zzz']
    const { container, rerender } = render(
      renderInput({ values, suggestions: [] }),
    )
    expect(flaggedValues(container)).toEqual([])

    rerender(renderInput({ values, suggestions: ['a'] }))
    expect(flaggedValues(container)).toEqual(['zzz'])
    const zzz = container.querySelector('[data-pill][data-value="zzz"]')
    expect(zzz.querySelector('[data-pill-unknown-icon]')).not.toBeNull()
    const a = container.querySelector('[data-pill][data-value="a"]')
    expect(a.querySelector('[data-pill-unknown-icon]')).toBeNull()

    rerender(renderInput({ values, suggestions: ['a', 'zzz'] }))
    expect(flaggedValues(container)).toEqual([])
    expect(container.querySelector('[data-pill-unknown-icon]')).toBeNull()
  })

  test('flagUnknown=false never flags a pill', () => {
    const { container, rerender } = render(
      renderInput({ values: ['zzz'], suggestions: ['a'], flagUnknown: false }),
    )
    expect(flaggedValues(container)).toEqual([])
    rerender(
      renderInput({
        values: ['zzz'],
        suggestions: ['a', 'b'],
        flagUnknown: false,
      }),
    )
    expect(flaggedValues(container)).toEqual([])
    expect(container.querySelector('[data-pill-unknown-icon]')).toBeNull()
  })

  test('the dropdown hides values already present as pills', () => {
    const { container } = render(
      renderInput({ values: ['red'], suggestions: ['red', 'blue'] }),
    )
    expect(flaggedValues(container)).toEqual([])

    const editable = container.querySelector('[contenteditable]')
    editable.lastChild.textContent = 'r'
    fireEvent.input(editable)
    const items = [...document.querySelectorAll('[id^="ac-dropdown-item-"]')]
    expect(items.map((el) => el.textContent)).not.toContain('red')

    // The other suggestion is still offered
    editable.lastChild.textContent = 'b'
    fireEvent.input(editable)
    const bItems = [...document.querySelectorAll('[id^="ac-dropdown-item-"]')]
    expect(bItems.map((el) => el.textContent)).toEqual(['blue'])
  })

  test('hovering a flagged pill shows the not-in-suggestion-list line', async () => {
    vi.useFakeTimers()
    try {
      const { container } = render(html`
        <${TooltipProvider}>
          <${ContentEditablePillInput}
            values=${['zzz']}
            suggestions=${['a']}
            onValuesChange=${() => {}}
          />
        </${TooltipProvider}>
      `)
      const pill = container.querySelector('[data-pill][data-value="zzz"]')
      fireEvent.mouseOver(pill, { clientX: 10, clientY: 10 })
      await vi.advanceTimersByTimeAsync(700)
      expect(
        document.getElementById('custom-ui-tooltip-box')?.textContent,
      ).toBe('not in suggestion list')
    } finally {
      vi.useRealTimers()
    }
  })
})
