import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/preact'
import { html } from 'htm/preact'

import { PillSelectPanel } from './pill-select-panel.mjs'
import { Pill } from './pill.mjs'
import { currentTheme, getPopoverMaxHeight } from '../theme.mjs'

afterEach(() => cleanup())

const ANCHOR = { top: 10, bottom: 30, left: 10, width: 40 }

const panelEl = () => document.querySelector('[data-pill-select-panel]')
const optionRows = () => [
  ...document.querySelectorAll(
    '[data-pill-select-panel] [data-pill-select-option]',
  ),
]
const bgOf = (el) => getComputedStyle(el).backgroundColor
// jsdom does not apply :hover/:active, so read the background goober wrote
// for the row's class under that pseudo-class.
const stateBgOf = (el, state) => {
  const css = [...document.querySelectorAll('style')]
    .map((s) => s.textContent)
    .join('')
  for (const cls of el.classList) {
    const m = css.match(
      new RegExp(`\.${cls}:${state}\{[^}]*background-color:([^;}]+)`),
    )
    if (m) return m[1].trim()
  }
  return null
}

function renderPanel(props = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    html`<${PillSelectPanel}
      anchorRect=${ANCHOR}
      options=${['a', 'b', 'c']}
      value="b"
      size="tiny"
      color="primary"
      onSelect=${onSelect}
      onClose=${onClose}
      ...${props}
    />`,
  )
  return { onSelect, onClose }
}

