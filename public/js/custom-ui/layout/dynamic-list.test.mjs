/**
 * Regression test for the DynamicList identity-keying fix.
 *
 * Bug: item wrapper divs were keyed by array *index*, so when the items array
 * reordered (drag reorder, add, delete-from-middle, or a "Load" multi-select
 * that inserts new items), Preact reused the same component instance for a
 * given slot instead of the item now occupying it. Any renderItem callback
 * that seeds local edit state via `useState(item.value)` (a one-time
 * initializer) would then keep showing/saving the previous occupant's
 * unsaved state under the new item's identity.
 *
 * This test renders a DynamicList with a tiny stateful "form" component (the
 * same shape as the real bug-prone renderItem callbacks, e.g. SfxCard) and
 * verifies that inserting a new item before an existing unsaved item does not
 * bleed the unsaved item's typed content onto the new item, and that the
 * unsaved item's typed content stays attached to it.
 */
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { html } from 'htm/preact'
import { DynamicList } from './dynamic-list.mjs'

afterEach(() => cleanup())

// Mirrors the bug-prone pattern in SfxCard/GenreCard/HandyPresetForm: local
// state seeded once from a prop via useState's lazy initializer.
function TestItemForm({ item }) {
  const [value, setValue] = useState(item.text)
  const testId = `input-${item._localId ?? item.uid}`
  return html`
    <input
      data-testid=${testId}
      value=${value}
      onInput=${(e) => setValue(e.target.value)}
    />
  `
}

describe('DynamicList identity keying', () => {
  test('typed content follows item identity, not slot position, across reorders/inserts', () => {
    const initialItems = [
      { uid: 'a', text: 'Item A' },
      { uid: 'b', text: 'Item B' },
      { _localId: 'local-c', text: '' },
    ]

    const { getByTestId, rerender } = render(html`
      <${DynamicList}
        items=${initialItems}
        renderItem=${(item) => html`<${TestItemForm} item=${item} />`}
        createItem=${() => ({})}
        onChange=${() => {}}
      />
    `)

    // Type into the unsaved item's input.
    const localCInput = getByTestId('input-local-c')
    fireEvent.input(localCInput, { target: { value: 'typed by user' } })
    expect(getByTestId('input-local-c').value).toBe('typed by user')

    // Simulate a "Load" that inserts a newly-loaded item before the unsaved one.
    const nextItems = [
      { uid: 'a', text: 'Item A' },
      { uid: 'b', text: 'Item B' },
      { uid: 'd', text: 'Item D' },
      { _localId: 'local-c', text: '' },
    ]

    rerender(html`
      <${DynamicList}
        items=${nextItems}
        renderItem=${(item) => html`<${TestItemForm} item=${item} />`}
        createItem=${() => ({})}
        onChange=${() => {}}
      />
    `)

    // The unsaved item's typed content must still be attached to it, not to
    // whatever now occupies its old array slot.
    expect(getByTestId('input-local-c').value).toBe('typed by user')

    // The newly-inserted item must show its own untouched initial value, not
    // the leftover state from the previous occupant of that slot.
    expect(getByTestId('input-d').value).toBe('Item D')

    // Sanity check: unrelated items are unaffected.
    expect(getByTestId('input-a').value).toBe('Item A')
    expect(getByTestId('input-b').value).toBe('Item B')
  })

  // An item whose `id` is user-editable (workflow editor Extra Inputs) must
  // not remount on every keystroke: default keying uses `id`, so each edit
  // changed the row key and reset the row's state (collapsing its card).
  function IdKeyedForm({ item }) {
    const [value, setValue] = useState('')
    return html`<input
      data-testid="row-input"
      value=${value}
      onInput=${(e) => setValue(e.target.value)}
    />`
  }

  const renderList = (items, getItemKey) =>
    html`<${DynamicList}
      items=${items}
      renderItem=${(item) => html`<${IdKeyedForm} item=${item} />`}
      createItem=${() => ({})}
      onChange=${() => {}}
      getItemKey=${getItemKey}
    />`

  test('getItemKey override keeps a row mounted when its editable id changes', () => {
    const byIndex = (_item, index) => index
    const { getByTestId, rerender } = render(renderList([{ id: 'a' }], byIndex))
    fireEvent.input(getByTestId('row-input'), { target: { value: 'kept' } })

    rerender(renderList([{ id: 'ab' }], byIndex))

    expect(getByTestId('row-input').value).toBe('kept')
  })

  test('default keying remounts a row when its id changes', () => {
    const { getByTestId, rerender } = render(
      renderList([{ id: 'a' }], undefined),
    )
    fireEvent.input(getByTestId('row-input'), { target: { value: 'lost' } })

    rerender(renderList([{ id: 'ab' }], undefined))

    expect(getByTestId('row-input').value).toBe('')
  })
})

