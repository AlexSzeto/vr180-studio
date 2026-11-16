/**
 * pill.mjs – Shared pill component with four usage patterns.
 *
 * All variants share the same pill-shaped container (border-radius: 9999px).
 * Color themes: primary | secondary | warning | success | danger. `color` also
 * accepts a raw `{ text, background, border }` theme color-token object for
 * cases needing a color outside the named set (e.g. `theme.colors.tagOrigin.*`).
 *
 * Variants:
 *   Static          – text only (no extra props beyond color/disabled/children)
 *   Dismiss         – text + × dismiss button on the LEFT  (`onDismiss` prop)
 *   Interactive icon – text + a separately clickable icon  (`icon` + `onIconClick`)
 *   Template choice  – `{{slot}}` substrings in children become tokens that open
 *                      a `PillSelectPanel` of `options`; a pick rewrites that slot
 *                      (`options` + `onTemplateChange`); combinable with dismiss/icon
 *   Whole-pill select – clicking the pill body opens a `PillSelectPanel` of
 *                      `selectOptions`; a pick calls `onSelect(value)`
 *
 * @module custom-ui/io/pill
 *
 * @example <caption>Static</caption>
 * <${Pill} color="primary">hello</${Pill}>
 *
 * @example <caption>Dismiss (× on left)</caption>
 * <${Pill} color="primary" onDismiss=${() => remove()}>hello</${Pill}>
 *
 * @example <caption>Interactive icon (right side)</caption>
 * <${Pill} color="secondary" icon="play" iconSide="right" onIconClick=${toggle}>
 *   Background Music
 * </${Pill}>
 *
 * @example <caption>Template choice</caption>
 * <${Pill}
 *   color="primary"
 *   options=${['outer upper body','inner upper body','head']}
 *   onTemplateChange=${v => setValue(v)}
 *   onDismiss=${() => remove()}
 * >{'{{outer upper body}}'}</${Pill}>
 *
 * @example <caption>Whole-pill select (per-option colours)</caption>
 * <${Pill}
 *   color="secondary"
 *   value=${op}
 *   selectOptions=${[{ value: 'is', color: 'success' }, { value: 'is not', color: 'danger' }]}
 *   onSelect=${(v) => setOp(v)}
 * >${op}</${Pill}>
 */
import { html } from 'htm/preact'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme, CONTROL_SIZES, getPillSize } from '../theme.mjs'
import { Icon } from '../layout/icon.mjs'
import { log } from '../logger.mjs'
import { PillSelectPanel } from './pill-select-panel.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'
import {
  checkScaleProp,
  getWidthScaleStyle,
  hexToRgba,
  resolveWidthScale,
} from '../util.mjs'

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_REGEX = /\{\{(.+?)\}\}/g

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split a string on `{{slot}}` tokens into alternating text/slot parts. */
function parseTemplate(str) {
  const parts = []
  let lastIndex = 0
  SLOT_REGEX.lastIndex = 0
  let match
  while ((match = SLOT_REGEX.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: str.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'slot', slot: match[1] })
    lastIndex = SLOT_REGEX.lastIndex
  }
  if (lastIndex < str.length) {
    parts.push({ type: 'text', text: str.slice(lastIndex) })
  }
  return parts
}

/**
 * Resolve the background, text and border tokens for a given color + disabled state.
 * @param {'primary'|'secondary'|'warning'|'success'|'danger'|{text?: string, background: string, border?: string}} color
 *   – a named theme color, or a raw color-token object (e.g. `theme.colors.tagOrigin.rule`)
 * @param {object} t - current theme
 * @param {boolean} disabled
 * @param {'filled'|'outlined'} variant
 */
function resolveColors(color, t, disabled, variant = 'filled') {
  if (disabled) {
    return {
      bg: variant === 'outlined' ? 'transparent' : t.colors.background.disabled,
      text: t.colors.text.disabled,
      border: t.colors.border.secondary,
    }
  }
  if (variant === 'outlined') {
    return {
      bg: 'transparent',
      text: t.colors.text.primary,
      border: t.colors.border.primary,
    }
  }
  const c =
    typeof color === 'object' && color
      ? color
      : t.colors[color] || t.colors.primary
  return {
    bg: c.background,
    text: c.text || '#ffffff',
    border: c.border || t.colors.border.primary,
  }
}

// ── Styled shell ──────────────────────────────────────────────────────────────

/**
 * Outer container — pill shape with overflow clip so inner hover highlights are
 * rounded at the edges without needing per-button radius calculations.
 */