describe('PillSelectPanel', () => {
  test('renders nothing when anchorRect is null', () => {
    renderPanel({ anchorRect: null })
    expect(panelEl()).toBeNull()
  })

  test('renders one pill per option, in order', () => {
    renderPanel({ options: ['x', { value: 'y', label: 'Why' }, 'z'] })
    expect(optionRows().map((p) => p.textContent.trim())).toEqual([
      'x',
      'Why',
      'z',
    ])
  })

  test('every option row is neutral at rest, the current one included', () => {
    renderPanel()
    expect(optionRows().map(bgOf)).toEqual([
      'transparent',
      'transparent',
      'transparent',
    ])
  })

  test('a row takes its colour only on hover and press', () => {
    const t = currentTheme.value
    renderPanel()
    const [a] = optionRows()
    expect(stateBgOf(a, 'hover')).toBe(t.colors.primary.hover)
    expect(stateBgOf(a, 'active')).toBe(t.colors.primary.active)
  })

  test('an option color overrides the panel color', () => {
    const t = currentTheme.value
    renderPanel({
      options: [{ value: 'a', color: 'danger' }, 'b2'],
      color: 'success',
    })
    const [a, b2] = optionRows()
    expect(stateBgOf(a, 'hover')).toBe(t.colors.danger.hover)
    expect(stateBgOf(b2, 'hover')).toBe(t.colors.success.hover)
  })

  test('clicking a non-current option fires onSelect then onClose', () => {
    const order = []
    const onSelect = vi.fn((v) => order.push(`select:${v}`))
    const onClose = vi.fn(() => order.push('close'))
    renderPanel({ onSelect, onClose })
    fireEvent.click(optionRows()[2])
    expect(onSelect).toHaveBeenCalledWith('c')
    expect(order).toEqual(['select:c', 'close'])
  })

  test('clicking the current option fires only onClose', () => {
    const { onSelect, onClose } = renderPanel()
    fireEvent.click(optionRows()[1])
    expect(onSelect).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('Escape fires onClose', () => {
    const { onClose } = renderPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('a mousedown outside fires onClose; one inside does not', () => {
    const { onClose } = renderPanel()
    fireEvent.mouseDown(optionRows()[0])
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test.each(['tiny', 'small', 'medium', 'large'])(
    'max-height at size="%s" is getPopoverMaxHeight',
    (size) => {
      renderPanel({ size })
      expect(getComputedStyle(panelEl()).maxHeight).toBe(
        getPopoverMaxHeight(currentTheme.value, size),
      )
    },
  )
})

describe('Pill select panel', () => {
  const slotToken = (container) => container.querySelector('[data-pill-slot]')

  test('clicking a slot token opens the panel and does not change the template', () => {
    const onTemplateChange = vi.fn()
    const { container } = render(
      html`<${Pill} options=${['a', 'b']} onTemplateChange=${onTemplateChange}
        >x {{a}}</${Pill}
      >`,
    )
    fireEvent.click(slotToken(container))
    expect(panelEl()).toBeTruthy()
    expect(optionRows().map((p) => p.textContent.trim())).toEqual(['a', 'b'])
    expect(onTemplateChange).not.toHaveBeenCalled()
  })

  test('picking b on "x {{a}}" calls onTemplateChange("x {{b}}") and closes', async () => {
    const onTemplateChange = vi.fn()
    const { container } = render(
      html`<${Pill} options=${['a', 'b']} onTemplateChange=${onTemplateChange}
        >x {{a}}</${Pill}
      >`,
    )
    fireEvent.click(slotToken(container))
    await act(async () => {
      fireEvent.click(optionRows()[1])
    })
    expect(onTemplateChange).toHaveBeenCalledWith('x {{b}}')
    expect(panelEl()).toBeNull()
  })

  test('a disabled pill opens nothing', () => {
    const { container } = render(
      html`<${Pill} disabled=${true} options=${['a', 'b']}>x {{a}}</${Pill}>`,
    )
    fireEvent.click(slotToken(container))
    fireEvent.click(container.querySelector('.pill-container'))
    expect(panelEl()).toBeNull()
  })

  test('a pill with no options opens nothing', () => {
    const { container } = render(html`<${Pill}>x {{a}}</${Pill}>`)
    fireEvent.click(slotToken(container))
    expect(panelEl()).toBeNull()
  })

  test('a disabled selectOptions pill opens nothing', () => {
    const { container } = render(
      html`<${Pill} disabled=${true} selectOptions=${['and', 'or']}>and</${Pill}>`,
    )
    fireEvent.click(container.querySelector('.pill-container'))
    expect(panelEl()).toBeNull()
  })

  test('selectOptions opens the panel on body click and calls onSelect on a pick', async () => {
    const onSelect = vi.fn()
    const { container } = render(
      html`<${Pill} selectOptions=${['and', 'or']} onSelect=${onSelect}
        >and</${Pill}
      >`,
    )
    fireEvent.click(container.querySelector('.pill-container'))
    expect(panelEl()).toBeTruthy()
    const [and, or] = optionRows()
    expect(and.hasAttribute('data-pill-select-current')).toBe(true)
    await act(async () => {
      fireEvent.click(or)
    })
    expect(onSelect).toHaveBeenCalledWith('or')
    expect(panelEl()).toBeNull()
  })

  test('selectOptions takes precedence over onClick, with a [pill] warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onClick = vi.fn()
    const { container } = render(
      html`<${Pill} selectOptions=${['and', 'or']} onClick=${onClick}
        >and</${Pill}
      >`,
    )
    fireEvent.click(container.querySelector('.pill-container'))
    expect(onClick).not.toHaveBeenCalled()
    expect(panelEl()).toBeTruthy()
    expect(
      warn.mock.calls.some((args) => String(args[0]).startsWith('[pill]')),
    ).toBe(true)
    warn.mockRestore()
  })

  test('clicking the opener while open closes the panel', async () => {
    const { container } = render(
      html`<${Pill} selectOptions=${['and', 'or']}>and</${Pill}>`,
    )
    const pill = container.querySelector('.pill-container')
    fireEvent.click(pill)
    expect(panelEl()).toBeTruthy()
    await act(async () => {
      fireEvent.mouseDown(pill)
      fireEvent.click(pill)
    })
    expect(panelEl()).toBeNull()
  })
})
