/**
 * dynamic-list.mjs – Reusable dynamic list with add/delete/reorder operations.
 *
 * Each item is rendered inside a collapsible panel with up/down/delete controls.
 * A caller-supplied render function generates the sub-form for each item.
 * An optional `title` prop renders a section header row with the add button
 * aligned to the right edge of that row.
 *
 * Drag-to-reorder: pressing the swap-vertical handle collapses the item into a
 * slim ghost that follows the mouse. Releasing drops it in the hovered position.
 *
 * @module custom-ui/layout/dynamic-list
 */
import { html } from 'htm/preact'
import { useState, useCallback, useRef, useLayoutEffect } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { Button } from '../io/button.mjs'
import { Checkbox } from '../io/checkbox.mjs'
import { Select } from '../io/select.mjs'
import { Icon } from '../layout/icon.mjs'
import { HorizontalLayout, RowTitle } from '../themed-base.mjs'

// ============================================================================
// Styled Components
// ============================================================================

const ListRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.medium.gap};
  position: relative;
`
ListRoot.className = 'dynamic-list-root'

const ListHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0;
`
ListHeader.className = 'dynamic-list-header'

const ItemShell = styled('div')`
  border: ${(props) => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  border-radius: ${(props) => props.theme.border.radius.medium};
  background-color: ${(props) => props.theme.colors.background.card};
  overflow: hidden;
`
ItemShell.className = 'dynamic-list-item-shell'

const ItemHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.medium.gap};
  padding: ${(props) => props.theme.spacing.medium.padding};
  background-color: ${(props) => props.theme.colors.background.secondary};
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: ${(props) => props.theme.colors.background.hover};
  }
`
ItemHeader.className = 'dynamic-list-item-header'

const ItemTitle = styled('span')`
  flex: 1;
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.fontSize.medium};
  font-weight: ${(props) => props.theme.typography.fontWeight.medium};
  color: ${(props) => props.theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
ItemTitle.className = 'dynamic-list-item-title'

const ItemBody = styled('div')`
  padding: ${(props) => props.theme.spacing.large.padding};
  display: ${(props) => (props.collapsed ? 'none' : 'block')};
`
ItemBody.className = 'dynamic-list-item-body'

const CondensedItemRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.medium.gap};
`
CondensedItemRow.className = 'dynamic-list-condensed-item-row'

const CondensedItemContent = styled('div')`
  flex: 1;
  min-width: 0;
`
CondensedItemContent.className = 'dynamic-list-condensed-item-content'

// Ghost overlay that floats under the cursor while dragging
const DragGhost = styled('div')`
  position: fixed;
  pointer-events: none;
  z-index: 10000;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  width: ${(props) => props.width}px;
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.medium.gap};
  padding: ${(props) => props.theme.spacing.medium.padding};
  min-height: 44px;
  border: ${(props) => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.accent || props.theme.colors.border.secondary}`};
  border-radius: ${(props) => props.theme.border.radius.medium};
  background-color: ${(props) => props.theme.colors.background.secondary};
  box-shadow: ${(props) => props.theme.shadow.elevated};
  opacity: 0.92;
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.fontSize.medium};
  font-weight: ${(props) => props.theme.typography.fontWeight.medium};
  color: ${(props) => props.theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
DragGhost.className = 'dynamic-list-drag-ghost'

// Placeholder shown in the list while dragging
const DragPlaceholder = styled('div')`
  border: 2px dashed ${(props) => props.theme.colors.border.secondary};
  border-radius: ${(props) => props.theme.border.radius.medium};
  min-height: 44px;
  background: transparent;
