/**
 * ListSelectModal search filter.
 *
 * The `searchable` prop filters rows by label and disables every reorder
 * handle while filter text is present — drag indices address the full,
 * unfiltered items array, so a drag must never start on a filtered view.
 */
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import { html } from 'htm/preact'
import ListSelectModal from './list-select.mjs'

afterEach(() => cleanup())

const ITEMS = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'alphabet', label: 'Alphabet' },
]

function renderModal(props = {}) {
  return render(html`
    <${ListSelectModal}
      isOpen=${true}
      items=${ITEMS}
      onReorder=${() => {}}
      searchable=${true}
      ...${props}
    />
  `)
}

const rowLabels = (container) =>
  Array.from(container.querySelectorAll('.item-name')).map(
    (el) => el.textContent,
  )

const reorderHandles = (container) =>
  Array.from(container.querySelectorAll('span[aria-label="swap_vert"]')).map(
    (el) => el.closest('button'),
  )

const searchInput = (container) => container.querySelector('input')

describe('ListSelectModal searchable', () => {
  test('typing filters rows by label, preserving original order', () => {
    const { container } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: 'alp' } })
    expect(rowLabels(container)).toEqual(['Alpha', 'Alphabet'])
  })

  test('every reorder handle is disabled while filtered', () => {
    const { container } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: 'alp' } })
    const handles = reorderHandles(container)
    expect(handles).toHaveLength(2)
    handles.forEach((btn) => expect(btn.disabled).toBe(true))
  })

  test('clear button restores all rows with enabled reorder handles', () => {
    const { container } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: 'alp' } })
    const clear = container.querySelector('button[title="Clear search"]')
    expect(clear).not.toBeNull()
    fireEvent.click(clear)
    expect(rowLabels(container)).toEqual(['Alpha', 'Beta', 'Alphabet'])
    const handles = reorderHandles(container)
    expect(handles).toHaveLength(3)
    handles.forEach((btn) => expect(btn.disabled).toBe(false))
  })

  test('no-match filter shows a no-matches message', () => {
    const { container } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: 'zzz' } })
    expect(rowLabels(container)).toEqual([])
    expect(container.textContent).toContain('No matches for "zzz"')
  })

  test('whitespace-only filter counts as unfiltered', () => {
    const { container } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: '   ' } })
    expect(rowLabels(container)).toEqual(['Alpha', 'Beta', 'Alphabet'])
    reorderHandles(container).forEach((btn) => expect(btn.disabled).toBe(false))
  })

  test('no search input renders without searchable', () => {
    const { container } = renderModal({ searchable: false })
    expect(searchInput(container)).toBeNull()
    expect(rowLabels(container)).toEqual(['Alpha', 'Beta', 'Alphabet'])
  })

  test('reopening the modal resets the filter', () => {
    const { container, rerender } = renderModal()
    fireEvent.input(searchInput(container), { target: { value: 'alp' } })
    const props = { items: ITEMS, onReorder: () => {}, searchable: true }
    rerender(html`<${ListSelectModal} isOpen=${false} ...${props} />`)
    rerender(html`<${ListSelectModal} isOpen=${true} ...${props} />`)
    expect(searchInput(container).value).toBe('')
    expect(rowLabels(container)).toEqual(['Alpha', 'Beta', 'Alphabet'])
  })
})
