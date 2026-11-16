/**
 * pill-select-panel.mjs – Dropdown-style popup for choosing a pill's value.
 *
 * Lists the choices as a vertical column of option rows — `Select`'s popover
 * rows scaled to the panel's control size, neutral until hovered or pressed,
 * when they take their option's colour — anchored under the element that opened it (a `{{slot}}` token or a
 * whole pill), and scrolls
 * past `theme.popoverMaxHeight[size]`. It is stateless: the host owns the open
 * state and passes `anchorRect` (or `null` when closed).
 *
 * @module custom-ui/io/pill-select-panel
 *
 * @example
 * const [anchor, setAnchor] = useState(null)
 * <${PillSelectPanel}
 *   anchorRect=${anchor}
 *   options=${['and', 'or']}
 *   value=${current}
 *   size="tiny"
 *   color="primary"
 *   onSelect=${(v) => setCurrent(v)}
 *   onClose=${() => setAnchor(null)}
 * />
 */
import { html } from 'htm/preact'
import { useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { styled } from '../goober-setup.mjs'
import { currentTheme, getControlSize, getPopoverMaxHeight } from '../theme.mjs'
import { VerticalLayout } from '../themed-base.mjs'

// Sits above modal and dialog overlays (`BaseOverlay`, 10000) like Select's
// popover and `AutocompleteDropdown` (20000), and below tooltips (30000).
const PanelRoot = styled('div')`
  position: fixed;
  z-index: 20000;
  background-color: ${(props) => props.bgColor};
  border: ${(props) => props.borderWidth} solid ${(props) => props.borderColor};
  border-radius: ${(props) => props.borderRadius};
  box-shadow: ${(props) => props.shadow};
  padding: ${(props) => props.padding};
  max-height: ${(props) => props.maxHeight};
  overflow-y: auto;
  box-sizing: border-box;
`
PanelRoot.className = 'pill-select-panel'

// Shaped like Select's `OptionRow`, but sized from the control size scale so a
// tiny panel gets tiny rows. Rows are neutral at rest and take the option's
// colour only on hover and press; the current value gets no highlight of its own.
const OptionRow = styled('div')`
  display: flex;
  align-items: center;
  min-height: ${(props) => props.minHeight};
  padding: ${(props) => props.padding};
  border-radius: ${(props) => props.borderRadius};
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  font-family: ${(props) => props.fontFamily};
  font-size: ${(props) => props.fontSize};
  color: ${(props) => props.textColor};
  background-color: transparent;

  &:hover {
    color: ${(props) => props.activeTextColor};
    background-color: ${(props) => props.hoverColor};
  }

  &:active {
    color: ${(props) => props.activeTextColor};
    background-color: ${(props) => props.activeColor};
  }
`
OptionRow.className = 'pill-select-option-row'

// Option row colours: neutral at rest; the option's (or panel's) colour shows
// only on hover and press, through the theme colour's higher-contrast
// `hover`/`active` tokens.
function optionColors(color, theme) {
  const c =
    typeof color === 'object' && color
      ? color
      : theme.colors[color] || theme.colors.primary
  const hover = c.hover || c.background
  return {
    text: theme.colors.text.primary,
    hover,
    active: c.active || hover,
    activeText: c.text || '#ffffff',
  }
}

/** Normalise an option to `{ value, label, color? }`. */
function normalizeOption(opt) {
  if (opt !== null && typeof opt === 'object') {
    return { ...opt, label: opt.label ?? String(opt.value) }
  }
  return { value: opt, label: String(opt) }
}

/**
 * Fixed-position style for the panel: below the anchor, or above it when the
 * estimated panel height does not fit below but does above (Select's rule).
 */
function placementStyle(anchorRect, optionCount, theme, size) {
  const gap = 4
  const maxHeight = parseFloat(getPopoverMaxHeight(theme, size))
  const rowHeight =
    parseFloat(getControlSize(theme, size).height) +
    parseFloat(theme.spacing.tiny.gap)
  const chrome =
    2 * parseFloat(theme.spacing.small.padding) +
    2 * parseFloat(theme.border.width)
  const estimated = Math.min(optionCount * rowHeight + chrome, maxHeight)
  const below = anchorRect.bottom + gap
  const spaceBelow = window.innerHeight - below
  const base = {
    left: anchorRect.left + 'px',
    minWidth: anchorRect.width + 'px',
  }
  if (spaceBelow < estimated && anchorRect.top > estimated) {
    return { ...base, bottom: window.innerHeight - anchorRect.top + gap + 'px' }
  }
  return { ...base, top: below + 'px' }
}

/**
 * PillSelectPanel – anchored popup listing a pill's choices as option rows.
 *
 * @param {Object} props
 * @param {{top: number, bottom: number, left: number, width: number}|null} props.anchorRect
 *   – the opener's rect (e.g. from `getBoundingClientRect()`); `null` renders nothing
 * @param {Array<string|{value: *, label?: string, color?: string|Object}>} props.options
 *   – choices; an option's own `color` overrides the panel `color`
 * @param {*}        [props.value]           – current value; scrolled into view on open, drawn like every other row
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='tiny'] – the source pill's size; sets the option rows' size (`getControlSize`) and the scroll threshold (`getPopoverMaxHeight`)
 * @param {'primary'|'secondary'|'warning'|'success'|'danger'|Object} [props.color='primary'] – the source pill's color
 * @param {Function} props.onSelect          – (value) => void; fired for a pick other than the current value
 * @param {Function} props.onClose           – () => void; fired after any pick, on Escape, and on a mousedown outside the panel
 */
export function PillSelectPanel({
  anchorRect,
  options = [],
  value,
  size = 'tiny',
  color = 'primary',
  onSelect,
  onClose,
}) {
  const theme = currentTheme.value
  const open = !!anchorRect
  // A plain DOM node (not the styled root) so the current option can be found
  // and scrolled into view.
  const bodyRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const handleDown = (e) => {
      if (!e.target.closest?.('[data-pill-select-panel]'))
        onCloseRef.current?.()
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const current = bodyRef.current?.querySelector('[data-pill-select-current]')
    current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])

  if (!open) return null

  const items = options.map(normalizeOption)
  const step = getControlSize(theme, size)

  const pick = (optValue) => {
    if (optValue !== value) onSelect?.(optValue)
    onClose?.()
  }

  return createPortal(
    html`
      <${PanelRoot}
        data-pill-select-panel
        bgColor=${theme.colors.background.card}
        borderColor=${theme.colors.border.secondary}
        borderWidth=${theme.border.width}
        borderRadius=${theme.border.radius.small}
        shadow=${theme.shadow.elevated}
        padding=${theme.spacing.small.padding}
        maxHeight=${getPopoverMaxHeight(theme, size)}
        style=${placementStyle(anchorRect, items.length, theme, size)}
        onMouseDown=${(e) => e.stopPropagation()}
      >
        <div ref=${bodyRef}>
          <${VerticalLayout} gap="tiny">
            ${items.map((opt) => {
              const isCurrent = opt.value === value
              const colors = optionColors(opt.color ?? color, theme)
              return html`<${OptionRow}
                key=${String(opt.value)}
                data-pill-select-option
                data-pill-select-current=${isCurrent ? '' : undefined}
                minHeight=${step.height}
                padding=${step.fieldPadding}
                borderRadius=${step.borderRadius}
                fontFamily=${theme.typography.fontFamily}
                fontSize=${step.fontSize}
                textColor=${colors.text}
                activeTextColor=${colors.activeText}
                hoverColor=${colors.hover}
                activeColor=${colors.active}
                onClick=${() => pick(opt.value)}
              >${opt.label}</${OptionRow}>`
            })}
          </${VerticalLayout}>
        </div>
      </${PanelRoot}>
    `,
    document.body,
  )
}
