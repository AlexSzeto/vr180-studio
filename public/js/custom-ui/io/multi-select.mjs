/**
 * MultiSelect – button that opens an anchored popover checklist.
 *
 * The popover is rendered into a portal at document.body so it escapes any
 * overflow:hidden ancestors.  Anchor coordinates are captured from the
 * trigger button's getBoundingClientRect() on each click — no ref on a
 * styled component is needed.
 *
 * @module custom-ui/io/multi-select
 */
import { html } from 'htm/preact'
import {
  useState,
  useEffect,
  useCallback,
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
} from '../theme.mjs'
import {
  getWidthScaleStyle,
  resolveFieldSize,
  resolveWidthScale,
} from '../util.mjs'
import { Label } from '../themed-base.mjs'
import { Icon } from '../layout/icon.mjs'
import { Button } from './button.mjs'
import { Checkbox } from './checkbox.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'
import { useListboxKeyboard } from './use-listbox-keyboard.mjs'
import {
  ValidationMessage,
  validationBorderColor,
} from './validation-message.mjs'

// ============================================================================
// Styled Components
// ============================================================================

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
Wrapper.className = 'multi-select-wrapper'

const TriggerButton = styled('button')`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: ${(props) => props.height};
  padding: ${(props) => props.padding};
  box-sizing: border-box;
  background-color: ${(props) => props.theme.colors.background.tertiary};
  border: 2px solid ${(props) => props.borderColor};
  border-radius: ${(props) => props.borderRadius};
  color: ${(props) => props.theme.colors.text.primary};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.fontSize};
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: ${(props) => props.theme.colors.border.focus};
    background-color: ${(props) => props.theme.colors.background.hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.theme.colors.border.focus};
  }
`
TriggerButton.className = 'multi-select-trigger'

const TriggerText = styled('span')`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(props) => (props.empty ? props.theme.colors.text.placeholder : props.theme.colors.text.primary)};
`
TriggerText.className = 'multi-select-trigger-text'

// A field's dropdown sits above modal and dialog overlays (`BaseOverlay`,
// 10000), so a field inside a modal stays usable; it matches
// `AutocompleteDropdown` (20000) and stays below tooltips (30000).
const Popover = styled('div')`
  position: fixed;
  z-index: 20000;
  background-color: ${(props) => props.theme.colors.background.card};
  border: 2px solid ${(props) => props.theme.colors.border.secondary};
  border-radius: ${(props) => props.theme.border.radius.small};
  box-shadow: ${(props) => props.theme.shadow.elevated};
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
`
Popover.className = 'multi-select-popover'

const OptionRow = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  background-color: ${(props) =>
    props.highlighted ? props.theme.colors.background.hover : 'transparent'};

  &:hover {
    background-color: ${(props) => props.theme.colors.background.hover};
  }
`
OptionRow.className = 'multi-select-option-row'

const OptionLabel = styled('span')`
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.fontSize.medium};
  color: ${(props) => props.theme.colors.text.primary};
