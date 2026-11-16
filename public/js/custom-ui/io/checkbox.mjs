import { html } from 'htm/preact'
import { Component } from 'preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme, CONTROL_SIZES, getToggleControlSize } from '../theme.mjs'
import { Icon } from '../layout/icon.mjs'
import { ValidationMessage } from './validation-message.mjs'
import {
  checkScaleProp,
  getWidthScaleStyle,
  resolveWidthScale,
} from '../util.mjs'

// =========================================================================
// Styled Components
// =========================================================================

// Only wraps the row when a `validation` prop is present, so an unvalidated
// checkbox keeps the exact markup (and the exact width/flex sizing) it had before.
const ValidationColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.gap};
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
ValidationColumn.className = 'checkbox-validation-column'

const Container = styled('label')`
  display: flex;
  flex-direction: row;
  align-items: center;
  user-select: none;
  cursor: ${(props) => props.cursor};
  opacity: ${(props) => props.opacity};
  gap: ${(props) => props.gap};
  min-width: ${(props) => props.minWidth};
  justify-content: ${(props) => props.justifyContent};
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
Container.className = 'container'

const HiddenInput = styled('input')`
  display: none;
`
HiddenInput.className = 'hidden-input'

const CheckboxVisual = styled('div')`
  width: ${(props) => props.boxSize};
  height: ${(props) => props.boxSize};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: ${(props) => props.border};
  border-radius: ${(props) => props.borderRadius};
  background-color: ${(props) => props.backgroundColor};
  transition: ${(props) => props.transition};

  ${(props) =>
    !props.disabled
      ? `
    &:hover {
      background-color: ${props.hoverBackgroundColor};
    }

    &:active {
      background-color: ${props.activeBackgroundColor};
    }
  `
      : ''}
`
CheckboxVisual.className = 'checkbox-visual'

const LabelText = styled('span')`
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
  color: ${(props) => props.color};
`
LabelText.className = 'label-text'

/**
 * Checkbox - Themed checkbox with label and custom visual styling
 *
 * A styled checkbox component using the Icon component for the check mark,
 * with full theme integration for all visual states.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed next to checkbox
 * @param {boolean} [props.checked=false] - Checked state
 * @param {Function} [props.onChange] - Change handler
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {boolean} [props.interactive=true] - When false, renders as a visual indicator only
 * @param {'left'|'right'} [props.labelPosition='right'] - Position of label relative to checkbox
 * @param {string} [props.id] - ID for the input element
 * @param {Object} [props.validation] - Validation result `{ status, message }`; when present the
 *   row is wrapped in a column so the message can sit beneath it. Pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Size step: scales the box, check glyph, and label text from `theme.toggleControlSize`. The control does not reserve the row height — it is only as tall as its box or label, and lines up in a row via the row's vertical centring.
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `full` when a label is present, `auto` when not; `auto` accepted — `min-content` when unlabeled, fit-the-label when labeled. A fixed width leaves the label to absorb the slack.
 * @returns {preact.VNode}
 *
 * @example
 * // Basic checkbox with label
 * <Checkbox label="Accept terms" checked={true} onChange={handleChange} />
 *
 * @example
 * // Checkbox with label on left
 * <Checkbox label="Enable feature" labelPosition="left" />
 *
 * @example
 * // Disabled checkbox
 * <Checkbox label="Unavailable" disabled={true} />
 *
 * @example
 * // Checkbox without label
 * <Checkbox checked={true} onChange={handleChange} />
 *
 * @example
 * // Small checkbox beside small controls
 * <Checkbox size="small" label="Loop" />
 */
export class Checkbox extends Component {
  constructor(props) {
    super(props)
    this.state = {
      theme: currentTheme.value,
    }
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }

  render() {
    const {
      label,
      checked = false,
      onChange,
      disabled = false,
      interactive = true,
      labelPosition = 'right',
      id,
      validation,
      widthScale,
      size,
      ...rest
    } = this.props
    const { theme } = this.state

    // Validate size only when it changes, so a re-render does not repeat
    // the warning.
    if (this.sizeKey !== size || this.resolvedSize === undefined) {
      this.sizeKey = size
      this.resolvedSize = checkScaleProp(
        'checkbox',
        'size',
        size,
        CONTROL_SIZES,
        'medium',
      )
    }
    const step = getToggleControlSize(theme, this.resolvedSize)

    const hasLabel = label != null && String(label).trim() !== ''
    const inputDisabled = disabled || !interactive

    // The default (and invalid-value fallback) depends on the label, so
    // `hasLabel` is part of the memo key; a re-render with the same props
    // does not repeat a widthScale warning.
    const widthKey = `${widthScale}|${hasLabel}`
    if (this.widthScaleKey !== widthKey) {
      this.widthScaleKey = widthKey
      this.resolvedWidthScale = resolveWidthScale('checkbox', widthScale, {
        fallback: hasLabel ? 'full' : 'auto',
      })
    }
    const scale = this.resolvedWidthScale
    // `auto` hugs the content: `min-content` for a bare box, `fit-content`
    // for a labeled one (the Container is a block-level flex box, so without
    // it a labeled row would stretch to its parent).
    const { width, flex } =
      scale === 'auto'
        ? { width: hasLabel ? 'fit-content' : 'min-content', flex: '0 0 auto' }
        : getWidthScaleStyle('checkbox', scale, { theme })

    const checkboxVisual = html`
      <${CheckboxVisual}
        boxSize=${step.checkboxBox}
        border=${`2px ${theme.border.style} ${checked ? theme.colors.primary.background : theme.colors.border.secondary}`}
        borderRadius=${theme.border.radius.small}
        backgroundColor=${checked ? theme.colors.primary.background : 'transparent'}
        transition=${`background-color ${theme.transitions.fast}, border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
        hoverBackgroundColor=${checked ? theme.colors.primary.hover : theme.colors.background.hover}
        activeBackgroundColor=${checked ? theme.colors.primary.background : theme.colors.background.tertiary}
        disabled=${inputDisabled}
      >
        ${checked ? html`<${Icon} name="check" size=${step.checkGlyph} color="#ffffff" />` : ''}
      </${CheckboxVisual}>
    `

    const labelElement = hasLabel
      ? html`
      <${LabelText}
        fontSize=${step.labelFontSize}
        fontWeight=${theme.typography.fontWeight.medium}
        color=${theme.colors.text.secondary}
      >${label}</${LabelText}>
    `
      : null

    const row = html`
      <${Container}
        cursor=${disabled ? 'default' : interactive ? 'pointer' : 'inherit'}
        opacity=${disabled ? '0.6' : '1'}
        gap=${hasLabel ? '8px' : '0'}
        minWidth=${hasLabel ? '0' : 'auto'}
        justifyContent=${hasLabel ? 'flex-start' : 'center'}
        width=${width}
        flex=${flex}
      >
        <${HiddenInput}
            type="checkbox"
            checked=${checked}
            disabled=${inputDisabled}
            onChange=${interactive ? onChange : undefined}
            id=${id}
            name=${id}
            ...${rest}
        />
        ${labelPosition === 'left' ? html`${labelElement}${checkboxVisual}` : html`${checkboxVisual}${labelElement}`}
      </${Container}>
    `

    if (!validation) return row

    return html`
      <${ValidationColumn}
        gap=${theme.spacing.medium.gap}
        width=${width}
        flex=${flex}
      >
        ${row}
        <${ValidationMessage}
          status=${validation.status}
          message=${validation.message ?? ''}
        />
      </${ValidationColumn}>
    `
  }
}
