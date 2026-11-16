/**
 * list-select.mjs - Generic list selection modal with customizable items and actions
 *
 * Provides a modal dialog for selecting items from a list with optional per-item action buttons.
 */
import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { Button } from '../io/button.mjs'
import { Input } from '../io/input.mjs'
import { Icon } from '../layout/icon.mjs'
import {
  OverlayDismiss,
  BaseContainer,
  BaseHeader,
  BaseTitle,
} from './modal-base.mjs'

// ============================================================================
// Styled Components
// ============================================================================

const VARIANT_WIDTHS = {
  default: '500px',
  narrow: '340px',
  wide: '700px',
}
const ModalWrapper = styled('div')`
  width: ${(props) => VARIANT_WIDTHS[props.variant] || VARIANT_WIDTHS.default};
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`
ModalWrapper.className = 'modal-wrapper'

const Content = styled('div')`
  flex: 1;
  overflow-y: auto;
  margin: 0 -16px;
  padding: 10px 0;
  min-height: 200px;
  max-height: 400px;
`
Content.className = 'content'

const LoadingMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: ${(props) => props.theme.colors.text.secondary};
`
LoadingMessage.className = 'loading-message'

const List = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 8px;
`
List.className = 'list'

const ItemContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  cursor: ${(props) => (props.unselectable ? 'default' : 'pointer')};
  transition: background-color ${(props) => props.theme.transitions.fast};
  opacity: ${(props) => (props.unselectable ? 0.5 : 1)};

  ${(props) =>
    !props.unselectable
      ? `
    &:hover {
      background-color: ${props.theme.colors.background.hover};
      border-radius: ${props.theme.border.radius.small};
    }
  `
      : ''}

  ${(props) =>
    props.isSelected
      ? `
    background-color: rgba(100, 150, 255, 0.15);
    border-radius: ${props.theme.border.radius.small};
  `
      : ''}
`
ItemContainer.className = 'item-container'

const ItemLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`
ItemLabel.className = 'item-label'

const ItemName = styled('span')`
  color: ${(props) => props.theme.colors.text.primary};
  font-size: ${(props) => props.theme.typography.fontSize.medium};
  font-weight: ${(props) => props.theme.typography.fontWeight.medium};
`
ItemName.className = 'item-name'

const ItemActions = styled('div')`
  display: flex;
  gap: ${(props) => props.theme.spacing.small.gap};
  align-items: center;
`
ItemActions.className = 'item-actions'

const SearchBar = styled('div')`
  margin-bottom: ${(props) => props.theme.spacing.medium.gap};
`
SearchBar.className = 'list-select-search-bar'

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 15px;
  margin-top: 10px;