`
OptionLabel.className = 'multi-select-option-label'

// ============================================================================
// Component
// ============================================================================

/**
 * MultiSelect – Button that opens a popover checklist below (or above, if near viewport bottom).
 *
 * @param {Object}                          props
 * @param {{ label: string, value: string }[]} props.options - Available options as `{ label, value }` objects.
 * @param {string[]}                        props.value     - Currently selected values (matches `option.value`).
 * @param {Function}                        props.onChange  - `(values: string[]) => void`
 * @param {string}                          [props.label]   - Label displayed above the button.
 * @param {string}                          [props.placeholder] - Shown when nothing is selected (default: "Select…").
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale='normal'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `normal`; `auto` accepted — the trigger hugs the selected labels.
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Control size step (24 | 34 | 44 | 54px tall);
 *   sets the trigger's height, font size, and border radius from `theme.controlSize[size]`.
 *   The removed `heightScale` prop logs a warning and is ignored.
 * @param {Object}                          [props.buttonProps] - optional icon button inside trigger: { icon, color?, disabled?, onClick, title?, tooltip?, loading? }
 *   Sits left of the value text. Nesting rule: it renders one size down from the MultiSelect
 *   (`oneSizeDown(size)`, `tiny` stays `tiny`), vertically centred, inset from the trigger's
 *   left edge by the same amount as from its top.
 * Keyboard: with the trigger focused, letters, ↑/↓, Home/End, Space, Enter,
 * Alt+↓ and F4 open the list (letters highlight their type-ahead match).
 * Open: ↑/↓/Home/End/PgUp/PgDn and letters move the highlight, Enter/Space
 * tick or untick it and keep the list open, Escape/Tab/Alt+↑ close. See
 * `useListboxKeyboard`.
 * @param {Object}                          [props.validation]  - validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal.
 *
 * @example
 * html`
 *   <${MultiSelect}
 *     label="Time Signatures"
 *     options=${[{ label: '2/4', value: '2' }, { label: '3/4', value: '3' }, { label: '4/4', value: '4' }, { label: '6/8', value: '6' }]}
 *     value=${genre.timeSignatures}
 *     onChange=${(sigs) => setField('timeSignatures', sigs)}
 *   />
 * `
 */
export function MultiSelect({
  options = [],
  value = [],
  onChange,
  label,
  placeholder = 'Select…',
  widthScale,
  size: sizeProp,
  heightScale,
  buttonProps,
  validation,
}) {
  const theme = currentTheme.value
  // Memoised on the prop so a re-render does not repeat a widthScale warning.
  const resolvedWidthScale = useMemo(
    () => resolveWidthScale('multi-select', widthScale),
    [widthScale],
  )
  // Memoised on the props so a re-render does not repeat a size warning.
  const size = useMemo(
    () =>
      resolveFieldSize('multi-select', sizeProp, heightScale, CONTROL_SIZES),
    [sizeProp, heightScale],
  )
  const step = getControlSize(theme, size)
  const embedded = getEmbeddedButtonLayout(theme, size)
  // Horizontal field padding; with an embedded button the left padding makes
  // the button's inset from the left outer edge equal its inset from the top
  // (padding sits inside the border, hence the subtraction).
  const padParts = step.fieldPadding.split(' ')
  const padX = padParts[1] ?? padParts[0]
  const buttonInset = Math.max(
    0,
    embedded.offset - parseFloat(theme.border.width),
  )
  const triggerPadding = buttonProps
    ? `0 ${padX} 0 ${buttonInset}px`
    : `0 ${padX}`
  const chevronSize = step.iconSize
  const status = validation?.status ?? 'idle'
  const tooltipCtx = useContext(TooltipContext)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null) // { top, left, width, triggerBottom, triggerTop }

  // Row and listbox ids for aria-activedescendant / aria-controls.
  const baseId = useMemo(
    () => `multi-select-${Math.random().toString(36).slice(2, 10)}`,
    [],
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
      if (open) setOpen(false)
      else openAt(e.currentTarget)
    },
    [open, openAt],
  )

  const handleToggle = useCallback(
    (optionValue) => {
      const next = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue]
      onChange(next)
    },
    [value, onChange],
  )

  const close = useCallback(() => setOpen(false), [])

  const keyboard = useListboxKeyboard({
    options,
    open,
    initialIndex: options.findIndex((o) => value.includes(o.value)),
    mode: 'multi',
    onOpen: openAt,
    onClose: close,
    onCommit: (index) => handleToggle(options[index].value),
    getRowEl: (index) => document.getElementById(rowId(index)),
  })

  // Close on outside click; Escape is handled on the trigger by
  // useListboxKeyboard, which stops it there so a surrounding modal stays open.
  useEffect(() => {
    if (!open) return
    const handleDown = (e) => {
      if (
        !e.target.closest('[data-multiselect-popover]') &&
        !e.target.closest('[data-multiselect-trigger]')
      ) {
        close()
      }
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [open, close])

  const displayText =
    value.length === 0
      ? placeholder
      : value
          .map((v) => options.find((o) => o.value === v)?.label ?? v)
          .join(', ')

  const { width: scaleWidth, flex } = getWidthScaleStyle(
    'multi-select',
    resolvedWidthScale,
    { theme },
  )
  // `auto` sets no width; `fit-content` stops the column-flex wrapper from
  // stretching to its parent's width, so the trigger hugs its text.
  const width = resolvedWidthScale === 'auto' ? 'fit-content' : scaleWidth

  // Determine popover position: show above trigger if not enough space below
  let popoverStyle = {}
  if (anchor) {
    const ESTIMATED_HEIGHT = Math.min(options.length * 34 + 16, 280)
    const spaceBelow = window.innerHeight - anchor.top
    if (spaceBelow < ESTIMATED_HEIGHT && anchor.triggerTop > ESTIMATED_HEIGHT) {
      popoverStyle = {
        top: anchor.triggerTop - ESTIMATED_HEIGHT - 4 + 'px',
        left: anchor.left + 'px',
        minWidth: anchor.width + 'px',
      }
    } else {
      popoverStyle = {
        top: anchor.top + 'px',
        left: anchor.left + 'px',
        minWidth: anchor.width + 'px',
      }
    }
  }

  const popover =
    open && anchor
      ? createPortal(
          html`
      <${Popover}
        theme=${theme}
        data-multiselect-popover
        id=${listboxId}
        role="listbox"
        aria-multiselectable="true"
        style=${popoverStyle}
        onMouseDown=${(e) => {
          // preventDefault keeps focus on the trigger, so keys keep working
          // after a mouse toggle.
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        ${options.map(
          (option, index) => html`
          <${OptionRow}
            key=${option.value}
            id=${rowId(index)}
            role="option"
            aria-selected=${value.includes(option.value) ? 'true' : 'false'}
            theme=${theme}
            highlighted=${index === keyboard.highlightedIndex}
            onClick=${(e) => {
              e.stopPropagation()
              handleToggle(option.value)
            }}
            onMouseEnter=${(e) => {
              keyboard.setHighlightedIndex(index)
              if (option.tooltip)
                tooltipCtx?.show(option.tooltip, e.clientX, e.clientY)
            }}
            onMouseLeave=${option.tooltip ? () => tooltipCtx?.hide() : undefined}
          >
            <${Checkbox}
              checked=${value.includes(option.value)}
              onChange=${() => {}}
            />
            <${OptionLabel} theme=${theme}>${option.label}</${OptionLabel}>
          </${OptionRow}>
        `,
        )}
      </${Popover}>
    `,
          document.body,
        )
      : null

  return html`
    <${Wrapper} width=${width} flex=${flex}>
      ${label && html`<${Label}>${label}</${Label}>`}
      <${TriggerButton}
        theme=${theme}
        borderColor=${validationBorderColor(status, theme)}
        height=${step.height}
        padding=${triggerPadding}
        borderRadius=${step.borderRadius}
        fontSize=${step.fontSize}
        type="button"
        data-multiselect-trigger
        aria-haspopup="listbox"
        aria-expanded=${open ? 'true' : 'false'}
        aria-controls=${open ? listboxId : undefined}
        aria-activedescendant=${
          open && keyboard.highlightedIndex >= 0
            ? rowId(keyboard.highlightedIndex)
            : undefined
        }
        onClick=${handleTriggerClick}
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
                  disabled=${buttonProps.disabled}
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
        <${TriggerText} theme=${theme} empty=${value.length === 0}>
          ${displayText}
        </${TriggerText}>
        <${Icon} name="chevron-down" size=${chevronSize} color=${theme.colors.text.secondary} />
      </${TriggerButton}>
      ${popover}
      <${ValidationMessage}
        status=${status}
        message=${validation?.message ?? ''}
      />
    </${Wrapper}>
  `
}
