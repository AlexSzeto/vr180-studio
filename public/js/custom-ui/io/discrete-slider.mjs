import { html } from 'htm/preact'
import { Component } from 'preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme, CONTROL_SIZES, getSliderSize } from '../theme.mjs'
import {
  checkScaleProp,
  getWidthScaleStyle,
  resolveWidthScale,
} from '../util.mjs'
import { ValidationMessage } from './validation-message.mjs'

// =========================================================================
// Styled Components
// =========================================================================

const LABEL_WIDTH = 60 // px — fixed width for option labels

// The native thumb sits on the runnable track's top edge; this lifts it so
// it is centred on the track. The +1 is the hand-tuned correction the
// original fixed -8px carried (thumb 18px, track 4px), kept so medium is
// unchanged.
const thumbOffset = (props) =>
  -(parseFloat(props.thumb) / 2 - parseFloat(props.trackThickness) / 2 + 1)

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
`
FormGroup.className = 'discrete-slider-form-group'

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
`
Label.className = 'discrete-slider-label'

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: ${(props) => props.fontFamily};
`
Wrapper.className = 'discrete-slider-wrapper'

// Track row geometry comes from `theme.sliderSize[size]`; the side margin
// centres the thumb's travel under the fixed-width option labels.
const RangeWrapper = styled('div')`
  height: ${(props) => props.rowHeight};
  display: flex;
  align-items: center;
  margin: 0 ${(props) => LABEL_WIDTH / 2 - parseFloat(props.thumb) / 2}px;
`
RangeWrapper.className = 'discrete-slider-range-wrapper'

const StyledRange = styled('input')`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: ${(props) => props.trackThickness};
  border-radius: ${(props) => parseFloat(props.trackThickness) / 2}px;
  background: ${(props) => props.trackBg};
  outline: none;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: background ${(props) => props.transition};

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    transform: translateY(${(props) => thumbOffset(props)}px);
    width: ${(props) => props.thumb};
    height: ${(props) => props.thumb};
    border-radius: 50%;
    background-color: ${(props) => props.thumbFill};
    border: 2px solid ${(props) => props.thumbBorder};
    cursor: grab;
    transition: transform ${(props) => props.transition};
  }

  &::-moz-range-thumb {
    transform: translateY(${(props) => thumbOffset(props)}px);
    width: ${(props) => props.thumb};
    height: ${(props) => props.thumb};
    border-radius: 50%;
    background-color: ${(props) => props.thumbFill};
    border: 2px solid ${(props) => props.thumbBorder};
    cursor: grab;
    transition: transform ${(props) => props.transition};
    border: 2px solid ${(props) => props.thumbBorder};
  }

  &:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: translateY(${(props) => thumbOffset(props)}px) scale(1.15);
  }

  &:active::-moz-range-thumb {
    cursor: grabbing;
    transform: translateY(${(props) => thumbOffset(props)}px) scale(1.15);
  }

  &::-webkit-slider-runnable-track {
    height: ${(props) => props.trackThickness};
    border-radius: ${(props) => parseFloat(props.trackThickness) / 2}px;
    background: linear-gradient(
      to right,
      ${(props) => props.activeBg} ${(props) => props.fillPct}%,
      ${(props) => props.trackBg} ${(props) => props.fillPct}%
    );
  }

  &::-moz-range-progress {
    height: ${(props) => props.trackThickness};
    border-radius: ${(props) => parseFloat(props.trackThickness) / 2}px;
    background-color: ${(props) => props.activeBg};
  }

  &::-moz-range-track {
    height: ${(props) => props.trackThickness};
    border-radius: ${(props) => parseFloat(props.trackThickness) / 2}px;
    background-color: ${(props) => props.trackBg};
  }
`
StyledRange.className = 'discrete-slider-range'

const LabelsRow = styled('div')`
  display: flex;
  justify-content: space-between;
`
LabelsRow.className = 'discrete-slider-labels-row'

const OptionLabel = styled('span')`
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
  color: ${(props) => props.color};
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  transition: color ${(props) => props.transition};
  text-align: center;
  width: ${LABEL_WIDTH}px;
  flex-shrink: 0;
