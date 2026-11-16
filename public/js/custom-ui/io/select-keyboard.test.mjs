import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/preact'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'

import { Select } from './select.mjs'

const FRUIT = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Blueberry', value: 'blueberry', disabled: true },
  { label: 'Cherry', value: 'cherry' },
]

/** Controlled host so a pick re-renders with the new value. */
function Host({ initial = 'apple', onChange, disabled }) {
  const [value, setValue] = useState(initial)
  return html`<${Select}
    id="fruit"
    options=${FRUIT}
    value=${value}
    disabled=${disabled}
    onChange=${(e) => {
      onChange?.(e)
      setValue(e.target.value)
    }}
  />`
}

function setup(props = {}) {
  const onChange = vi.fn()
  const utils = render(html`<${Host} onChange=${onChange} ...${props} />`)
  const trigger = utils.container.querySelector('button')
  const press = (key, init = {}) => fireEvent.keyDown(trigger, { key, ...init })
  const popover = () => document.querySelector('[data-select-popover]')
  const highlighted = () =>
    document.getElementById(trigger.getAttribute('aria-activedescendant'))
      ?.textContent
  return { trigger, press, popover, highlighted, onChange }
}

afterEach(cleanup)

describe('Select keyboard', () => {
  test('ArrowDown on the closed trigger opens on the current value without changing it', () => {
    const { press, popover, highlighted, onChange } = setup()
    press('ArrowDown')
    expect(popover()).not.toBeNull()
    expect(highlighted()).toBe('Apple')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('a letter on the closed trigger opens on its match without changing the value', () => {
    const { press, popover, highlighted, onChange } = setup()
    press('c')
    expect(popover()).not.toBeNull()
    expect(highlighted()).toBe('Cherry')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('ArrowDown skips a disabled option', () => {
    const { press, highlighted } = setup({ initial: 'banana' })
    press('ArrowDown')
    expect(highlighted()).toBe('Banana')
    press('ArrowDown')
    expect(highlighted()).toBe('Cherry')
  })

  test('Enter picks the highlighted option once and closes', () => {
    const { press, popover, onChange } = setup()
    press('c')
    press('Enter')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toEqual({ target: { value: 'cherry' } })
    expect(popover()).toBeNull()
  })

  test('Tab picks the highlighted option and closes without blocking focus movement', () => {
    const { trigger, press, popover, onChange } = setup()
    press('ArrowDown')
    press('ArrowDown')
    const notCancelled = fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(notCancelled).toBe(true)
    expect(onChange.mock.calls[0][0]).toEqual({ target: { value: 'banana' } })
    expect(popover()).toBeNull()
  })

  test('Escape closes without a pick and does not propagate', () => {
    const { press, popover, onChange } = setup()
    const docListener = vi.fn()
    document.addEventListener('keydown', docListener)
    press('ArrowDown')
    press('ArrowDown')
    press('Escape')
    document.removeEventListener('keydown', docListener)
    expect(popover()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(docListener.mock.calls.some(([e]) => e.key === 'Escape')).toBe(false)
  })

  test('a disabled Select ignores every key', () => {
    const { press, popover, onChange } = setup({ disabled: true })
    for (const key of ['ArrowDown', 'Enter', ' ', 'c', 'Home', 'F4']) {
      press(key)
    }
    expect(popover()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('aria-activedescendant names the highlighted row', () => {
    const { trigger, press } = setup()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    press('End')
    const row = document.getElementById(
      trigger.getAttribute('aria-activedescendant'),
    )
    expect(row.textContent).toBe('Cherry')
    expect(row.getAttribute('role')).toBe('option')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})