`
Footer.className = 'footer'

const DragGhost = styled('div')`
  position: fixed;
  pointer-events: none;
  z-index: 10000;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  width: ${(props) => props.width}px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  min-height: 44px;
  border: ${(props) => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  border-radius: ${(props) => props.theme.border.radius.small};
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
DragGhost.className = 'list-select-drag-ghost'

const DragPlaceholder = styled('div')`
  border: 2px dashed ${(props) => props.theme.colors.border.secondary};
  border-radius: ${(props) => props.theme.border.radius.small};
  min-height: 44px;
  background: transparent;
`
DragPlaceholder.className = 'list-select-drag-placeholder'

// ============================================================================
// ListItem Component
// ============================================================================

/**
 * ListItem - Renders a single list item row with optional per-item action buttons
 *
 * @param {Object} props
 * @param {Object} props.item - Item data object
 * @param {string} props.item.id - Unique item identifier
 * @param {string} props.item.label - Display label
 * @param {string} [props.item.icon] - Optional icon name for the Icon component
 * @param {boolean} [props.item.disabled=false] - Whether item is disabled
 * @param {string} [props.itemIcon] - Default icon to use if item doesn't specify one
 * @param {boolean} props.isSelected - Whether this item is currently selected
 * @param {Function} props.onSelect - Callback when item is selected
 * @param {Array} [props.itemActions] - Array of { icon, color?, title?, onClick, closeAfter? }
 * @param {Function} props.onClose - Modal close callback (used when closeAfter: true)
 * @param {Function} [props.onDragMouseDown] - When provided, renders a drag handle: (e) => void
 * @param {boolean} [props.reorderDisabled=false] - Renders the drag handle disabled (e.g. while the list is filtered)
 * @param {Object} props.theme - Current theme object
 * @returns {preact.VNode}
 */
function ListItem({
  item,
  itemIcon,
  isSelected,
  onSelect,
  itemActions,
  onClose,
  onDragMouseDown,
  reorderDisabled = false,
  theme,
}) {
  const icon = item.icon || itemIcon || 'list-ul'

  const handleActionClick = (e, action) => {
    e.stopPropagation()
    action.onClick(item)
    if (action.closeAfter && onClose) {
      onClose()
    }
  }

  return html`
    <${ItemContainer}
      isSelected=${isSelected}
      unselectable=${item.unselectable}
      theme=${theme}
      onClick=${() => !item.unselectable && onSelect(item)}
    >
      <${ItemLabel} theme=${theme}>
        <${Icon}
          name=${icon}
          type='solid'
          color=${theme.colors.text.secondary}
          size='20px'
        />
        <${ItemName} theme=${theme}>${item.label}</${ItemName}>
      </${ItemLabel}>
      <${ItemActions} theme=${theme}>
        ${(itemActions || [])
          .filter((a) => a.color !== 'danger')
          .map((action) => {
            const isDisabled =
              typeof action.disabled === 'function'
                ? action.disabled(item)
                : !!action.disabled
            return html`
              <${Button}
                size="small"
                key=${action.icon}
                icon=${action.icon}
                color=${action.color || 'secondary'}
                title=${action.title || ''}
                disabled=${isDisabled}
                onClick=${(e) => handleActionClick(e, action)}
              />
            `
          })}
        ${
          onDragMouseDown &&
          html`
            <${Button}
              size="small"
              icon="swap-vertical"
              disabled=${reorderDisabled}
              onMouseDown=${onDragMouseDown}
              tooltip="Reorder"
              style=${{ cursor: 'grab' }}
            />
          `
        }
        ${(itemActions || [])
          .filter((a) => a.color === 'danger')
          .map((action) => {
            const isDisabled =
              typeof action.disabled === 'function'
                ? action.disabled(item)
                : !!action.disabled
            return html`
              <${Button}
                size="small"
                key=${action.icon}
                icon=${action.icon}
                color="danger"
                title=${action.title || ''}
                disabled=${isDisabled}
                onClick=${(e) => handleActionClick(e, action)}
              />
            `
          })}
      </${ItemActions}>
    </${ItemContainer}>
  `
}

// ============================================================================
// ListSelectModal Component
// ============================================================================

/**
 * ListSelectModal - Modal dialog for selecting items from a list
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {string} [props.title='Select Item'] - Modal title
 * @param {Array<Object>} [props.items=[]] - Array of item objects with id, label, optional icon, optional disabled
 * @param {string} [props.itemIcon] - Default icon for items that don't specify one
 * @param {string} [props.actionLabel] - Label for the primary action button (e.g., "New Item")
 * @param {string} [props.secondaryActionLabel] - Label for a secondary action button (e.g., "Import")
 * @param {Array} [props.itemActions] - Per-item action buttons: [{ icon, color?, title?, onClick, closeAfter? }]
 * @param {boolean} [props.showActionButton=true] - Show the action button in footer
 * @param {'default'|'narrow'} [props.variant='default'] - Modal width variant ('default'=500px, 'narrow'=340px)
 * @param {string} [props.selectedId] - Currently selected item id
 * @param {string} [props.emptyMessage='No items available'] - Message to show when items array is empty
 * @param {Function} [props.onSelectItem] - Callback when item is selected: (item) => void
 * @param {Function} [props.onAction] - Callback for primary action button: () => void
 * @param {Function} [props.onSecondaryAction] - Callback for secondary action button: () => void
 * @param {Function} [props.onClose] - Callback when modal is closed: () => void
 * @param {Function} [props.onReorder] - Enables drag-to-reorder handles; receives the reordered items array
 * @param {boolean} [props.searchable=false] - Renders a search input that filters rows by label (case-insensitive substring).
 *   While filter text is present, every reorder handle is disabled — drag indices address the full, unfiltered list.
 * @param {string} [props.searchPlaceholder='Search…'] - Placeholder for the search input
 * @returns {preact.VNode|null}
 *
 * @example
 * <ListSelectModal
 *   isOpen={true}
 *   title="Select Folder"
 *   items={[{ id: '1', label: 'Documents', icon: 'folder' }]}
 *   itemActions={[
 *     { icon: 'edit', title: 'Rename', onClick: (item) => handleRename(item) },
 *     { icon: 'trash', color: 'danger', title: 'Delete', onClick: (item) => handleDelete(item), closeAfter: false }
 *   ]}
 *   onSelectItem={(item) => console.log('Selected:', item)}
 *   onClose={() => setIsOpen(false)}
 * />
 *
 * @example
 * // Searchable, reorderable list
 * <ListSelectModal
 *   isOpen={true}
 *   title="Workflows"
 *   items={workflows}
 *   searchable={true}
 *   searchPlaceholder="Search workflows…"
 *   onReorder={(next) => saveOrder(next)}
 *   onSelectItem={(item) => open(item.id)}
 *   onClose={() => setIsOpen(false)}
 * />
 */
class ListSelectModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedId: props.selectedId ?? null,
      theme: currentTheme.value,
      dragState: null, // { fromIndex, toIndex, ghostX, ghostY, width, label }
      filter: '',
    }
    this.dragRef = {
      active: false,
      fromIndex: -1,
      toIndex: -1,
      offsetX: 0,
      offsetY: 0,
    }
    this.listId = 'list-select-' + Math.random().toString(36).slice(2)
    // Focus goes through getElementById: a ref on the styled Input yields the
    // Preact instance, not the DOM node.
    this.searchInputId =
      'list-select-search-' + Math.random().toString(36).slice(2)
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown)
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })
    if (this.props.isOpen) this.focusSearch()
  }

  componentDidUpdate(prevProps) {
    // Callers like the workflow editor keep the modal mounted and toggle
    // isOpen, so the filter resets on every open rather than in the constructor.
    if (!prevProps.isOpen && this.props.isOpen) {
      this.setState({ filter: '' })
      this.focusSearch()
    }
  }

  focusSearch() {
    if (!this.props.searchable) return
    clearTimeout(this.focusTimer)
    this.focusTimer = setTimeout(() => {
      document.getElementById(this.searchInputId)?.focus()
    }, 30)
  }

  componentWillUnmount() {
    clearTimeout(this.focusTimer)
    document.removeEventListener('keydown', this.handleKeyDown)
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.handleClose()
    }
  }

  handleClose = () => {
    if (this.props.onClose) {
      this.props.onClose()
    }
  }

  handleItemSelect = async (item) => {
    this.setState({ selectedId: item.id })

    if (this.props.onSelectItem) {
      await this.props.onSelectItem(item)
    }
    this.handleClose()
  }

  handleAction = async () => {
    if (this.props.onAction) {
      await this.props.onAction()
    }
  }

  computeDropIndex(clientY) {
    const root = document.getElementById(this.listId)
    if (!root) return 0
    const children = Array.from(root.querySelectorAll(':scope > [data-lsi]'))
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return children.length
  }

  handleDragMouseDown = (e, index, label) => {
    e.stopPropagation()
    e.preventDefault()

    const root = document.getElementById(this.listId)
    if (!root) return

    const items = Array.from(root.querySelectorAll(':scope > [data-lsi]'))
    const itemEl = items[index]
    if (!itemEl) return

    const itemRect = itemEl.getBoundingClientRect()
    const listRect = root.getBoundingClientRect()
    const offsetX = e.clientX - itemRect.left
    const offsetY = e.clientY - itemRect.top

    this.dragRef = {
      active: true,
      fromIndex: index,
      toIndex: index,
      offsetX,
      offsetY,
    }

    this.setState({
      dragState: {
        fromIndex: index,
        toIndex: index,
        ghostX: itemRect.left,
        ghostY: itemRect.top,
        width: listRect.width,
        label,
      },
    })

    const onMouseMove = (ev) => {
      const dr = this.dragRef
      if (!dr.active) return
      const gx = ev.clientX - dr.offsetX
      const gy = ev.clientY - dr.offsetY
      const newTo = this.computeDropIndex(ev.clientY)
      dr.toIndex = newTo
      this.setState((prev) =>
        prev.dragState
          ? {
              dragState: {
                ...prev.dragState,
                toIndex: newTo,
                ghostX: gx,
                ghostY: gy,
              },
            }
          : null,
      )
    }

    const onMouseUp = () => {
      const dr = this.dragRef
      if (!dr.active) return
      dr.active = false

      const from = dr.fromIndex
      const to = dr.toIndex
      this.setState({ dragState: null })

      if (from !== to && this.props.onReorder) {
        const next = [...this.props.items]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        this.props.onReorder(next)
      }

      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  render() {
    const { isLoading, selectedId, dragState, theme, filter } = this.state
    const {
      isOpen,
      title = 'Select Item',
      items = [],
      itemIcon,
      actionLabel,
      secondaryActionLabel,
      itemActions,
      onReorder,
      showActionButton = true,
      variant = 'default',
      searchable = false,
      searchPlaceholder = 'Search…',
    } = this.props

    if (!isOpen) {
      return null
    }

    const emptyMessage = this.props.emptyMessage || 'No items available'
    const trimmedFilter = filter.trim()
    const isFiltered = searchable && trimmedFilter !== ''
    const lowerFilter = trimmedFilter.toLowerCase()
    // Matches keep source order so the list doesn't reshuffle while typing.
    const visibleItems = isFiltered
      ? items.filter((it) =>
          String(it.label).toLowerCase().includes(lowerFilter),
        )
      : items

    return html`
      <${OverlayDismiss}
        bgColor=${theme.colors.overlay.background}
        onClose=${this.handleClose}
      >
        <${BaseContainer}
          bgColor=${theme.colors.background.card}
          textColor=${theme.colors.text.primary}
          borderRadius=${theme.border.radius.medium}
          maxWidth="90vw"
          maxHeight="80vh"
          minWidth="auto"
          shadowColor=${theme.shadow.colorStrong}
        >
          <${ModalWrapper} variant=${variant}>
            <${BaseHeader} marginBottom="16px">
              <${BaseTitle}
                color=${theme.colors.text.primary}
                fontFamily=${theme.typography.fontFamily}
                fontWeight=${theme.typography.fontWeight.bold}
              >
                ${title}
              </${BaseTitle}>
            </${BaseHeader}>

            ${
              searchable &&
              html`
                <${SearchBar} theme=${theme}>
                  <${Input}
                    id=${this.searchInputId}
                    size="medium"
                    widthScale="full"
                    placeholder=${searchPlaceholder}
                    value=${filter}
                    onInput=${(e) => this.setState({ filter: e.target.value })}
                    buttonProps=${
                      filter
                        ? {
                            icon: 'x',
                            title: 'Clear search',
                            onClick: () => this.setState({ filter: '' }),
                          }
                        : undefined
                    }
                  />
                </${SearchBar}>
              `
            }

            <${Content} theme=${theme}>
              ${
                isLoading
                  ? html`
                <${LoadingMessage} theme=${theme}>Loading...</${LoadingMessage}>
              `
                  : items.length === 0
                    ? html`
                <${LoadingMessage} theme=${theme}>${emptyMessage}</${LoadingMessage}>
              `
                    : visibleItems.length === 0
                      ? html`
                <${LoadingMessage} theme=${theme}>No matches for "${trimmedFilter}"</${LoadingMessage}>
              `
                      : html`
                <${List} theme=${theme} id=${this.listId}>
                  ${(() => {
                    // Drag only starts from the unfiltered list (handles are
                    // disabled while filtered), so the drag branch below can
                    // keep indexing into the full items array.
                    if (!dragState) {
                      return visibleItems.map(
                        (item, index) => html`
                          <div key=${item.id} data-lsi>
                            <${ListItem}
                              item=${item}
                              itemIcon=${itemIcon}
                              isSelected=${item.id === selectedId}
                              onSelect=${this.handleItemSelect}
                              itemActions=${itemActions}
                              onClose=${this.handleClose}
                              reorderDisabled=${isFiltered}
                              onDragMouseDown=${
                                onReorder
                                  ? (e) =>
                                      this.handleDragMouseDown(
                                        e,
                                        index,
                                        item.label,
                                      )
                                  : null
                              }
                              theme=${theme}
                            />
                          </div>
                        `,
                      )
                    }

                    // During drag: omit source, insert placeholder at drop slot
                    const { fromIndex, toIndex } = dragState
                    const physicalSlot =
                      toIndex < fromIndex ? toIndex : toIndex + 1
                    const result = []

                    items.forEach((item, index) => {
                      if (index === fromIndex) return
                      if (index === physicalSlot) {
                        result.push(
                          html`<${DragPlaceholder}
                            key="placeholder"
                            theme=${theme}
                          />`,
                        )
                      }
                      result.push(html`
                        <div key=${item.id} data-lsi>
                          <${ListItem}
                            item=${item}
                            itemIcon=${itemIcon}
                            isSelected=${item.id === selectedId}
                            onSelect=${this.handleItemSelect}
                            itemActions=${itemActions}
                            onClose=${this.handleClose}
                            onDragMouseDown=${
                              onReorder
                                ? (e) =>
                                    this.handleDragMouseDown(
                                      e,
                                      index,
                                      item.label,
                                    )
                                : null
                            }
                            theme=${theme}
                          />
                        </div>
                      `)
                    })

                    if (physicalSlot >= items.length) {
                      result.push(
                        html`<${DragPlaceholder}
                          key="placeholder"
                          theme=${theme}
                        />`,
                      )
                    }
                    return result
                  })()}
                </${List}>
                ${
                  dragState &&
                  html`
                  <${DragGhost}
                    theme=${theme}
                    x=${dragState.ghostX}
                    y=${dragState.ghostY}
                    width=${dragState.width}
                  >
                    <${Icon} name="swap-vertical" size="16px" color=${theme.colors.text.secondary} />
                    ${dragState.label}
                  </${DragGhost}>
                `
                }
              `
              }
            </${Content}>

            <${Footer} theme=${theme}>
              <${Button}
                color="secondary"
                onClick=${this.handleClose}
              >
                Cancel
              </>
              ${
                showActionButton && secondaryActionLabel
                  ? html`
                <${Button}
                  color="secondary"
                  onClick=${() => this.props.onSecondaryAction && this.props.onSecondaryAction()}
                >
                  ${secondaryActionLabel}
                </>
              `
                  : null
              }
              ${
                showActionButton && actionLabel
                  ? html`
                <${Button}
                  color="primary"
                  onClick=${this.handleAction}
                >
                  ${actionLabel}
                </>
              `
                  : null
              }
            </${Footer}>
          </${ModalWrapper}>
        </${BaseContainer}>
      </${OverlayDismiss}>
    `
  }
}

// ============================================================================
// showListSelect Function
// ============================================================================

/**
 * showListSelect - Shows a list selection modal
 *
 * A convenience function that creates and renders the ListSelectModal component
 * in a portal container. Returns a cleanup function to close and unmount the modal.
 *
 * @param {Object} options - Configuration options
 * @param {string} [options.title='Select Item'] - Modal title
 * @param {Array<Object>} [options.items=[]] - List items with id, label, icon (optional), disabled (optional)
 * @param {string} [options.itemIcon] - Default boxicon name for items
 * @param {string} [options.actionLabel] - Label for primary action button (e.g., "New Item")
 * @param {string} [options.secondaryActionLabel] - Label for secondary action button (e.g., "Import")
 * @param {Array} [options.itemActions] - Per-item action buttons: [{ icon, color?, title?, onClick, closeAfter? }]
 * @param {boolean} [options.showActionButton=true] - Show the action button in footer
 * @param {'default'|'narrow'} [options.variant='default'] - Modal width ('default'=500px, 'narrow'=340px)
 * @param {string} [options.selectedId] - Currently selected item id
 * @param {string} [options.emptyMessage='No items available'] - Message to show when items array is empty
 * @param {Function} [options.onSelectItem] - Callback when item is selected: (item) => void
 * @param {Function} [options.onAction] - Callback for primary action button: () => void
 * @param {Function} [options.onSecondaryAction] - Callback for secondary action button: () => void
 * @param {Function} [options.onClose] - Callback when modal is closed: () => void
 *
 * @returns {Function} Cleanup function to close the modal
 *
 * @example
 * // Basic usage
 * const cleanup = showListSelect({
 *   title: 'Select Export',
 *   items: [{ id: 'export1', label: 'My Export' }],
 *   itemIcon: 'export',
 *   onSelectItem: (item) => console.log('Selected:', item)
 * });
 *
 * @example
 * // With per-item actions
 * const cleanup = showListSelect({
 *   title: 'Manage Items',
 *   items: [{ id: '1', label: 'Item 1' }],
 *   itemActions: [
 *     { icon: 'edit', title: 'Edit', onClick: (item) => handleEdit(item) },
 *     { icon: 'trash', color: 'danger', title: 'Delete', onClick: (item) => handleDelete(item) }
 *   ],
 *   actionLabel: 'New Item',
 *   onSelectItem: (item) => handleSelect(item),
 *   onAction: () => createNewItem()
 * });
 */
export function showListSelect(options) {
  // Create container element
  const container = document.createElement('div')
  document.body.appendChild(container)

  // Function to clean up modal
  const cleanup = () => {
    if (container && container.parentNode) {
      document.body.removeChild(container)
    }
  }

  const handleClose = () => {
    if (options.onClose) {
      options.onClose()
    }
    cleanup()
  }

  render(
    html`<${ListSelectModal}
      isOpen=${true}
      title=${options.title}
      items=${options.items || []}
      itemIcon=${options.itemIcon}
      actionLabel=${options.actionLabel}
      itemActions=${options.itemActions}
      showActionButton=${options.showActionButton !== false}
      variant=${options.variant || 'default'}
      selectedId=${options.selectedId}
      emptyMessage=${options.emptyMessage}
      onSelectItem=${options.onSelectItem}
      onAction=${options.onAction}
      secondaryActionLabel=${options.secondaryActionLabel}
      onSecondaryAction=${options.onSecondaryAction}
      onClose=${handleClose}
    />`,
    container,
  )

  return cleanup
}

export default ListSelectModal
