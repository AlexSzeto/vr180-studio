import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/preact'
import { html } from 'htm/preact'

import { MultiSelect } from './multi-select.mjs'

const FRUIT = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

function setup(value = ['banana']) {
  const onChange = vi.fn()
  const { container } = render(
    html`<${MultiSelect}
      options=${FRUIT}
      value=${value}
      onChange=${onChange}
    />`,
  )
  const trigger = container.querySelector('[data-multiselect-trigger]')
  const press = (key) => fireEvent.keyDown(trigger, { key })
  const popover = () => document.querySelector('[data-multiselect-popover]')
  const highlighted = () =>
    document
      .getElementById(trigger.getAttribute('aria-activedescendant'))
      ?.querySelector('.multi-select-option-label')
      ?.textContent.trim()
  return { trigger, press, popover, highlighted, onChange }
}

afterEach(cleanup)

describe('MultiSelect keyboard', () => {
  test('ArrowDown on the closed trigger opens on the first checked row without a change', () => {
    const { press, popover, highlighted, onChange } = setup()
    press('ArrowDown')
    expect(popover()).not.toBeNull()
    expect(highlighted()).toBe('Banana')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('Enter ticks the highlighted row and keeps the list open', () => {
    const { press, popover, onChange } = setup()
    press('ArrowDown')
    press('ArrowDown')
    press('Enter')
    expect(onChange).toHaveBeenCalledWith(['banana', 'cherry'])
    expect(popover()).not.toBeNull()
  })

  test('Space unticks a checked highlighted row', () => {
    const { press, onChange } = setup()
    press('ArrowDown')
    press(' ')
    expect(onChange).toHaveBeenCalledWith([])
  })

  test('typing a letter highlights its match', () => {
    const { press, highlighted } = setup()
    press('ArrowDown')
    press('a')
    expect(highlighted()).toBe('Apple')
  })

  test('Escape closes without a change', () => {
    const { press, popover, onChange } = setup()
    press('ArrowDown')
    press('Escape')
    expect(popover()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('Tab closes without a change', () => {
    const { press, popover, onChange } = setup()
    press('ArrowDown')
    press('Tab')
    expect(popover()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})