// Creating a record replaces the row's `{ _localId }` item with the server's
// `{ uid }` record in place. That changed the row's identity key, remounting
// it: the card collapsed and the form's local state was lost.
describe('DynamicList first save', () => {
  function SaveForm({ item }) {
    const [value, setValue] = useState('')
    return html`<input
      data-testid=${`save-${item.uid ?? item._localId}`}
      value=${value}
      onInput=${(e) => setValue(e.target.value)}
    />`
  }

  const renderList = (items) =>
    html`<${DynamicList}
      items=${items}
      getTitle=${(item) => item.uid ?? item._localId}
      renderItem=${(item) => html`<${SaveForm} item=${item} />`}
      createItem=${() => ({})}
      onChange=${() => {}}
    />`

  const isOpen = (input) => getComputedStyle(input.parentElement).display

  test('a row keeps its expansion and form state when _localId becomes uid', () => {
    const saved = { uid: 'a' }
    const { getByText, getByTestId, rerender } = render(
      renderList([saved, { _localId: 'local-b' }]),
    )
    fireEvent.click(getByText('local-b'))
    fireEvent.input(getByTestId('save-local-b'), { target: { value: 'typed' } })
    expect(isOpen(getByTestId('save-local-b'))).toBe('block')

    rerender(renderList([saved, { uid: 'b' }]))

    expect(getByTestId('save-b').value).toBe('typed')
    expect(isOpen(getByTestId('save-b'))).toBe('block')
  })

  test('a Load that swaps a saved row for a different one still remounts it', () => {
    const { getByTestId, rerender } = render(renderList([{ uid: 'a' }]))
    fireEvent.input(getByTestId('save-a'), { target: { value: 'stale' } })

    rerender(renderList([{ uid: 'c' }]))

    expect(getByTestId('save-c').value).toBe('')
  })
})

