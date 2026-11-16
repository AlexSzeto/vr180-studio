import { html } from 'htm/preact'
import { Component } from 'preact'
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

const StyledTextarea = styled('textarea')`
  width: 100%;
  padding: ${(props) => props.padding};
  border-radius: ${(props) => props.borderRadius};
  resize: vertical;
  min-height: 80px;
  border: ${(props) => props.border};
  background-color: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-family: ${(props) => props.fontFamily};
  transition: ${(props) => props.transition};
  field-sizing: content;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.focusColor};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
StyledTextarea.className = 'styled-textarea'

const TextareaWrapper = styled('div')`
  position: relative;
  width: 100%;
`
TextareaWrapper.className = 'textarea-wrapper'

/**
 * Textarea - Themed multi-line text input with label and validation state support
 *
 * A styled textarea component with optional label, validation message display,
 * and full theme integration for all states. Matches Input component styling
 * for visual consistency.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the textarea
 * @param {Object} [props.validation] - Validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {string} [props.id] - ID for the textarea element (also sets name attribute)
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='full'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `full`; `auto` not accepted (warns and falls back to the default).
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Control size step; sets
 *   font size, padding, and border radius from `theme.controlSize[size]`, and the embedded
 *   buttons' size. Height is NOT controlled by `size` (the textarea keeps its 80px
 *   min-height and vertical resize). The removed `heightScale` prop logs a warning and
 *   is ignored.
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.placeholder] - Placeholder text
 * @param {number} [props.rows=4] - Number of visible text lines
 * @param {*} [props.value] - Textarea value
 * @param {Function} [props.onChange] - Change handler
 * @param {Object|Array<Object>} [props.buttonProps] - Optional icon button(s) rendered
 *   pinned to the top-right corner inside the textarea. Either a single object or an
 *   array of them (rendered as a horizontal row, first entry leftmost). Nesting rule:
 *   buttons render one size down from the textarea (`oneSizeDown(size)`, `tiny` stays
 *   `tiny`), inset `(stepHeight − buttonHeight) / 2` from the top and right as if the
 *   field were one row tall, `controlSize[size].gap` apart; the textarea's right padding
 *   is `n × buttonHeight + (n − 1) × gap + 2 × inset`. Each entry:
 *   { icon: string, color?: string, disabled?: boolean, onClick: () => void, title?: string, tooltip?: string, loading?: boolean }
 *   Each entry's `disabled` is OR-merged with the textarea's own `disabled`.
 * @returns {preact.VNode}
 *
 * @example
 * // Basic textarea with label
 * <Textarea label="Description" id="description" />
 *
 * @example
 * // Textarea with validation state
 * <Textarea label="Comments" validation=${{ status: 'invalid', message: 'Comments are required' }} />
 *
 * @example
 * // Textarea with custom rows
 * <Textarea label="Notes" rows={6} />
 *
 * @example
 * // Small textarea (12px text, tiny embedded button)
 * <Textarea size="small" buttonProps=${{ icon: 'copy', title: 'Copy', onClick: copy }} />
 *
 * @example
 * // Textarea with action button
 * <Textarea label="Self Profile" buttonProps=${{ icon: 'captions', title: 'Generate', onClick: handleGenerate }} />
 *
 * @example
 * // Textarea with a horizontal row of action buttons (first entry leftmost)
 * <Textarea
 *   widthScale="full"
 *   buttonProps=${[
 *     { icon: 'list-plus', color: 'secondary', title: 'Queue', onClick: queue },
 *     { icon: 'play', color: 'primary', title: 'Send', onClick: send },
 *   ]}
 * />
 */
export class Textarea extends Component {
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
      rows = 4,
      buttonProps,
      ...rest
    } = this.props
    const { theme } = this.state

    // Resolve the scale props only when they change, so a re-render (e.g. a
    // theme change) does not repeat a heightScale/size/widthScale warning.
    const sizeKey = `${sizeProp}|${heightScale}|${widthScale}`
    if (this.resolvedSizeKey !== sizeKey) {
      this.resolvedSizeKey = sizeKey
      this.resolvedSize = resolveFieldSize(
        'textarea',
        sizeProp,
        heightScale,
        CONTROL_SIZES,
      )
      this.resolvedWidthScale = resolveWidthScale('textarea', widthScale, {
        allowAuto: false,
        fallback: 'full',
      })
    }
    const size = this.resolvedSize
    const step = getControlSize(theme, size)
    const { width, flex } = getWidthScaleStyle(
      'textarea',
      this.resolvedWidthScale,
      { allowAuto: false, fallback: 'full', theme },
    )
    const status = validation?.status ?? 'idle'
    const borderColor = validationBorderColor(status, theme)

    // Normalise to a single array path: single object, array, or nothing.
    const buttons = Array.isArray(buttonProps)
      ? buttonProps
      : buttonProps
        ? [buttonProps]
        : []

    // When buttons are present, add right-padding so text doesn't flow under
    // the row of embedded buttons (see getEmbeddedButtonLayout).
    const embedded = getEmbeddedButtonLayout(theme, size, buttons.length)
    const textareaStyle =
      buttons.length > 0
        ? {
            ...(rest.style || {}),
            paddingRight: `${embedded.paddingRight}px`,
          }
        : rest.style || undefined

    return html`
      <${FormGroup}
        width=${width}
        flex=${flex}
      >
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
        <${TextareaWrapper}>
          <${StyledTextarea}
            id=${id}
            name=${id}
            disabled=${disabled}
            rows=${rows}
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
            style=${textareaStyle}
          />
          ${
            buttons.length > 0
              ? html`
                  <div
                    style=${{
                      position: 'absolute',
                      top: `${embedded.offset}px`,
                      right: `${embedded.offset}px`,
                      display: 'flex',
                      gap: `${embedded.gap}px`,
                    }}
                  >
                    ${buttons.map(
                      (b, i) => html`
                        <${Button}
                          size=${embedded.buttonSize}
                          key=${i}
                          icon=${b.icon}
                          color=${b.color}
                          disabled=${b.disabled || disabled}
                          loading=${b.loading}
                          title=${b.title}
                          tooltip=${b.tooltip}
                          onClick=${b.onClick}
                        />
                      `,
                    )}
                  </div>
                `
              : null
          }
        </${TextareaWrapper}>
        <${ValidationMessage}
          status=${status}
          message=${validation?.message ?? ''}
        />
      </${FormGroup}>
    `
  }
}
