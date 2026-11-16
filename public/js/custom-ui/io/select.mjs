/**
 * select.mjs – Fully custom single-value dropdown.
 *
 * Replaces the themed native <select> with a portal-anchored popover list that
 * matches MultiSelect's visual approach. Fires `onChange({ target: { value } })`
 * to preserve the existing caller API.
 */
import { html } from 'htm/preact'
import {
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo,
} from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { styled } from '../goober-setup.mjs'
import {
  currentTheme,
  CONTROL_SIZES,
  getControlSize,
  getEmbeddedButtonLayout,
  getPopoverMaxHeight,
} from '../theme.mjs'
import {
  getWidthScaleStyle,
  resolveFieldSize,
  resolveWidthScale,
} from '../util.mjs'
import { Icon } from '../layout/icon.mjs'
import { Button } from './button.mjs'
import { useListboxKeyboard } from './use-listbox-keyboard.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'
import {
  ValidationMessage,
  validationBorderColor,
  validationFocusColor,
} from './validation-message.mjs'

// ============================================================================
// Styled Components
// ============================================================================

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
FormGroup.className = 'form-group'

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
`
Label.className = 'label'

const TriggerButton = styled('button')`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: ${(props) => props.height};
  padding: ${(props) => props.padding};
  background-color: ${(props) => props.backgroundColor};
  border: ${(props) => props.border};
  border-radius: ${(props) => props.borderRadius};
  color: ${(props) => props.color};
  font-family: ${(props) => props.fontFamily};
  font-size: ${(props) => props.fontSize};
  cursor: pointer;
  text-align: left;
  transition: ${(props) => props.transition};
  box-sizing: border-box;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.focusColor};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
TriggerButton.className = 'select-trigger'

const TriggerText = styled('span')`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(props) => (props.placeholder ? props.placeholderColor : props.textColor)};
`
TriggerText.className = 'select-trigger-text'

// A field's dropdown sits above modal and dialog overlays (`BaseOverlay`,
// 10000), so a field inside a modal stays usable; it matches
// `AutocompleteDropdown` (20000) and stays below tooltips (30000).
const Popover = styled('div')`
  position: fixed;
  z-index: 20000;
  background-color: ${(props) => props.bgColor};
  border: 2px solid ${(props) => props.borderColor};
  border-radius: ${(props) => props.borderRadius};
  box-shadow: ${(props) => props.shadow};
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: ${(props) => props.maxHeight};
  overflow-y: auto;
`
Popover.className = 'select-popover'

const OptionRow = styled('div')`
  display: flex;
  align-items: center;
  padding: 6px 8px;
  min-height: 32px;
  border-radius: 4px;
  cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
  user-select: none;
  font-family: ${(props) => props.fontFamily};
  font-size: ${(props) => props.fontSize};
  color: ${(props) => props.color};
  background-color: ${(props) =>
    props.selected
      ? props.selectedBg
      : props.highlighted
        ? props.highlightBg
        : 'transparent'};
  box-shadow: ${(props) =>
    props.selected && props.highlighted
      ? `inset 0 0 0 2px ${props.highlightRing}`
      : 'none'};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  &:hover {
    background-color: ${(props) => props.hoverBg};
  }
`
OptionRow.className = 'select-option-row'

// ============================================================================
// Component
// ============================================================================

/**
 * Select – fully custom single-value dropdown.
 *
 * @param {Object}  props
 * @param {string}  [props.label]
 * @param {Array<{label: string, value: any, disabled?: boolean, tooltip?: string}>} [props.options=[]] – `disabled` greys out and inertizes an individual option while keeping it in the list
 * @param {Object}  [props.validation] – validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {string}  [props.id]
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale='normal'] – Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `normal`; `auto` accepted — the trigger hugs the selected label, and the dropdown menu stays at least as wide as the trigger.
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] – control size step
 *   (24 | 34 | 44 | 54px tall); sets the trigger's height, font size, padding, and
 *   border radius from `theme.controlSize[size]`, and the chevron size (the step's
 *   `iconSize`, equal to its font size). Replaces the removed `heightScale` prop, which now logs a
 *   warning and is ignored.
 * @param {boolean} [props.disabled=false]
 * @param {*}       [props.value]
 * @param {Function} [props.onChange] – fires `(e) => e.target.value` (backward compat)
 * @param {string}  [props.tooltip]   – tooltip shown on hover (via TooltipContext)
 *
 * Keyboard: with the trigger focused, letters, ↑/↓, Home/End, Space, Enter,
 * Alt+↓ and F4 open the list (letters highlight their type-ahead match); the
 * closed field never changes value. Open: ↑/↓/Home/End/PgUp/PgDn and letters
 * move the highlight, Enter/Space/Tab/Alt+↑ pick it, Escape cancels. See
 * `useListboxKeyboard`.
 * @param {Object}  [props.buttonProps] – optional icon button: { icon, color?, disabled?, onClick, title?, tooltip?, loading? }
 *   Sits left of the value text inside the trigger. Nesting rule: it renders one size
 *   down from the Select (`oneSizeDown(size)`, `tiny` stays `tiny`), vertically centred,
 *   inset from the trigger's left edge by the same amount as from its top.
 *
 * @example
 * <${Select}
 *   size="small"
 *   options=${[{ label: 'One', value: 1 }, { label: 'Two', value: 2 }]}
 *   value=${value}
 *   onChange=${(e) => setValue(e.target.value)}
 * />
 */