describe('DynamicList accordion and pinning', () => {
  const items = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }]

  function setup() {
    const view = render(
      html`<${DynamicList}
        items=${items}
        getTitle=${(item) => `title-${item.uid}`}
        renderItem=${(item) =>
          html`<input data-testid=${`field-${item.uid}`} />`}
        createItem=${() => ({})}
        onChange=${() => {}}
      />`,
    )
    const open = (uid) => fireEvent.click(view.getByText(`title-${uid}`))
    const pin = (uid) =>
      fireEvent.click(
        view.getByText(`title-${uid}`).parentElement.querySelector('button'),
      )
    const isOpen = (uid) =>
      getComputedStyle(view.getByTestId(`field-${uid}`).parentElement)
        .display === 'block'
    const openRows = () => items.map((i) => i.uid).filter(isOpen)
    return { ...view, open, pin, openRows }
  }

  test('opening an unpinned row collapses the other unpinned row', () => {
    const { open, openRows } = setup()
    open('a')
    open('b')
    expect(openRows()).toEqual(['b'])
  })

  test('a header click on the open row collapses it', () => {
    const { open, openRows } = setup()
    open('a')
    open('a')
    expect(openRows()).toEqual([])
  })

  test('a pinned row stays open when other rows open', () => {
    const { open, pin, openRows } = setup()
    open('a')
    pin('a')
    open('b')
    open('c')
    expect(openRows()).toEqual(['a', 'c'])
  })

  test('pinning a collapsed row opens it and leaves the open unpinned row open', () => {
    const { open, pin, openRows } = setup()
    open('a')
    pin('b')
    expect(openRows()).toEqual(['a', 'b'])
  })

  test('unpinning collapses only that row', () => {
    const { open, pin, openRows } = setup()
    open('a')
    pin('b')
    pin('b')
    expect(openRows()).toEqual(['a'])
  })

  test('a header click on a pinned row collapses and unpins it', () => {
    const { open, pin, openRows } = setup()
    pin('a')
    open('a')
    expect(openRows()).toEqual([])
    // No longer pinned, so opening another row now collapses it.
    open('a')
    open('b')
    expect(openRows()).toEqual(['b'])
  })

  test('a collapsed row keeps its typed value', () => {
    const { open, getByTestId } = setup()
    open('a')
    fireEvent.input(getByTestId('field-a'), { target: { value: 'typed' } })
    open('b')
    expect(getByTestId('field-a').value).toBe('typed')
  })

  test('holds the clicked header in place when a row above collapses', () => {
    const { open, getByText } = setup()
    open('a')
    const header = getByText('title-b').parentElement
    const rect = vi
      .spyOn(header, 'getBoundingClientRect')
      .mockReturnValueOnce({ top: 500 })
      .mockReturnValueOnce({ top: 200 })
    document.documentElement.scrollTop = 1000
    open('b')
    expect(document.documentElement.scrollTop).toBe(700)
    rect.mockRestore()
    document.documentElement.scrollTop = 0
  })
})

describe('DynamicList new rows', () => {
  const scroll = vi.fn()

  beforeEach(() => {
    scroll.mockClear()
    Element.prototype.scrollIntoView = scroll
  })
  afterEach(() => {
    delete Element.prototype.scrollIntoView
  })

  const renderList = (items, props = {}) =>
    html`<${DynamicList}
      items=${items}
      getTitle=${(item) => item.uid ?? item._localId ?? item.id}
      renderItem=${(item) =>
        html`<input data-testid=${item.uid ?? item._localId ?? item.id} />`}
      createItem=${() => ({ id: 'added' })}
      onChange=${() => {}}
      ...${props}
    />`

  const isOpen = (input) => getComputedStyle(input.parentElement).display

  test('rows present at first render do not open', () => {
    const { getByTestId } = render(renderList([{ _localId: 'a' }]))
    expect(isOpen(getByTestId('a'))).toBe('none')
    expect(scroll).not.toHaveBeenCalled()
  })

  test('the add button opens the new row', () => {
    function Harness() {
      const [items, setItems] = useState([{ uid: 'a' }])
      return renderList(items, { onChange: setItems })
    }
    const { container, getByTestId } = render(html`<${Harness} />`)
    fireEvent.click(container.querySelector('.dynamic-list-header button'))
    expect(isOpen(getByTestId('added'))).toBe('block')
  })

  test('a single unsaved row added through parent state opens and scrolls to it', () => {
    const before = [{ uid: 'a' }]
    const { getByTestId, rerender } = render(renderList(before))
    rerender(renderList([...before, { _localId: 'clone' }]))
    expect(isOpen(getByTestId('clone'))).toBe('block')
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(scroll.mock.contexts[0].contains(getByTestId('clone'))).toBe(true)
  })

  test('a new row replaces the previously open unpinned row', () => {
    const before = [{ uid: 'a' }]
    const { getByText, getByTestId, rerender } = render(renderList(before))
    fireEvent.click(getByText('a'))
    rerender(renderList([...before, { _localId: 'clone' }]))
    expect(isOpen(getByTestId('a'))).toBe('none')
  })

  test('several unsaved rows arriving together do not open', () => {
    const before = [{ uid: 'a' }]
    const { getByTestId, rerender } = render(renderList(before))
    rerender(renderList([...before, { _localId: 'b' }, { _localId: 'c' }]))
    expect(isOpen(getByTestId('b'))).toBe('none')
    expect(isOpen(getByTestId('c'))).toBe('none')
    expect(scroll).not.toHaveBeenCalled()
  })

  test('a new saved row does not open', () => {
    const before = [{ uid: 'a' }]
    const { getByTestId, rerender } = render(renderList(before))
    rerender(renderList([...before, { uid: 'loaded' }]))
    expect(isOpen(getByTestId('loaded'))).toBe('none')
    expect(scroll).not.toHaveBeenCalled()
  })

  test('a first save does not scroll', () => {
    const { rerender } = render(renderList([{ _localId: 'a' }]))
    rerender(renderList([{ uid: 'a' }]))
    expect(scroll).not.toHaveBeenCalled()
  })

  test('condensed lists do not scroll to a new row', () => {
    const before = [{ uid: 'a' }]
    const { rerender } = render(renderList(before, { condensed: true }))
    rerender(
      renderList([...before, { _localId: 'clone' }], { condensed: true }),
    )
    expect(scroll).not.toHaveBeenCalled()
  })
})