`
DragPlaceholder.className = 'dynamic-list-drag-placeholder'

// ============================================================================
// DynamicListItem Component
// ============================================================================

// Identity-based key: prefer stable identity fields over array position so
// Preact does not reuse a component instance for the wrong item after a
// reorder/insert/delete shifts what occupies a given slot.
function itemKey(item, index) {
  return item?.uid ?? item?._localId ?? item?.id ?? index
}

const isUnsaved = (item) => item?.uid == null && item?._localId != null

/**
 * Row keys that survive an unsaved row's first save. Creating a record swaps
 * the row's `{ _localId }` item for the server's `{ uid }` record in place, so
 * its identity key changes and Preact would remount the row — collapsing the
 * card and dropping its form state. The previous row key carries over only on
 * that exact transition: the item in the same slot was unsaved last render,
 * its key is gone now, and the item now there has a `uid` the list has never
 * held. A Load or reorder that moves already-known items never matches, so
 * the identity keying above still holds for them.
 */
function useStableRowKeys(items, getItemKey) {
  const prevRef = useRef({ rows: [], rowKeyById: new Map() })
  const prev = prevRef.current
  const ids = items.map((item, index) => getItemKey(item, index))
  const currentIds = new Set(ids)
  const prevIds = new Set(prev.rows.map((r) => r.id))
  const used = new Set()
  const rowKeyById = new Map()
  const rows = items.map((item, index) => {
    const id = ids[index]
    let rowKey = prev.rowKeyById.get(id)
    const before = prev.rows[index]
    if (
      rowKey === undefined &&
      before?.unsaved &&
      item?.uid != null &&
      !prevIds.has(id) &&
      !currentIds.has(before.id)
    ) {
      rowKey = before.rowKey
    }
    if (rowKey === undefined || used.has(rowKey)) rowKey = id
    used.add(rowKey)
    rowKeyById.set(id, rowKey)
    return { id, rowKey, unsaved: isUnsaved(item) }
  })
  prevRef.current = { rows, rowKeyById }
  return rows.map((r) => r.rowKey)
}

/** The element whose scrollTop moves `el`: its nearest scrollable ancestor, else the document. */
function findScrollParent(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
  }
  return document.scrollingElement ?? document.documentElement
}

function DynamicListItem({
  item,
  index,
  total,
  title,
  headerContent,
  renderItem,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  collapsed,
  pinned,
  onToggleCollapsed,
  onTogglePin,
  isDragTarget,
  showDragButton,
  showMoveUpDownButtons,
  upDisabled,
  headerActions,
  getEnabled,
  onToggleEnabled,
  getHeaderSelectOptions,
  getHeaderSelectValue,
  onHeaderSelectChange,
  getHeaderSelectTooltip,
  deleteIcon = 'trash',
  deleteTooltip,
  hideDelete = false,
  theme,
}) {
  const stopProp = useCallback((e) => e.stopPropagation(), [])

  const handleDragMouseDown = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      onDragStart(e, index, title)
    },
    [onDragStart, index, title],
  )

  const handleToggleEnabled = useCallback(
    (e) => {
      e.stopPropagation()
      if (onToggleEnabled) onToggleEnabled(item, index)
    },
    [item, index, onToggleEnabled],
  )

  return html`
    <${ItemShell} theme=${theme} style=${isDragTarget ? { opacity: 0.3 } : {}}>
      <${ItemHeader} theme=${theme} onClick=${onToggleCollapsed}>
        <${Icon}
          name=${collapsed ? 'chevron-right' : 'chevron-down'}
          size="16px"
          color=${theme.colors.text.secondary}
        />
        ${
          getEnabled != null &&
          html`
            <div
              onClick=${(e) => {
                e.stopPropagation()
                // The <label> inside Checkbox dispatches a synthetic click to its hidden <input>
                // after the original click. That synthetic click also bubbles here — skip it to
                // avoid toggling twice and landing back on the original state.
                if (e.target.type === 'checkbox') return
                if (onToggleEnabled) onToggleEnabled(item, index)
              }}
            >
              <${Checkbox}
                checked=${getEnabled(item, index)}
                onChange=${() => {}}
              />
            </div>
          `
        }
        <${ItemTitle} theme=${theme}>${headerContent ?? title}</${ItemTitle}>
        <div onClick=${stopProp} style=${`display:flex;gap:${theme.spacing.small.gap};align-items:center;`}>
          ${
            getHeaderSelectOptions &&
            html`
              <${Select}
                options=${getHeaderSelectOptions(item, index)}
                value=${getHeaderSelectValue ? getHeaderSelectValue(item, index) : ''}
                onChange=${(e) => onHeaderSelectChange && onHeaderSelectChange(item, index, e.target.value)}
                tooltip=${getHeaderSelectTooltip ? getHeaderSelectTooltip(item, index) : null}
                size="small"
              />
            `
          }
          ${
            headerActions &&
            headerActions.map(
              (action) => html`
                <${Button}
                  size="small"
                  icon=${action.icon}
                  disabled=${action.getDisabled ? action.getDisabled(item, index) : false}
                  onClick=${(e) => {
                    e.stopPropagation()
                    action.onClick(item, index)
                  }}
                  tooltip=${action.title}
                />
              `,
            )
          }
          <${Button}
            size="small"
            icon=${pinned ? 'pin' : 'pin-off'}
            color=${pinned ? 'primary' : undefined}
            onClick=${(e) => {
              e.stopPropagation()
              onTogglePin()
            }}
            tooltip=${pinned ? 'Unpin' : 'Pin open'}
          />
          ${
            showDragButton &&
            html`
              <${Button}
                size="small"
                icon="swap-vertical"
                onMouseDown=${handleDragMouseDown}
                tooltip="Reorder"
                style=${{ cursor: 'grab' }}
              />
            `
          }
          ${
            showMoveUpDownButtons &&
            html`
              <${Button}
                size="small"
                icon="up-arrow"
                disabled=${upDisabled ?? index === 0}
                onClick=${onMoveUp}
                tooltip="Move up"
              />
              <${Button}
                size="small"
                icon="down-arrow"
                disabled=${index === total - 1}
                onClick=${onMoveDown}
                tooltip="Move down"
              />
            `
          }
          ${
            !hideDelete &&
            html`
              <${Button}
                size="small"
                icon=${deleteIcon}
                color="danger"
                onClick=${onDelete}
                tooltip=${deleteTooltip ?? 'Delete'}
              />
            `
          }
        </div>
      </${ItemHeader}>
      <${ItemBody} theme=${theme} collapsed=${collapsed}>
        ${renderItem(item, index)}
      </${ItemBody}>
    </${ItemShell}>
  `
}

// ============================================================================
// CondensedDynamicListItem Component
// ============================================================================

/**
 * Condensed variant: no panel/shell, no collapse toggle.
 * Content sits directly to the left of the action buttons in a single row.
 */
function CondensedDynamicListItem({
  item,
  index,
  total,
  renderItem,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  isDragTarget,
  showDragButton,
  showMoveUpDownButtons,
  upDisabled,
  headerActions,
  getEnabled,
  onToggleEnabled,
  deleteIcon = 'trash',
  deleteTooltip,
  hideDelete = false,
  theme,
}) {
  const handleDragMouseDown = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      // For condensed mode, pass generic label
      onDragStart(e, index, `Item ${index + 1}`)
    },
    [onDragStart, index],
  )

  return html`
    <${CondensedItemRow} theme=${theme} style=${isDragTarget ? { opacity: 0.3 } : {}}>
      ${
        getEnabled != null &&
        html`
          <${Checkbox}
            checked=${getEnabled(item, index)}
            onChange=${() => {
              if (onToggleEnabled) onToggleEnabled(item, index)
            }}
          />
        `
      }
      <${CondensedItemContent}>
        ${renderItem(item, index)}
      </${CondensedItemContent}>
      <${HorizontalLayout} gap="small">
        ${
          headerActions &&
          headerActions.map(
            (action) => html`
              <${Button}
                size="small"
                icon=${action.icon}
                onClick=${(e) => {
                  e.stopPropagation()
                  action.onClick(item, index)
                }}
                tooltip=${action.title}
              />
            `,
          )
        }
        ${
          showDragButton &&
          html`
            <${Button}
              size="small"
              icon="swap-vertical"
              onMouseDown=${handleDragMouseDown}
              tooltip="Reorder"
              style=${{ cursor: 'grab' }}
            />
          `
        }
        ${
          showMoveUpDownButtons &&
          html`
            <${Button}
              size="small"
              icon="up-arrow"
              disabled=${upDisabled ?? index === 0}
              onClick=${onMoveUp}
              tooltip="Move up"
            />
            <${Button}
              size="small"
              icon="down-arrow"
              disabled=${index === total - 1}
              onClick=${onMoveDown}
              tooltip="Move down"
            />
          `
        }
        ${
          !hideDelete &&
          html`
            <${Button}
              size="small"
              icon=${deleteIcon}
              color="danger"
              onClick=${onDelete}
              tooltip=${deleteTooltip ?? 'Delete'}
            />
          `
        }
      </${HorizontalLayout}>
    </${CondensedItemRow}>
  `
}

// ============================================================================
// DynamicList Component
// ============================================================================

/**
 * DynamicList – Generic ordered list with add / delete / reorder controls.
 *
 * When `title` is provided, it renders a header row with the title on the left
 * and the add button on the right (`size="small"`). Without a title, the
 * add button renders inline above the items.
 *
 * When `condensed` is true, items are rendered without a panel container or
 * collapse toggle. Content sits directly to the left of the action buttons.
 * This mode is suited for compact sub-lists (e.g. string arrays, simple mappings).
 *
 * Expansion: at most one unpinned item is open at a time, and opening another
 * collapses it. The header's pin button keeps an item open independently of
 * that limit; unpinning collapses it. A row is opened and scrolled into view
 * when the list's add button fills it, or when exactly one unsaved
 * (`_localId`, no `uid`) row appears in `items`, so a caller's create or clone
 * needs no extra wiring.
 *
 * Drag-to-reorder: clicking the swap-vertical button collapses the item into a
 * slim ghost that follows the mouse. Moving over other items reorders the list
 * live. Releasing the mouse commits the final position.
 *
 * @param {Object}   props
 * @param {string}   [props.title]               - Optional section title rendered in the header row.
 * @param {preact.VNode} [props.leadingContent]  - Optional content rendered between the header row and the items. It is not an item: it cannot be dragged, deleted, or reordered, and drop positions ignore it.
 * @param {Array}    props.items                 - Array of item data objects.
 * @param {Function} props.renderItem            - `(item, index) => VNode` sub-form renderer.
 * @param {Function} [props.getTitle]            - `(item, index) => string` item header label; also used as the drag-ghost label (unused in condensed mode).
 * @param {Function} [props.getHeaderContent]   - `(item, index) => VNode` optional richer header content; overrides the `getTitle` text in the header while `getTitle` still drives the drag ghost label.
 * @param {Function} props.createItem            - `() => Object` factory for a blank new item.
 * @param {Function} props.onChange              - `(items) => void` called on every mutation.
 * @param {string}   [props.addLabel]            - Label for the add button (default "Add item").
 * @param {boolean}  [props.condensed=false]     - Use condensed inline layout (no panel, no collapse).
 * @param {boolean}  [props.showDragButton=true] - Show the drag-to-reorder handle button.
 * @param {boolean}  [props.showMoveUpDownButtons=false] - Show the move-up / move-down buttons.
 * @param {boolean}  [props.hideAddItem=false]   - Hide the add button entirely.
 * @param {boolean}  [props.hideDelete=false]    - Hide the per-item delete button entirely.
 * @param {Array}    [props.headerActions]       - Custom header action buttons: `[{ icon, title, onClick(item, index) }]`.
 * @param {string}   [props.deleteIcon='trash']  - Icon name for the delete button.
 * @param {string}   [props.deleteTooltip]         - Tooltip text for the icon-only (`size="small"`) delete button. Defaults to 'Delete'.
 * @param {Function} [props.getHeaderSelectOptions]  - `(item, index) => [{label, value}]` — when provided, renders a compact Select in each item header.
 * @param {Function} [props.getHeaderSelectValue]    - `(item, index) => string` — current value for the header Select.
 * @param {Function} [props.onHeaderSelectChange]    - `(item, index, value) => void` — called when the header Select changes.
 * @param {Function} [props.getHeaderSelectTooltip]  - `(item, index) => string|null` — optional tooltip for the header Select.
 * @param {Function} [props.onDelete]              - `(item, index) => void` — when provided, called instead of the built-in item removal. The caller is responsible for updating `items` via `onChange`.
 * @param {Function} [props.canDrop]               - `(fromIndex, toIndex) => bool` — when provided, called before committing a drag-drop or move-up; returning `false` cancels the operation. Also disables the move-up button at index i when `canDrop(i, i-1)` returns `false`.
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${DynamicList}
 *     title="Extra Inputs"
 *     items=${extraInputs}
 *     renderItem=${(item, i) => html`<${ExtraInputForm} item=${item} index=${i} onChange=${handleChange} />`}
 *     getTitle=${(item) => item.label || 'Untitled'}
 *     createItem=${() => ({ id: '', type: 'text', label: '', default: '' })}
 *     getItemKey=${(_item, index) => index} // `id` is user-editable here
 *     onChange=${setExtraInputs}
 *     addLabel="Add Input"
 *   />
 * `
 */