`
OptionLabel.className = 'discrete-slider-option-label'

// =========================================================================
// Component
// =========================================================================

/**
 * DiscreteSlider — Themed slider for selecting from a fixed list of options.
 *
 * Uses a single native input[type="range"] with min=0, max=options.length-1
 * and step=1. The integer index is mapped to the corresponding option value.
 * Clickable option labels below the slider let the user jump directly to any
 * value. Keyboard arrow keys and smooth dragging both work natively.
 *
 * @param {Object}   props
 * @param {Array}    props.options          - Array of option values to choose from
 * @param {*}        [props.value]          - Currently selected value (must be in options)
 * @param {Function} [props.onChange]       - Called with the selected value on change
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Size step: scales the track row, thumb, track thickness, and option-label text from `theme.sliderSize`. The label above the track stays at the medium font size, and option labels keep their fixed 60px width.
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='normal'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `normal`; `auto` not accepted (warns and falls back to the default).
 * @param {boolean}  [props.disabled=false] - When true, disables interaction and dims the slider
 * @param {Object}   [props.validation]     - Validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @returns {preact.VNode}
 *
 * @example
 * // Basic usage
 * <DiscreteSlider
 *   options={['low', 'medium', 'high']}
 *   value="medium"
 *   onChange={(val) => console.log(val)}
 * />
 *
 * @example
 * // Numeric options
 * <DiscreteSlider options={[0.25, 0.5, 1, 2, 4]} value={1} />
 *
 * @example
 * // Disabled state
 * <DiscreteSlider options={['a', 'b', 'c']} value="a" disabled={true} />
 */
export class DiscreteSlider extends Component {
  constructor(props) {
    super(props)
    const { options = [], value } = props
    const getOptionValue = (opt) =>
      opt && typeof opt === 'object' ? opt.value : opt
    const idx =
      value !== undefined
        ? options.findIndex((opt) => getOptionValue(opt) === value)
        : 0
    this.state = {
      index: idx >= 0 ? idx : 0,
      theme: currentTheme.value,
    }
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe()
  }

  handleRangeChange(e) {
    const { options = [], onChange, disabled } = this.props
    if (disabled) return
    const idx = parseInt(e.target.value, 10)
    this.setState({ index: idx })
    if (onChange) {
      const opt = options[idx]
      const val = opt && typeof opt === 'object' ? opt.value : opt
      // Pass a synthetic event object to match Select
      onChange({ target: { value: val } })
    }
  }

  handleLabelClick(idx) {
    const { options = [], onChange, disabled } = this.props
    if (disabled) return
    this.setState({ index: idx })
    if (onChange) {
      const opt = options[idx]
      const val = opt && typeof opt === 'object' ? opt.value : opt
      onChange({ target: { value: val } })
    }
  }

  render() {
    const {
      options = [],
      label,
      validation,
      widthScale,
      size,
      disabled = false,
      // consumed — not forwarded
      value: _value,
      onChange: _onChange,
      ...rest
    } = this.props
    const { index, theme } = this.state
    // Validate size only when it changes, so a re-render does not repeat
    // the warning.
    if (this.sizeKey !== size || this.resolvedSize === undefined) {
      this.sizeKey = size
      this.resolvedSize = checkScaleProp(
        'discrete-slider',
        'size',
        size,
        CONTROL_SIZES,
        'medium',
      )
    }
    const step = getSliderSize(theme, this.resolvedSize)
    // Validate widthScale only when it changes, so a re-render does not
    // repeat the warning.
    if (
      this.widthScaleKey !== widthScale ||
      this.resolvedWidthScale === undefined
    ) {
      this.widthScaleKey = widthScale
      this.resolvedWidthScale = resolveWidthScale(
        'discrete-slider',
        widthScale,
        {
          allowAuto: false,
        },
      )
    }
    let { width, flex } = getWidthScaleStyle(
      'discrete-slider',
      this.resolvedWidthScale,
      { allowAuto: false, theme },
    )
    width = width.endsWith('px')
      ? Math.max(
          Number(width.replace('px', '')),
          options.length * LABEL_WIDTH,
        ) + 'px'
      : width

    const maxIdx = options.length - 1
    // Fill percentage for the webkit runnable track gradient
    const fillPct = maxIdx > 0 ? (index / maxIdx) * 100 : 0

    // Use muted colours when disabled
    const thumbFill = disabled
      ? theme.colors.text.disabled
      : theme.colors.primary.background
    const thumbBorder = thumbFill
    const activeBg = disabled
      ? theme.colors.text.disabled
      : theme.colors.primary.background
    const trackBg = disabled
      ? theme.colors.background.disabled
      : theme.colors.border.primary

    return html`
      <${FormGroup} width=${width} flex=${flex} disabled=${disabled}>
        ${
          label
            ? html`
          <${Label}
            color=${disabled ? theme.colors.text.disabled : theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        `
            : ''
        }
        <${Wrapper}
          fontFamily=${theme.typography.fontFamily}
          ...${rest}
        >
        <${RangeWrapper} rowHeight=${step.trackRowHeight} thumb=${step.thumb}>
          <${StyledRange}
            type="range"
            min="0"
            max=${maxIdx}
            step="1"
            value=${index}
            disabled=${disabled}
            onChange=${(e) => this.handleRangeChange(e)}
            thumb=${step.thumb}
            trackThickness=${step.trackThickness}
            trackBg=${trackBg}
            activeBg=${activeBg}
            thumbFill=${thumbFill}
            thumbBorder=${thumbBorder}
            thumbShadow=${theme.shadow.elevated}
            transition=${theme.transitions.fast}
            fillPct=${fillPct}
          />
        </${RangeWrapper}>
        <${LabelsRow}>
          ${options.map((opt, i) => {
            const optLabel =
              opt && typeof opt === 'object'
                ? opt.label !== undefined
                  ? opt.label
                  : opt.value
                : opt
            return html`
              <${OptionLabel}
                key=${i}
                fontSize=${step.textFontSize}
                fontWeight=${i === index ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal}
                color=${
                  disabled
                    ? theme.colors.text.disabled
                    : i === index
                      ? theme.colors.primary.background
                      : theme.colors.text.muted
                }
                disabled=${disabled}
                transition=${theme.transitions.fast}
                onClick=${() => this.handleLabelClick(i)}
              >${optLabel}</${OptionLabel}>
            `
          })}
        </${LabelsRow}>
      </${Wrapper}>
      <${ValidationMessage}
          status=${validation?.status ?? 'idle'}
          message=${validation?.message ?? ''}
        />
      </${FormGroup}>
    `
  }
}