describe('DynamicList drag', () => {
  function Harness() {
    const [items, setItems] = useState([{ uid: 'a' }, { uid: 'b' }])
    return html`<${DynamicList}
      items=${items}
      getTitle=${(item) => `title-${item.uid}`}
      renderItem=${(item) => html`<${TestItemForm} item=${item} />`}
      createItem=${() => ({})}
      onChange=${setItems}
    />`
  }

  const startDrag = (view, uid) => {
    const header = view.getByText(`title-${uid}`).parentElement
    // Pin, then the drag handle, then delete.
    fireEvent.mouseDown(header.querySelectorAll('button')[1])
  }

  test('typed input and open state survive a drag and drop', () => {
    const view = render(html`<${Harness} />`)
    fireEvent.click(view.getByText('title-a'))
    const input = view.getByTestId('input-a')
    fireEvent.input(input, { target: { value: 'typed' } })

    startDrag(view, 'b')
    expect(view.getByTestId('input-a')).toBe(input)

    fireEvent.mouseMove(window, { clientY: 1 })
    fireEvent.mouseUp(window)

    expect(view.getByTestId('input-a')).toBe(input)
    expect(input.value).toBe('typed')
    expect(getComputedStyle(input.parentElement).display).toBe('block')
  })

  test('the dragged row stays mounted with its typed value', () => {
    const view = render(html`<${Harness} />`)
    const input = view.getByTestId('input-a')
    fireEvent.input(input, { target: { value: 'typed' } })

    startDrag(view, 'a')
    expect(view.getByTestId('input-a')).toBe(input)
    expect(input.closest('[hidden]')).not.toBeNull()

    fireEvent.mouseUp(window)
    expect(input.closest('[hidden]')).toBeNull()
    expect(input.value).toBe('typed')
  })
})

describe('DynamicList leadingContent', () => {
  test('renders between the header row and the first item', () => {
    const { container } = render(html`
      <${DynamicList}
        title="List"
        items=${[{ _localId: 'a', text: 'first item' }]}
        renderItem=${(item) => html`<span data-testid="item">${item.text}</span>`}
        createItem=${() => ({ _localId: 'b', text: '' })}
        onChange=${() => {}}
        condensed
        leadingContent=${html`<div data-testid="leading">leading</div>`}
      />
    `)
    const header = container.querySelector('.dynamic-list-header')
    const leading = container.querySelector('[data-testid="leading"]')
    const item = container.querySelector('[data-testid="item"]')
    expect(leading.textContent).toBe('leading')
    // DOCUMENT_POSITION_FOLLOWING (4): the second node comes after the first.
    expect(header.compareDocumentPosition(leading) & 4).toBe(4)
    expect(leading.compareDocumentPosition(item) & 4).toBe(4)
  })
})