export function DynamicList({
  title,
  leadingContent = null,
  items = [],
  renderItem,
  getTitle,
  getHeaderContent, // optional: (item, index) => VNode — richer header; overrides getTitle display
  createItem,
  onChange,
  addLabel = 'Add item',
  condensed = false,
  onAdd, // optional: () => void – replaces default handleAdd when provided
  showDragButton = true, // show the swap-vertical drag handle
  showMoveUpDownButtons = false, // show the up/down arrow buttons
  hideAddItem = false, // hide the add button entirely
  hideDelete = false, // hide the per-item delete button entirely
  headerActions, // custom header action buttons
  getEnabled, // optional: (item, index) => boolean – enables per-item toggle checkbox
  onToggleEnabled, // optional: (item, index) => void – called when enabled checkbox changes
  deleteIcon = 'trash', // icon name for the per-item delete button
  deleteTooltip, // optional tooltip text for the delete button
  getHeaderSelectOptions, // optional: (item, index) => [{label, value}] — renders a Select in the item header
  getHeaderSelectValue, // optional: (item, index) => string
  onHeaderSelectChange, // optional: (item, index, value) => void
  getHeaderSelectTooltip, // optional: (item, index) => string|null — tooltip for the header Select
  onDelete, // optional: (item, index) => void — replaces built-in removal; caller updates items via onChange
  canDrop, // optional: (fromIndex, toIndex) => bool — cancels drag/move-up when false
  getItemKey = itemKey, // optional: (item, index) => key — override when an item's `id` is user-editable, so edits don't remount (and collapse) the row
}) {
  const theme = currentTheme.value

  // The slot handleAdd just filled. Items with no `_localId` cannot be told
  // apart from hydrated rows by their shape, so the list's own add records it.
  const newlyAddedIndexRef = useRef(null)
  const prevRowKeysRef = useRef(null)

  const rowKeys = useStableRowKeys(items, getItemKey)

  // ── Expansion ─────────────────────────────────────────────────────────────
  // Invariant: at most one unpinned row is open, and every pinned row is open.
  // Rows stay mounted while collapsed, so collapsing never loses form state.
  const [openKey, setOpenKey] = useState(null)
  const [pinnedKeys, setPinnedKeys] = useState(() => new Set())

  // Set by a header click that opens a row: the header and its viewport top.
  const scrollAnchorRef = useRef(null)
  // The new row waiting to be scrolled to once it has rendered open.
  const newRowScrollKeyRef = useRef(null)

  const unpin = (rowKey) =>
    setPinnedKeys((prev) => {
      const next = new Set(prev)
      next.delete(rowKey)
      return next
    })

  const handleToggleCollapsed = (rowKey, e) => {
    if (pinnedKeys.has(rowKey)) {
      unpin(rowKey)
    } else if (openKey === rowKey) {
      setOpenKey(null)
    } else {
      scrollAnchorRef.current = {
        element: e.currentTarget,
        top: e.currentTarget.getBoundingClientRect().top,
      }
      setOpenKey(rowKey)
    }
  }

  const handleTogglePin = (rowKey) => {
    if (pinnedKeys.has(rowKey)) {
      unpin(rowKey)
      return
    }
    setPinnedKeys((prev) => new Set(prev).add(rowKey))
    if (openKey === rowKey) setOpenKey(null)
  }

  const expansionProps = (rowKey) => ({
    collapsed: rowKey !== openKey && !pinnedKeys.has(rowKey),
    pinned: pinnedKeys.has(rowKey),
    onToggleCollapsed: (e) => handleToggleCollapsed(rowKey, e),
    onTogglePin: () => handleTogglePin(rowKey),
  })

  // Create and clone paths mostly live in the caller, so a new row is inferred
  // from the keys: the slot handleAdd filled, or a single unsaved row that was
  // not here last render. Load (saved records) and hydration (several rows at
  // once) do not match, and a first save keeps its row key so it cannot.
  const findNewRowKey = () => {
    const addedByList = rowKeys[newlyAddedIndexRef.current]
    if (addedByList !== undefined) return addedByList
    if (!prevRowKeysRef.current) return undefined
    const known = new Set(prevRowKeysRef.current)
    const appeared = rowKeys.filter((key) => !known.has(key))
    if (appeared.length !== 1) return undefined
    return isUnsaved(items[rowKeys.indexOf(appeared[0])])
      ? appeared[0]
      : undefined
  }

  // Runs before paint, so an added row never shows collapsed and a removed
  // row's key cannot match a later row that happens to reuse it.
  useLayoutEffect(() => {
    const addedKey = condensed ? undefined : findNewRowKey()
    if (rowKeys[newlyAddedIndexRef.current] !== undefined) {
      newlyAddedIndexRef.current = null
    }
    prevRowKeysRef.current = rowKeys
    if (addedKey !== undefined) {
      newRowScrollKeyRef.current = addedKey
      setOpenKey(addedKey)
    } else if (openKey !== null && !rowKeys.includes(openKey)) {
      setOpenKey(null)
    }
    if ([...pinnedKeys].some((key) => !rowKeys.includes(key))) {
      setPinnedKeys(
        new Set([...pinnedKeys].filter((key) => rowKeys.includes(key))),
      )
    }
  })

  // An open row above the clicked one collapsing would pull the clicked header
  // up and away from the cursor; scroll by that shift to hold it in place.
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    scrollAnchorRef.current = null
    const shift = anchor.element.getBoundingClientRect().top - anchor.top
    if (shift !== 0) findScrollParent(anchor.element).scrollTop += shift
  }, [openKey])

  // Waits for the render that opened the row, so the collapse of the previous
  // open row is already in the layout it scrolls against.
  useLayoutEffect(() => {
    if (newRowScrollKeyRef.current === null) return
    if (newRowScrollKeyRef.current !== openKey) return
    newRowScrollKeyRef.current = null
    const wrappers = document
      .getElementById(listId)
      ?.querySelectorAll(':scope > [data-dli]')
    wrappers?.[rowKeys.indexOf(openKey)]?.scrollIntoView?.({
      block: 'start',
      behavior: 'smooth',
    })
  }, [openKey])

  // Keep a ref to items so drag handlers always see the latest array.
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Stable id so we can find the list DOM node via document.getElementById.
  const listIdRef = useRef(
    'dynamic-list-' + Math.random().toString(36).slice(2),
  )
  const listId = listIdRef.current

  // ── Drag state ────────────────────────────────────────────────────────────
  // All kept in refs so mouse-move handlers don't cause re-renders.
  const dragRef = useRef({
    active: false,
    fromIndex: -1,
    toIndex: -1,
    title: '',
    ghostX: 0,
    ghostY: 0,
    offsetX: 0, // cursor offset from item's left edge
    offsetY: 0, // cursor offset from item's top edge
    listWidth: 0,
  })

  // The only state needed for rendering: ghost position + which indices are involved.
  const [dragState, setDragState] = useState(null) // null = not dragging
  // dragState shape: { fromIndex, toIndex, ghostX, ghostY, width, title }

  // ── Standard mutations ────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    newlyAddedIndexRef.current = items.length
    onChange([...items, createItem()])
  }, [items, createItem, onChange])

  const handleDelete = useCallback(
    (index) => {
      const next = items.filter((_, i) => i !== index)
      onChange(next)
    },
    [items, onChange],
  )

  const handleMoveUp = useCallback(
    (index) => {
      if (index === 0) return
      if (canDrop && !canDrop(index, index - 1)) return
      const next = [...items]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      onChange(next)
    },
    [items, onChange, canDrop],
  )

  const handleMoveDown = useCallback(
    (index) => {
      if (index === items.length - 1) return
      const next = [...items]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      onChange(next)
    },
    [items, onChange],
  )

  // ── Drag helpers ──────────────────────────────────────────────────────────

  /**
   * Compute which virtual drop index the cursor is hovering over.
   *
   * We query only the non-source [data-dli] wrappers (i.e. the N-1 items that
   * are NOT being dragged). This gives us a clean "virtual array" of slots 0..N-1
   * where N-1 means "after all items".
   *
   * The physical position where the placeholder is inserted is then:
   *   toIndex < fromIndex  → before physical item at toIndex
   *   toIndex >= fromIndex → before physical item at toIndex+1 (or at end)
   */
  const computeDropIndex = useCallback(
    (clientY) => {
      const root = document.getElementById(listId)
      if (!root) return 0
      // All [data-dli] children are the N-1 non-source items (the source stays mounted but drops data-dli during a drag).
      const children = Array.from(root.querySelectorAll(':scope > [data-dli]'))
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        if (clientY < mid) return i
      }
      // Cursor is past every item → "append at end" slot
      return children.length
    },
    [listId],
  )

  const handleDragStart = useCallback(
    (e, index, itemTitle) => {
      const root = document.getElementById(listId)
      if (!root) return

      const itemElements = Array.from(
        root.querySelectorAll(':scope > [data-dli]'),
      )
      const itemElement = itemElements[index]
      if (!itemElement) return

      const itemRect = itemElement.getBoundingClientRect()
      const listRect = root.getBoundingClientRect()

      const offsetX = e.clientX - itemRect.left
      const offsetY = e.clientY - itemRect.top

      const ghostX = itemRect.left
      const ghostY = itemRect.top

      dragRef.current = {
        active: true,
        fromIndex: index,
        toIndex: index,
        title: itemTitle,
        ghostX,
        ghostY,
        offsetX,
        offsetY,
        listWidth: listRect.width,
      }

      setDragState({
        fromIndex: index,
        toIndex: index,
        ghostX,
        ghostY,
        width: listRect.width,
        title: itemTitle,
      })

      const onMouseMove = (ev) => {
        const dr = dragRef.current
        if (!dr.active) return

        // Ghost position = mouse position - offset to maintain pickup point
        const gx = ev.clientX - dr.offsetX
        const gy = ev.clientY - dr.offsetY
        dr.ghostX = gx
        dr.ghostY = gy

        const newTo = computeDropIndex(ev.clientY)
        if (newTo !== dr.toIndex) {
          dr.toIndex = newTo
        }

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                toIndex: newTo,
                ghostX: gx,
                ghostY: gy,
              }
            : null,
        )
      }

      const onMouseUp = () => {
        const dr = dragRef.current
        if (!dr.active) return
        dr.active = false

        const from = dr.fromIndex
        const to = dr.toIndex

        setDragState(null)

        if (from !== to && (!canDrop || canDrop(from, to))) {
          // Use itemsRef.current so we never capture a stale items array.
          const next = [...itemsRef.current]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          onChange(next)
        }

        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [items, onChange, computeDropIndex],
  )

  // ── Add button ────────────────────────────────────────────────────────────

  const addButton = hideAddItem
    ? null
    : html`
    <${Button}
      size="small"
      icon="plus"
      color="secondary"
      onClick=${onAdd ?? handleAdd}
    >
    </${Button}>
  `

  // ── Drag ghost overlay ────────────────────────────────────────────────────

  const ghostOverlay = dragState
    ? html`
    <${DragGhost}
      theme=${theme}
      x=${dragState.ghostX}
      y=${dragState.ghostY}
      width=${dragState.width}
    >
      <${Icon} name="swap-vertical" size="16px" color=${theme.colors.text.secondary} />
      ${dragState.title}
    </${DragGhost}>
  `
    : null

  // ── Render ────────────────────────────────────────────────────────────────

  /**
   * Build the ordered item list, inserting a placeholder at the drop target.
   * When dragging, the source item stays mounted but hidden, and a placeholder
   * appears at the toIndex position showing where it will land. Both renders key
   * rows the same way, so a drag never remounts a row or loses its form state.
   * Each item is wrapped in a plain div with data-dli so computeDropIndex can
   * find them without counting the header/add-button row.
   */
  const renderItems = () => {
    if (!dragState) {
      // Normal (non-drag) render
      return items.map((item, index) => {
        return html`<div key=${rowKeys[index]} data-dli>
          ${
            condensed
              ? html`
                  <${CondensedDynamicListItem}
                    item=${item}
                    index=${index}
                    total=${items.length}
                    renderItem=${renderItem}
                    onMoveUp=${() => handleMoveUp(index)}
                    onMoveDown=${() => handleMoveDown(index)}
                    onDelete=${onDelete ? () => onDelete(item, index) : () => handleDelete(index)}
                    onDragStart=${handleDragStart}
                    isDragTarget=${false}
                    showDragButton=${showDragButton}
                    showMoveUpDownButtons=${showMoveUpDownButtons}
                    upDisabled=${index === 0 || (canDrop ? !canDrop(index, index - 1) : false)}
                    headerActions=${headerActions}
                    getEnabled=${getEnabled}
                    onToggleEnabled=${onToggleEnabled}
                    deleteIcon=${deleteIcon}
                    deleteTooltip=${deleteTooltip}
                    hideDelete=${hideDelete}
                    theme=${theme}
                  />
                `
              : html`
                  <${DynamicListItem}
                    item=${item}
                    index=${index}
                    total=${items.length}
                    title=${getTitle ? getTitle(item, index) : `Item ${index + 1}`}
                    headerContent=${getHeaderContent ? getHeaderContent(item, index) : null}
                    renderItem=${renderItem}
                    onMoveUp=${() => handleMoveUp(index)}
                    onMoveDown=${() => handleMoveDown(index)}
                    onDelete=${onDelete ? () => onDelete(item, index) : () => handleDelete(index)}
                    onDragStart=${handleDragStart}
                    isDragTarget=${false}
                    ...${expansionProps(rowKeys[index])}
                    showDragButton=${showDragButton}
                    showMoveUpDownButtons=${showMoveUpDownButtons}
                    upDisabled=${index === 0 || (canDrop ? !canDrop(index, index - 1) : false)}
                    headerActions=${headerActions}
                    getEnabled=${getEnabled}
                    onToggleEnabled=${onToggleEnabled}
                    getHeaderSelectOptions=${getHeaderSelectOptions}
                    getHeaderSelectValue=${getHeaderSelectValue}
                    onHeaderSelectChange=${onHeaderSelectChange}
                    getHeaderSelectTooltip=${getHeaderSelectTooltip}
                    deleteIcon=${deleteIcon}
                    deleteTooltip=${deleteTooltip}
                    hideDelete=${hideDelete}
                    theme=${theme}
                  />
                `
          }
        </div>`
      })
    }

    // During drag: source item is hidden; a standalone placeholder appears
    // at the computed drop position as an independent flex child (so the ListRoot
    // gap applies uniformly).
    const { fromIndex, toIndex } = dragState

    // Physical slot where the placeholder is inserted as a standalone child:
    //   • Dragging up  (toIndex < fromIndex): placeholder goes BEFORE physical toIndex
    //   • Dragging down (toIndex ≥ fromIndex): placeholder goes BEFORE physical toIndex+1
    //     (i.e. AFTER the last item the cursor passed, which visually matches expectation)
    const physicalSlot = toIndex < fromIndex ? toIndex : toIndex + 1

    const result = []

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      // Hidden rather than skipped, so it keeps its form state; the placeholder
      // takes its visual slot.
      const isSource = index === fromIndex

      // Emit the placeholder as a standalone sibling BEFORE this physical slot.
      if (index === physicalSlot) {
        result.push(
          html`<${DragPlaceholder} key="placeholder" theme=${theme} />`,
        )
      }

      const innerNode = condensed
        ? html`
            <${CondensedDynamicListItem}
              item=${item}
              index=${index}
              total=${items.length}
              renderItem=${renderItem}
              onMoveUp=${() => handleMoveUp(index)}
              onMoveDown=${() => handleMoveDown(index)}
              onDelete=${() => handleDelete(index)}
              onDragStart=${handleDragStart}
              isDragTarget=${false}
              showDragButton=${showDragButton}
              showMoveUpDownButtons=${showMoveUpDownButtons}
              headerActions=${headerActions}
              getEnabled=${getEnabled}
              onToggleEnabled=${onToggleEnabled}
              deleteIcon=${deleteIcon}
              deleteTooltip=${deleteTooltip}
              hideDelete=${hideDelete}
              theme=${theme}
            />
          `
        : html`
            <${DynamicListItem}
              item=${item}
              index=${index}
              total=${items.length}
              title=${getTitle ? getTitle(item, index) : `Item ${index + 1}`}
              headerContent=${getHeaderContent ? getHeaderContent(item, index) : null}
              renderItem=${renderItem}
              onMoveUp=${() => handleMoveUp(index)}
              onMoveDown=${() => handleMoveDown(index)}
              onDelete=${() => handleDelete(index)}
              onDragStart=${handleDragStart}
              isDragTarget=${false}
              ...${expansionProps(rowKeys[index])}
              showDragButton=${showDragButton}
              showMoveUpDownButtons=${showMoveUpDownButtons}
              headerActions=${headerActions}
              getEnabled=${getEnabled}
              onToggleEnabled=${onToggleEnabled}
              getHeaderSelectOptions=${getHeaderSelectOptions}
              getHeaderSelectValue=${getHeaderSelectValue}
              onHeaderSelectChange=${onHeaderSelectChange}
              getHeaderSelectTooltip=${getHeaderSelectTooltip}
              deleteIcon=${deleteIcon}
              deleteTooltip=${deleteTooltip}
              hideDelete=${hideDelete}
              theme=${theme}
            />
          `

      result.push(
        html`<div
          key=${rowKeys[index]}
          data-dli=${isSource ? undefined : true}
          hidden=${isSource}
        >
          ${innerNode}
        </div>`,
      )
    }

    // Placeholder at the very end (cursor past all items).
    if (physicalSlot >= items.length) {
      result.push(html`<${DragPlaceholder} key="placeholder" theme=${theme} />`)
    }

    return result
  }

  return html`
    <${ListRoot} theme=${theme} id=${listId}>
      <${ListHeader}>
        ${title && html`<${RowTitle} size="small">${title}</${RowTitle}>`}
        ${addButton}
      </${ListHeader}>

      ${leadingContent}
      ${renderItems()}
    </${ListRoot}>

    ${ghostOverlay}
  `
}