const PillContainer = styled('span')`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid ${(props) => props.borderColor};
  background-color: ${(props) => props.bg};
  min-height: ${(props) => props.minHeight};
  font-size: ${(props) => props.fontSize};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  white-space: nowrap;
  vertical-align: middle;
  user-select: none;
  line-height: 1;
  box-sizing: border-box;
  cursor: ${(props) => (props.clickable ? 'pointer' : undefined)};
  transition:
    filter ${() => currentTheme.value.transitions.fast},
    background-color ${() => currentTheme.value.transitions.fast};
  &:hover {
    filter: ${(props) => (props.clickable && props.variant !== 'outlined' ? 'brightness(1.2)' : undefined)};
    background-color: ${(props) => (props.clickable && props.variant === 'outlined' ? 'rgba(0,0,0,0.06)' : undefined)};
  }
`
PillContainer.className = 'pill-container'

/** Middle content zone — text colour and horizontal padding only; background comes from PillContainer. */
const PillContentArea = styled('span')`
  display: flex;
  align-items: center;
  gap: 3px;
  padding: ${(props) => props.padding || '0 8px'};
  color: ${(props) => props.textColor};
`
PillContentArea.className = 'pill-content'

/**
 * Clickable icon zone (dismiss × or interactive icon).
 * Floats as a rounded internal button — transparent background lets the
 * PillContainer bg show through; hover adds a white glow like SlotToken.
 */
const PillIconBtn = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  padding: 2px;
  border: none;
  border-radius: 9999px;
  background-color: transparent;
  cursor: pointer;
  line-height: 1;
  transition: background-color ${() => currentTheme.value.transitions.fast};

  &:hover:not(:disabled) {
    background-color: ${(props) => (props.outlined ? 'rgba(0,0,0,0.1)' : 'rgba(255, 255, 255, 0.22)')};
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    cursor: default;
  }