export function Select({
  label,
  options = [],
  validation,
  id,
  widthScale,
  size: sizeProp,
  heightScale,
  disabled = false,
  value,
  onChange,
  tooltip = null,
  buttonProps,
  ...rest
}) {
  const theme = currentTheme.value
  const tooltipCtx = useContext(TooltipContext)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)

  // Memoised on the props so a re-render does not repeat a widthScale warning.
  const resolvedWidthScale = useMemo(
    () => resolveWidthScale('select', widthScale),
    [widthScale],
  )
  const { width: scaleWidth, flex } = getWidthScaleStyle(
    'select',
    resolvedWidthScale,
    { theme },
  )
  // `auto` sets no width; `fit-content` stops the column-flex FormGroup from
  // stretching to its parent's width, so the trigger hugs the selected label.
  const width = resolvedWidthScale === 'auto' ? 'fit-content' : scaleWidth
  // Memoised on the props so a re-render does not repeat a size warning.
  const size = useMemo(
    () => resolveFieldSize('select', sizeProp, heightScale, CONTROL_SIZES),
    [sizeProp, heightScale],
  )
  const step = getControlSize(theme, size)
  const embedded = getEmbeddedButtonLayout(theme, size)
  // The trigger centres its children vertically; with an embedded button, the
  // left padding is set so the button's inset from the left outer edge equals
  // its inset from the top (padding sits inside the border, hence the subtraction).
  const [padY, padX = padY] = step.fieldPadding.split(' ')
  const buttonInset = Math.max(
    0,
    embedded.offset - parseFloat(theme.border.width),
  )
  const triggerPadding = buttonProps
    ? `${padY} ${padX} ${padY} ${buttonInset}px`
    : step.fieldPadding
  const chevronSize = step.iconSize
  const popoverMaxHeight = getPopoverMaxHeight(theme, size)
  const status = validation?.status ?? 'idle'
  const borderColor = validationBorderColor(status, theme)

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label ?? ''

  // Row and listbox ids for aria-activedescendant / aria-controls.
  const baseId = useMemo(
    () => id ?? `select-${Math.random().toString(36).slice(2, 10)}`,
    [id],
  )
  const listboxId = `${baseId}-listbox`
  const rowId = (index) => `${baseId}-opt-${index}`

  // Anchors the popover to the trigger and opens it; shared by click and keys.
  const openAt = useCallback((el) => {
    const rect = el.getBoundingClientRect()
    setAnchor({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      triggerTop: rect.top,
    })
    setOpen(true)
  }, [])

  const handleTriggerClick = useCallback(
    (e) => {
      if (disabled) return
      if (open) setOpen(false)
      else openAt(e.currentTarget)
    },
    [disabled, open, openAt],
  )

  const handleSelect = useCallback(
    (optValue) => {
      onChange?.({ target: { value: optValue } })
      setOpen(false)
    },
    [onChange],
  )

  const close = useCallback(() => setOpen(false), [])

  const keyboard = useListboxKeyboard({
    options,
    open,
    initialIndex: options.findIndex((o) => o.value === value),
    mode: 'single',
    disabled,
    onOpen: openAt,
    onClose: close,
    onCommit: (index) => handleSelect(options[index].value),
    getRowEl: (index) => document.getElementById(rowId(index)),
  })

  useEffect(() => {
    if (!open) return
    const handleDown = (e) => {
      if (
        !e.target.closest('[data-select-popover]') &&
        !e.target.closest('[data-select-trigger]')
      ) {
        close()
      }
    }
    // Escape is handled on the trigger by useListboxKeyboard, which stops it
    // there so a surrounding modal does not close too.
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [open, close])

  const tooltipHandlers =
    tooltip && tooltipCtx
      ? {
          onMouseEnter: (e) => tooltipCtx.show(tooltip, e.clientX, e.clientY),
          onMouseLeave: () => tooltipCtx.hide(),
        }
      : {}

  let popoverStyle = {}
  if (anchor) {
    const ESTIMATED_HEIGHT = Math.min(
      options.length * 36 + 16,
      parseFloat(popoverMaxHeight),
    )
    const spaceBelow = window.innerHeight - anchor.top
    popoverStyle =
      spaceBelow < ESTIMATED_HEIGHT && anchor.triggerTop > ESTIMATED_HEIGHT
        ? {
            top: anchor.triggerTop - ESTIMATED_HEIGHT - 4 + 'px',
            left: anchor.left + 'px',
            minWidth: anchor.width + 'px',
          }
        : {
            top: anchor.top + 'px',
            left: anchor.left + 'px',
            minWidth: anchor.width + 'px',
          }
  }

  const popover =
    open && anchor
      ? createPortal(
          html`
    <${Popover}
      data-select-popover
      id=${listboxId}
      role="listbox"
      bgColor=${theme.colors.background.card}
      borderColor=${theme.colors.border.secondary}
      borderRadius=${theme.border.radius.small}
      shadow=${theme.shadow.elevated}
      maxHeight=${popoverMaxHeight}
      style=${popoverStyle}
      onMouseDown=${(e) => {
        // preventDefault keeps focus on the trigger, so keys keep working
        // after a mouse pick.
        e.stopPropagation()
        e.preventDefault()
      }}
    >
      ${options.map(
        (opt, index) => html`
        <${OptionRow}
          key=${opt.value}
          id=${rowId(index)}
          role="option"
          aria-selected=${opt.value === value ? 'true' : 'false'}
          aria-disabled=${opt.disabled ? 'true' : undefined}
          highlighted=${index === keyboard.highlightedIndex}
          highlightBg=${theme.colors.background.hover}
          highlightRing=${theme.colors.border.focus}
          fontFamily=${theme.typography.fontFamily}
          fontSize=${theme.typography.fontSize.medium}
          color=${opt.disabled ? theme.colors.text.disabled : theme.colors.text.primary}
          selected=${opt.value === value}
          selectedBg=${theme.colors.primary.background}
          hoverBg=${opt.disabled ? 'transparent' : theme.colors.background.hover}
          disabled=${opt.disabled}
          onClick=${() => !opt.disabled && handleSelect(opt.value)}
          onMouseEnter=${(e) => {
            if (!opt.disabled) keyboard.setHighlightedIndex(index)
            if (opt.tooltip) tooltipCtx?.show(opt.tooltip, e.clientX, e.clientY)
          }}
          onMouseLeave=${opt.tooltip ? () => tooltipCtx?.hide() : undefined}
        >${opt.label}</${OptionRow}>
      `,
      )}
    </${Popover}>
  `,
          document.body,
        )
      : null

  const mergedButtonDisabled = buttonProps
    ? buttonProps.disabled || disabled
    : undefined

  return html`
    <${FormGroup} width=${width} flex=${flex}>
      ${
        label
          ? html`
        <${Label}
          for=${id}
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.medium}
          fontWeight=${theme.typography.fontWeight.medium}
        >${label}</${Label}>
      `
          : ''
      }
      <${TriggerButton}
        id=${id}
        type="button"
        data-select-trigger
        disabled=${disabled}
        height=${step.height}
        padding=${triggerPadding}
        borderRadius=${step.borderRadius}
        border=${`2px ${theme.border.style} ${borderColor}`}
        backgroundColor=${theme.colors.background.tertiary}
        color=${theme.colors.text.primary}
        fontFamily=${theme.typography.fontFamily}
        fontSize=${step.fontSize}
        transition=${`border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
        focusColor=${validationFocusColor(status, theme)}
        aria-haspopup="listbox"
        aria-expanded=${open ? 'true' : 'false'}
        aria-controls=${open ? listboxId : undefined}
        aria-activedescendant=${
          open && keyboard.highlightedIndex >= 0
            ? rowId(keyboard.highlightedIndex)
            : undefined
        }
        onClick=${handleTriggerClick}
        ...${tooltipHandlers}
        ...${rest}
        onKeyDown=${keyboard.onKeyDown}
        onKeyUp=${keyboard.onKeyUp}
      >
        ${
          buttonProps
            ? html`
                <${Button}
                  size=${embedded.buttonSize}
                  icon=${buttonProps.icon}
                  color=${buttonProps.color}
                  disabled=${mergedButtonDisabled}
                  loading=${buttonProps.loading}
                  title=${buttonProps.title}
                  tooltip=${buttonProps.tooltip}
                  onClick=${(e) => {
                    e.stopPropagation()
                    buttonProps.onClick?.(e)
                  }}
                />
              `
            : null
        }
        <${TriggerText}
          placeholder=${!selectedOption}
          placeholderColor=${theme.colors.text.placeholder}
          textColor=${theme.colors.text.primary}
        >${displayLabel || ' '}</${TriggerText}>
        <${Icon} name="chevron-down" size=${chevronSize} color=${theme.colors.text.secondary} />
      </${TriggerButton}>
      ${popover}
      <${ValidationMessage}
        status=${status}
        message=${validation?.message ?? ''}
      />
    </${FormGroup}>
  `
}
