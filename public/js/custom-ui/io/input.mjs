import { html } from 'htm/preact'
import { Component } from 'preact'
import { useContext } from 'preact/hooks'
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
import { TooltipContext } from '../overlays/tooltip.mjs'
import { Button } from './button.mjs'
import {
  ValidationMessage,
  validationBorderColor,
  validationFocusColor,
} from './validation-message.mjs'

// =========================================================================
// Styled Components
// =========================================================================

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

const StyledInput = styled('input')`
  padding: ${(props) => props.padding};
  border-radius: ${(props) => props.borderRadius};
  border: ${(props) => props.border};
  background-color: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-family: ${(props) => props.fontFamily};
  transition: ${(props) => props.transition};
  width: 100%;
  height: ${(props) => props.height};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.focusColor};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
StyledInput.className = 'styled-input'

const InputWrapper = styled('div')`
  position: relative;
  width: 100%;
`
InputWrapper.className = 'input-wrapper'

/**
 * InputLabel – renders the input's `<label>`, optionally wrapped in a hover
 * target that shows a tooltip.
 *
 * The tooltip context is read null-safely via `useContext(TooltipContext)` (NOT
 * `useTooltip()`, which throws outside a provider) so an `Input` rendered on a
 * page with no `TooltipProvider` simply shows no tooltip.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} [props.id]
 * @param {string} [props.tooltip] - Hover tooltip text; omitted → no hover target
 * @param {string} props.color
 * @param {string} props.fontSize
 * @param {string} props.fontWeight
 * @returns {preact.VNode}
 */
function InputLabel({ label, id, tooltip, color, fontSize, fontWeight }) {
  const ctx = useContext(TooltipContext)
  const labelNode = html`
    <${Label}
      for=${id}
      color=${color}
      fontSize=${fontSize}
      fontWeight=${fontWeight}
    >${label}</${Label}>
  `
  if (!tooltip) return labelNode
  return html`
    <span
      onMouseEnter=${(e) =>
        ctx?.show(tooltip, e.clientX, e.clientY, e.currentTarget)}
      onMouseLeave=${() => ctx?.hide()}
      >${labelNode}</span
    >
  `
}

/**
 * Input - Themed text input with label and validation state support
 *
 * A styled text input component with optional label, validation message display,
 * and full theme integration for all states.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the input
 * @param {Object} [props.validation] - Validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {string} [props.id] - ID for the input element (also sets name attribute)
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='normal'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `normal`; `auto` not accepted (warns and falls back to the default).
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Control size step
 *   (24 | 34 | 44 | 54px tall); sets height, font size, padding, and border radius
 *   from `theme.controlSize[size]`. Replaces the removed `heightScale` prop, which
 *   now logs a warning and is ignored.
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.type='text'] - Input type (text, password, email, number, etc.)
 * @param {*} [props.value] - Input value
 * @param {Function} [props.onChange] - Change handler
 * @param {Object} [props.buttonProps] - Optional icon button rendered inside the input's right edge
 *   { icon: string, color?: string, disabled?: boolean, onClick: () => void, title?: string, tooltip?: string, loading?: boolean }
 *   Nesting rule: the button renders one size down from the input (`oneSizeDown(size)`,
 *   `tiny` stays `tiny`), vertically centred with an equal inset from the top and
 *   right edges; the input gains matching right padding automatically.
 * @param {string} [props.tooltip] - When set, the label becomes a hover target
 *   showing this text as a tooltip. Read null-safely: an `Input` outside a
 *   `TooltipProvider` is unaffected.
 * @returns {preact.VNode}
 *
 * @example
 * // Basic input with label
 * <Input label="Username" id="username" />
 *
 * @example
 * // Input with validation state
 * <Input label="Email" validation=${{ status: 'invalid', message: 'Invalid email format' }} />
 *
 * @example
 * // Full width small input
 * <Input label="Search" widthScale="full" size="small" />
 *
 * @example
 * // Large input with an embedded (medium) icon button
 * <Input size="large" buttonProps=${{ icon: 'search', title: 'Search', onClick: handleSearch }} />
 *
 * @example
 * // Label with a hover tooltip (no-op outside a TooltipProvider)
 * <Input label="Temperature" tooltip="Higher values make output more random." />
 */
export class Input extends Component {
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
      validation,
      id,
      widthScale,
      size: sizeProp,
      heightScale,
      disabled = false,
      buttonProps,
      tooltip,
      ...rest
    } = this.props
    const { theme } = this.state

    // Resolve the scale props only when they change, so a re-render (e.g. a
    // theme change) does not repeat a heightScale/size/widthScale warning.
    const sizeKey = `${sizeProp}|${heightScale}|${widthScale}`
    if (this.resolvedSizeKey !== sizeKey) {
      this.resolvedSizeKey = sizeKey
      this.resolvedSize = resolveFieldSize(
        'input',
        sizeProp,
        heightScale,
        CONTROL_SIZES,
      )
      this.resolvedWidthScale = resolveWidthScale('input', widthScale, {
        allowAuto: false,
      })
    }
    const { width, flex } = getWidthScaleStyle(
      'input',
      this.resolvedWidthScale,
      { allowAuto: false, theme },
    )
    const size = this.resolvedSize
    const step = getControlSize(theme, size)
    const embedded = getEmbeddedButtonLayout(theme, size)
    const status = validation?.status ?? 'idle'
    const borderColor = validationBorderColor(status, theme)

    // When a button is present, add right-padding so text doesn't flow under it
    const inputStyle = buttonProps
      ? { ...(rest.style || {}), paddingRight: `${embedded.paddingRight}px` }
      : rest.style || undefined
    const mergedButtonDisabled = buttonProps
      ? buttonProps.disabled || disabled
      : undefined

    return html`
      <${FormGroup}
        width=${width}
        flex=${flex}
      >
        ${
          label
            ? html`
                <${InputLabel}
                  label=${label}
                  id=${id}
                  tooltip=${tooltip}
                  color=${theme.colors.text.secondary}
                  fontSize=${theme.typography.fontSize.medium}
                  fontWeight=${theme.typography.fontWeight.medium}
                />
              `
            : ''
        }
        <${InputWrapper}>
          <${StyledInput}
            id=${id}
            name=${id}
            disabled=${disabled}
            height=${step.height}
            padding=${step.fieldPadding}
            borderRadius=${step.borderRadius}
            border=${`2px ${theme.border.style} ${borderColor}`}
            backgroundColor=${theme.colors.background.tertiary}
            color=${theme.colors.text.primary}
            fontSize=${step.fontSize}
            fontFamily=${theme.typography.fontFamily}
            transition=${`border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
            focusColor=${validationFocusColor(status, theme)}
            ...${rest}
            style=${inputStyle}
          />
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
                    onClick=${buttonProps.onClick}
                    style=${{
                      position: 'absolute',
                      top: `${embedded.offset}px`,
                      right: `${embedded.offset}px`,
                    }}
                  />
                `
              : null
          }
        </${InputWrapper}>
        <${ValidationMessage}
          status=${status}
          message=${validation?.message ?? ''}
        />
      </${FormGroup}>
    `
  }
}