`
PillIconBtn.className = 'pill-icon-btn'

// ── SlotToken ─────────────────────────────────────────────────────────────────

/**
 * SlotToken – a single `{{slot}}` token inside a template pill. When
 * `canChoose`, a click opens the pill's PillSelectPanel for this slot.
 * Owns its own hover state so multiple tokens per pill are independent.
 *
 * When `tokenBg` / `tokenText` are provided (solid color override, e.g. for
 * outlined pills), hover uses filter:brightness instead of a bg-color swap.
 */
function SlotToken({
  slot,
  canChoose,
  textColor,
  tokenBg,
  tokenText,
  padding,
  onChoose,
  onOpenerMouseDown,
}) {
  const [hovered, setHovered] = useState(false)
  const t = currentTheme.value

  const solidToken = !!tokenBg
  const bg = solidToken
    ? tokenBg
    : hovered && canChoose
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(255,255,255,0.22)'
  const borderBase = tokenText || textColor

  return html`<span
    data-pill-slot=""
    style=${{
      backgroundColor: bg,
      border: `1px solid ${hexToRgba(borderBase, 0.25)}`,
      borderRadius: '9999px',
      padding,
      cursor: canChoose ? 'pointer' : 'default',
      fontWeight: t.typography.fontWeight.bold,
      transition: solidToken
        ? `filter ${t.transitions.fast}`
        : `background-color ${t.transitions.fast}`,
      filter:
        solidToken && hovered && canChoose ? 'brightness(1.15)' : undefined,
      color: tokenText || undefined,
    }}
    onMouseDown=${canChoose ? () => onOpenerMouseDown(slot) : undefined}
    onMouseEnter=${canChoose ? () => setHovered(true) : undefined}
    onMouseLeave=${canChoose ? () => setHovered(false) : undefined}
    onClick=${
      canChoose
        ? (e) => {
            e.stopPropagation()
            onChoose(slot, e.currentTarget.getBoundingClientRect())
          }
        : undefined
    }
    title=${canChoose ? `Click to choose (${slot})` : slot}
    >${slot}</span
  >`
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Pill – shared pill component.
 *
 * @param {Object}   props
 * @param {'primary'|'secondary'|'warning'|'success'|'danger'|{text?: string, background: string, border?: string}} [props.color='primary']
 *   – a named theme color, or a raw `{ text, background, border }` color-token object
 *   for cases needing a color outside the named set (e.g. `theme.colors.tagOrigin.rule`)
 * @param {boolean}  [props.disabled=false]
 * @param {Function} [props.onDismiss]          – enables × button on the LEFT
 * @param {string}   [props.icon]               – icon name for interactive icon button
 * @param {'left'|'right'} [props.iconSide='left']
 * @param {Function} [props.onIconClick]        – makes the icon button clickable
 * @param {string}   [props.iconColor]          – override icon color (defaults to pill text color)
 * @param {string[]} [props.options]            – choices for `{{slot}}` tokens: clicking a token opens a
 *   `PillSelectPanel` of these at the pill's size and colour, and a pick replaces that `{{slot}}` in
 *   `children`. Empty, or a `disabled` pill, leaves the tokens non-interactive.
 * @param {Function} [props.onTemplateChange]   – (newChildren: string) => void; fired with the rewritten
 *   children after a slot pick
 * @param {Array<string|{value: *, label?: string, color?: string|Object}>} [props.selectOptions]
 *   – whole-pill choices: when non-empty and not `disabled`, clicking the pill body opens a
 *   `PillSelectPanel` of these anchored to the pill. Takes precedence over `onClick` for a body
 *   click; passing both logs a `[pill]` warning.
 * @param {Function} [props.onSelect]           – (value) => void; fired when a `selectOptions` pick
 *   differs from the current value (`value`, else string `children`)
 * @param {Function} [props.onClick]            – (value: string) => void; makes the whole pill body clickable
 * @param {string}   [props.value]              – value passed to onClick, and the current value for
 *   `selectOptions`; falls back to children if plain string
 * @param {string}   [props.tooltip]            – text shown via TooltipContext while the pill is hovered
 *   (as `Button` does); ignored outside a `TooltipProvider`
 * @param {'filled'|'outlined'} [props.variant='filled'] – visual style; outlined = transparent bg + border.primary + text.primary; the `color` prop still tints slot tokens in outlined mode
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='tiny'] – Size step: height, text, icon size, side padding, and `{{slot}}` token padding from `theme.pillSize`. Defaults to `tiny` — a documented exception to the medium default every other control uses, since pills are usually readouts rather than row-mates. Pass the neighbours' `size` to line a pill up beside other controls.
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale='auto'] – Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `auto`; `auto` accepted.
 * @param {preact.ComponentChildren} props.children
 */
export function Pill({
  color = 'primary',
  disabled = false,
  onDismiss,
  icon,
  iconSide = 'left',
  onIconClick,
  iconColor,
  options,
  onTemplateChange,
  selectOptions,
  onSelect,
  onClick,
  value,
  tooltip,
  variant = 'filled',
  size,
  widthScale,
  children,
  ...rest
}) {
  const t = currentTheme.value
  const tooltipCtx = useContext(TooltipContext)
  const tooltipHandlers =
    tooltip && tooltipCtx
      ? {
          onMouseEnter: (e) =>
            tooltipCtx.show(tooltip, e.clientX, e.clientY, e.currentTarget),
          onMouseLeave: () => tooltipCtx.hide(),
        }
      : {}
  // Memoised so an invalid value warns once per distinct value, not per render.
  const resolvedWidthScale = useMemo(
    () => resolveWidthScale('pill', widthScale, { fallback: 'auto' }),
    [widthScale],
  )
  const resolvedSize = useMemo(
    () => checkScaleProp('pill', 'size', size, CONTROL_SIZES, 'tiny'),
    [size],
  )
  const step = getPillSize(t, resolvedSize)
  const colors = resolveColors(color, t, disabled, variant)
  const isOutlined = variant === 'outlined'

  // For outlined pills, compute the filled color set so slot tokens can still
  // render in the assigned color while the pill shell stays neutral.
  const tokenColors =
    isOutlined && !disabled ? resolveColors(color, t, false, 'filled') : null

  // ── Select panel ────────────────────────────────────────────────────────────
  // `picker` is `null` (closed), `{ kind: 'slot', slot, anchorRect }` for a
  // `{{slot}}` token, or `{ kind: 'body', anchorRect }` for `selectOptions`.
  const [picker, setPicker] = useState(null)
  const closePicker = useCallback(() => setPicker(null), [])
  const pickerKey = picker
    ? picker.kind === 'slot'
      ? `slot:${picker.slot}`
      : 'body'
    : null
  // The panel closes on any mousedown outside it, the opener included. The
  // opener's own mousedown runs before the panel's document listener, so it
  // records whether it was the open one; the click that follows then leaves
  // the panel closed (a toggle) instead of reopening it.
  const openerWasOpenRef = useRef(false)
  const markOpenerDown = (key) => {
    openerWasOpenRef.current = pickerKey === key
  }
  const consumeOpenerWasOpen = () => {
    const was = openerWasOpenRef.current
    openerWasOpenRef.current = false
    return was
  }

  const hasSelectOptions = selectOptions?.length > 0
  const hasOnClick = !!onClick
  useEffect(() => {
    if (hasSelectOptions && hasOnClick) {
      log(
        'pill',
        'warn',
        'selectOptions and onClick were both passed; selectOptions takes precedence for a body click',
      )
    }
  }, [hasSelectOptions, hasOnClick])

  const handleSlotChoose = (slot, anchorRect) => {
    if (consumeOpenerWasOpen()) return
    setPicker({ kind: 'slot', slot, anchorRect })
  }

  const handleSlotSelect = (next) => {
    if (picker?.kind !== 'slot' || typeof children !== 'string') return
    const newChildren = children.replace(
      new RegExp(`\\{\\{${escapeRegex(picker.slot)}\\}\\}`, 'g'),
      `{{${next}}}`,
    )
    onTemplateChange?.(newChildren)
  }

  // Parse children for {{slot}} tokens whenever children is a string
  const isStringChildren = typeof children === 'string'
  const hasSlots = isStringChildren && SLOT_REGEX.test(children)
  const contentParts = hasSlots
    ? ((SLOT_REGEX.lastIndex = 0), parseTemplate(children))
    : null
  const canChoose = hasSlots && options?.length > 0 && !disabled

  const hasIconLeft = icon && (iconSide === 'left' || !iconSide)
  const hasIconRight = icon && iconSide === 'right'

  const resolvedIconColor = iconColor || colors.text

  // ── Icon button renderer ────────────────────────────────────────────────────
  function renderIconBtn(side) {
    return html`
      <${PillIconBtn}
        type="button"
        tabindex="-1"
        disabled=${disabled || !onIconClick}
        outlined=${isOutlined}
        style=${{ [side === 'right' ? 'marginRight' : 'marginLeft']: '4px' }}
        onClick=${(e) => {
          e.stopPropagation()
          if (!disabled) onIconClick?.()
        }}
        title=${icon}
      >
        <${Icon}
          name=${icon}
          size=${step.iconSize}
          color=${resolvedIconColor}
        />
      <//>
    `
  }

  // ── Content ─────────────────────────────────────────────────────────────────
  function renderContent() {
    if (!hasSlots) {
      // Plain text or non-string children
      return children
    }
    // Template: render text parts normally and slot parts as choosable tokens
    return contentParts.map((p) => {
      if (p.type === 'text') return p.text
      return html`<${SlotToken}
        key=${p.slot}
        slot=${p.slot}
        canChoose=${canChoose}
        textColor=${colors.text}
        tokenBg=${tokenColors?.bg}
        tokenText=${tokenColors?.text}
        padding=${step.slotPadding}
        onChoose=${handleSlotChoose}
        onOpenerMouseDown=${(slot) => markOpenerDown(`slot:${slot}`)}
      />`
    })
  }

  const widthStyle = getWidthScaleStyle('pill', resolvedWidthScale, {
    theme: t,
  })
  const isSelectable = hasSelectOptions && !disabled
  const isClickable = isSelectable || !!(onClick && !disabled)
  const ownValue = value ?? (typeof children === 'string' ? children : '')

  const handlePillClick = isSelectable
    ? (e) => {
        if (consumeOpenerWasOpen()) return
        setPicker({
          kind: 'body',
          anchorRect: e.currentTarget.getBoundingClientRect(),
        })
      }
    : isClickable
      ? () => onClick(ownValue)
      : undefined

  let panel = null
  if (picker?.kind === 'slot') {
    panel = html`<${PillSelectPanel}
      anchorRect=${picker.anchorRect}
      options=${options ?? []}
      value=${picker.slot}
      size=${resolvedSize}
      color=${color}
      onSelect=${handleSlotSelect}
      onClose=${closePicker}
    />`
  } else if (picker?.kind === 'body') {
    panel = html`<${PillSelectPanel}
      anchorRect=${picker.anchorRect}
      options=${selectOptions ?? []}
      value=${ownValue}
      size=${resolvedSize}
      color=${color}
      onSelect=${(next) => onSelect?.(next)}
      onClose=${closePicker}
    />`
  }

  return html`
    <${PillContainer}
      borderColor=${colors.border}
      bg=${colors.bg}
      minHeight=${step.height}
      fontSize=${step.fontSize}
      clickable=${isClickable}
      variant=${variant}
      style=${widthStyle}
      onMouseDown=${
        isSelectable
          ? (e) => {
              // A slot token records its own mousedown; do not overwrite it.
              if (!e.target.closest?.('[data-pill-slot]'))
                markOpenerDown('body')
            }
          : undefined
      }
      onClick=${handlePillClick}
      ...${tooltipHandlers}
      ...${rest}
    >
      ${
        onDismiss &&
        html`
          <${PillIconBtn}
            type="button"
            tabindex="-1"
            disabled=${disabled}
            outlined=${isOutlined}
            data-pill-dismiss=""
            style=${{ marginLeft: '4px' }}
            onClick=${(e) => {
              e.stopPropagation()
              if (!disabled) onDismiss()
            }}
            title="Remove"
          >
            <${Icon} name="x" size=${step.iconSize} color=${colors.text} />
          <//>
        `
      }
      ${hasIconLeft && renderIconBtn('left')}

      <${PillContentArea}
        textColor=${colors.text}
        padding=${`0 ${hasIconRight ? '4px' : step.paddingX} 0 ${onDismiss || hasIconLeft ? '4px' : step.paddingX}`}
      >
        ${renderContent()}
      <//>

      ${hasIconRight && renderIconBtn('right')}
    <//>
    ${panel}
  `
}
