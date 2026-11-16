import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, act, cleanup, fireEvent } from '@testing-library/preact'
import { html } from 'htm/preact'

import { showModal } from '../overlays/modal.mjs'
import { Select } from './select.mjs'
import { MultiSelect } from './multi-select.mjs'
import { PillSelectPanel } from './pill-select-panel.mjs'

/**
 * An element's `z-index`: its computed style when resolved, else the value
 * in the goober rule for one of its classes (happy-dom may not cascade
 * goober's injected sheet).
 */
function zIndexOf(el) {
  const computed = getComputedStyle(el).zIndex
  if (computed && computed !== 'auto') return Number(computed)
  const sheet = document.getElementById('_goober')?.textContent ?? ''
  for (const cls of el.classList) {
    const rule = sheet.match(new RegExp(`\\.${cls}\\{([^}]*)\\}`))
    const z = rule?.[1].match(/z-index:\s*(-?\d+)/)
    if (z) return Number(z[1])
  }
  return NaN
}

/** The highest `z-index` among an element's ancestors: the modal overlay's. */
function overlayZIndex(el) {
  let max = NaN
  for (let node = el.parentElement; node; node = node.parentElement) {
    const z = zIndexOf(node)
    if (!Number.isNaN(z) && !(z <= max)) max = z
  }
  return max
}

const OPTIONS = [
  { label: 'First', value: 'a' },
  { label: 'Second', value: 'b' },
]

describe('field dropdowns inside a modal', () => {
  let modal
  afterEach(() => {
    modal?.close?.()
    modal = null
    cleanup()
  })

  test('a Select opened in a modal sits above the overlay and its option clicks', async () => {
    const onChange = vi.fn()
    await act(async () => {
      modal = showModal({
        title: 'Pick',
        content: html`<${Select}
          options=${OPTIONS}
          value="a"
          onChange=${onChange}
        />`,
      })
    })
    const trigger = document.querySelector('.select-trigger')
    const overlayZ = overlayZIndex(trigger)
    expect(overlayZ).toBe(10000)
    await act(async () => {
      fireEvent.click(trigger)
    })
    const popover = document.querySelector('.select-popover')
    expect(popover).toBeTruthy()
    expect(zIndexOf(popover)).toBeGreaterThan(overlayZ)
    const second = [...popover.querySelectorAll('.select-option-row')].find(
      (row) => row.textContent.includes('Second'),
    )
    await act(async () => {
      fireEvent.click(second)
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { value: 'b' } }),
    )
  })

  test('a MultiSelect opened in a modal sits above the overlay', async () => {
    await act(async () => {
      modal = showModal({
        title: 'Pick',
        content: html`<${MultiSelect}
          options=${OPTIONS}
          value=${[]}
          onChange=${() => {}}
        />`,
      })
    })
    const trigger = document.querySelector('.multi-select-trigger')
    const overlayZ = overlayZIndex(trigger)
    expect(overlayZ).toBe(10000)
    await act(async () => {
      fireEvent.click(trigger)
    })
    const popover = document.querySelector('.multi-select-popover')
    expect(popover).toBeTruthy()
    expect(zIndexOf(popover)).toBeGreaterThan(overlayZ)
  })

  test('an open PillSelectPanel in a modal sits above the overlay and below tooltips', async () => {
    await act(async () => {
      modal = showModal({
        title: 'Pick',
        content: html`<span class="panel-host"
          ><${PillSelectPanel}
            anchorRect=${{ top: 10, bottom: 30, left: 10, width: 40 }}
            options=${['a', 'b']}
            value="a"
            onSelect=${() => {}}
            onClose=${() => {}}
        /></span>`,
      })
    })
    const host = document.querySelector('.panel-host')
    const overlayZ = overlayZIndex(host)
    expect(overlayZ).toBe(10000)
    const panel = document.querySelector('[data-pill-select-panel]')
    expect(panel).toBeTruthy()
    expect(zIndexOf(panel)).toBeGreaterThan(overlayZ)
    // The tooltip layer (TooltipProvider's tooltip) sits at 30000.
    expect(zIndexOf(panel)).toBeLessThan(30000)
  })
})
