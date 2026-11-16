import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/preact'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'

import {
  useListboxKeyboard,
  findTypeaheadMatch,
  TYPEAHEAD_RESET_MS,
} from './use-listbox-keyboard.mjs'

const CITIES = [
  { label: 'Boston' },
  { label: 'Baltimore' },
  { label: 'Buffalo', disabled: true },
  { label: 'Nashville' },
  { label: 'New York' },
  { label: 'Austin' },
]

/** Minimal host: a button driving the hook; exposes the highlight as text. */
function Harness({ options, onCommit = () => {}, mode = 'single' }) {
  const [open, setOpen] = useState(false)
  const kb = useListboxKeyboard({
    options,
    open,
    initialIndex: -1,
    mode,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onCommit,
  })
  return html`
    <button onKeyDown=${kb.onKeyDown} onKeyUp=${kb.onKeyUp}>trigger</button>
    <output data-open=${String(open)}>
      ${kb.highlightedIndex >= 0 ? options[kb.highlightedIndex].label : ''}
    </output>
  `
}

function setup(props) {
  const utils = render(html`<${Harness} options=${CITIES} ...${props} />`)
  const button = utils.getByText('trigger')
  const out = utils.container.querySelector('output')
  const press = (key, init = {}) => fireEvent.keyDown(button, { key, ...init })
  return { button, out, press }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('findTypeaheadMatch', () => {
  test('a single letter matches the first option starting with it, case-insensitively', () => {
    expect(findTypeaheadMatch(CITIES, 'B', -1)).toBe(0)
    expect(findTypeaheadMatch(CITIES, 'a', -1)).toBe(5)
  })

  test('the same letter again cycles to the next match and wraps, skipping disabled', () => {
    expect(findTypeaheadMatch(CITIES, 'b', 0)).toBe(1)
    expect(findTypeaheadMatch(CITIES, 'bb', 1)).toBe(0)
  })

  test('a longer buffer matches the whole prefix', () => {
    expect(findTypeaheadMatch(CITIES, 'ne', 3)).toBe(4)
    expect(findTypeaheadMatch(CITIES, 'bu', -1)).toBe(-1)
  })
})

describe('useListboxKeyboard', () => {
  test('typing on the closed trigger opens the list on the match', () => {
    const { out, press } = setup()
    press('n')
    expect(out.dataset.open).toBe('true')
    expect(out.textContent.trim()).toBe('Nashville')
  })

  test('typing letters quickly matches the whole buffer', () => {
    const { out, press } = setup()
    press('n')
    press('e')
    expect(out.textContent.trim()).toBe('New York')
  })

  test('the buffer resets after the timeout', () => {
    vi.useFakeTimers()
    const { out, press } = setup()
    press('n')
    act(() => vi.advanceTimersByTime(TYPEAHEAD_RESET_MS))
    press('a')
    expect(out.textContent.trim()).toBe('Austin')
  })

  test('disabled options are never highlighted by letters, arrows, Home or End', () => {
    const options = [
      { label: 'Off', disabled: true },
      { label: 'One' },
      { label: 'Gone', disabled: true },
      { label: 'Two' },
      { label: 'Last', disabled: true },
    ]
    const { getByText, container } = render(
      html`<${Harness} options=${options} />`,
    )
    const button = getByText('trigger')
    const out = container.querySelector('output')
    const press = (key) => fireEvent.keyDown(button, { key })
    press('ArrowDown')
    expect(out.textContent.trim()).toBe('One')
    press('ArrowDown')
    expect(out.textContent.trim()).toBe('Two')
    press('ArrowDown')
    expect(out.textContent.trim()).toBe('Two')
    press('Home')
    expect(out.textContent.trim()).toBe('One')
    press('End')
    expect(out.textContent.trim()).toBe('Two')
    press('g')
    expect(out.textContent.trim()).toBe('Two')
  })

  test('Space while the buffer is non-empty extends the search instead of committing', () => {
    const onCommit = vi.fn()
    const { out, press } = setup({ onCommit })
    press('n')
    press('e')
    press('w')
    press(' ')
    expect(onCommit).not.toHaveBeenCalled()
    expect(out.dataset.open).toBe('true')
    expect(out.textContent.trim()).toBe('New York')
  })

  test('Enter commits the highlight; in single mode it also closes', () => {
    const onCommit = vi.fn()
    const { out, press } = setup({ onCommit })
    press('ArrowDown')
    press('ArrowDown')
    press('Enter')
    expect(onCommit).toHaveBeenCalledWith(1)
    expect(out.dataset.open).toBe('false')
  })
})
