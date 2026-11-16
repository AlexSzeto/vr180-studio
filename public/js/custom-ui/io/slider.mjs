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
// Styled Components — mirror range-slider.mjs exactly so stacked sliders align
// =========================================================================

const LABEL_WIDTH = 50 // px — must match range-slider.mjs

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
`
FormGroup.className = 'slider-form-group'

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
`
Label.className = 'slider-label'

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: ${(props) => props.fontFamily};
`
Wrapper.className = 'slider-wrapper'

// Track row geometry (height, thumb diameter, track thickness) comes from
// `theme.sliderSize[size]`; the side margin centres the thumb's travel under
// the fixed-width bounds inputs, so it is derived from the thumb diameter.
const TrackContainer = styled('div')`
  position: relative;
  height: ${(props) => props.rowHeight};
  display: flex;
  align-items: center;
  margin: 0 ${(props) => LABEL_WIDTH / 2 - parseFloat(props.thumb) / 2}px;

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    position: absolute;
    left: 0;
    width: 100%;
    height: ${(props) => props.trackThickness};
    background: transparent;
    pointer-events: none;
    margin: 0;
    padding: 0;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: all;
    width: ${(props) => props.thumb};
    height: ${(props) => props.thumb};
    border-radius: 50%;
    background-color: ${(props) => props.thumbFill};
    border: 2px solid ${(props) => props.thumbBorder};
    cursor: grab;
    transition: transform ${(props) => props.transition};
  }

  input[type='range']::-moz-range-thumb {
    width: ${(props) => props.thumb};
    height: ${(props) => props.thumb};
    border-radius: 50%;
    background-color: ${(props) => props.thumbFill};
    border: 2px solid ${(props) => props.thumbBorder};
    cursor: grab;
    transition: transform ${(props) => props.transition};
    pointer-events: all;
  }

  input[type='range']:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.15);
  }

  input[type='range']:active::-moz-range-thumb {
    cursor: grabbing;
    transform: scale(1.15);
  }
`
TrackContainer.className = 'slider-track-container'

const TrackFill = styled('div')`
  position: absolute;
  left: 0;
  width: 100%;
  height: ${(props) => props.trackThickness};
  border-radius: ${(props) => parseFloat(props.trackThickness) / 2}px;
  background: ${(props) =>
    props.knob
      ? props.trackBg
      : `linear-gradient(to right, ${props.activeBg} ${props.fillPct}%, ${props.trackBg} ${props.fillPct}%)`};
  pointer-events: none;
`
TrackFill.className = 'slider-track-fill'

const BoundsRow = styled('div')`
  display: flex;
  justify-content: space-between;
`
BoundsRow.className = 'slider-bounds-row'

const ValueInput = styled('input')`
  font-size: ${(props) => props.fontSize};
  color: ${(props) => props.color};
  width: ${LABEL_WIDTH}px;
  text-align: center;
  flex-shrink: 0;
  border: 2px ${(props) => props.borderStyle} ${(props) => props.borderColor};
  border-radius: ${(props) => props.borderRadius};
  background: transparent;
  padding: 2px 0;
  font-family: inherit;
  outline: none;
  transition:
    border-color ${(props) => props.transition},
    box-shadow ${(props) => props.transition};
  -moz-appearance: textfield;
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  &:focus {
    box-shadow: 0 0 0 2px ${(props) => props.focusBorderColor};
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
ValueInput.className = 'slider-value-input'

// Invisible spacer that reserves the same width as the right-side input in
// RangeSlider so vertically stacked Slider and RangeSlider components align.
const RightSpacer = styled('div')`
  width: ${LABEL_WIDTH}px;
  flex-shrink: 0;
`
RightSpacer.className = 'slider-right-spacer'

// =========================================================================
// Component
// =========================================================================

/**
 * Slider — Themed single-value slider using a native input[type="range"].
 *
 * Layout mirrors RangeSlider exactly: same track margins, same BoundsRow
 * structure (value input bottom-left, invisible spacer bottom-right), so a
 * Slider and a RangeSlider stacked vertically line up correctly.
 *
 * @param {Object}   props
 * @param {number}   [props.minAllowed=0]       - Minimum allowed value
 * @param {number}   [props.maxAllowed=100]     - Maximum allowed value
 * @param {number}   [props.value]              - Initial value (defaults to minAllowed)
 * @param {number}   [props.snap=1]             - Step/snap increment
 * @param {string}   [props.label]              - Optional label above the slider
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Size step: scales the track row, thumb, track thickness, and value box (text, radius) from `theme.sliderSize`. The label above the track stays at the medium font size, and the stacked layout is kept at every size — sliders line up with neighbours by width, not height.
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='normal'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `normal`; `auto` not accepted (warns and falls back to the default).
 * @param {'normal'|'knob'} [props.variant='normal'] - `normal` fills the track up to the thumb; `knob` keeps the track a uniform color so only the thumb is highlighted
 * @param {boolean}  [props.disabled=false]     - Disables interaction and dims the slider
 * @param {Object}   [props.validation]         - Validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {Function} [props.onChange]           - Called with the new number on every change
 * @returns {preact.VNode}
 *
 * @example
 * <Slider
 *   label="Gain"
 *   minAllowed={0} maxAllowed={1} snap={0.01}
 *   value={0.5}
 *   onChange={(v) => console.log(v)}
 * />
 *
 * @example
 * // Stacks correctly alongside a RangeSlider
 * <Slider   label="Pan" minAllowed={-1} maxAllowed={1} snap={0.1} value={0} />
 * <RangeSlider label="Gain" minAllowed={0} maxAllowed={1} snap={0.01} min={0.3} max={0.7} />
 */
export class Slider extends Component {
  constructor(props) {
    super(props)
    const { minAllowed = 0, value } = props
    this.state = {
      currentValue: value !== undefined ? value : minAllowed,
      theme: currentTheme.value,
      valueRaw: null, // string while input is focused, null otherwise
    }
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.value !== this.props.value &&
      this.props.value !== undefined
    ) {
      this.setState({ currentValue: this.props.value })
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe()
  }

  /** Format a number for display, respecting the snap decimal precision. */
  formatValue(value) {
    const snap = this.props.snap ?? 1
    if (Number.isInteger(snap)) {
      return Math.round(value).toString()
    }
    const decimals = (snap.toString().split('.')[1] || '').length
    return value.toFixed(decimals)
  }

  handleSliderChange(e) {
    const { onChange } = this.props
    const newValue = parseFloat(e.target.value)
    this.setState({ currentValue: newValue })
    if (onChange) onChange(newValue)
  }

  handleSliderInput(e) {
    const { onChange } = this.props
    const newValue = parseFloat(e.target.value)
    this.setState({ currentValue: newValue })
    if (onChange) onChange(newValue)
  }

  handleTrackMouseDown(e) {
    // Only primary button; if user clicked the thumb itself let the browser handle it natively
    if (e.button !== 0 || e.target.tagName === 'INPUT') return
    const { minAllowed = 0, maxAllowed = 100, snap = 1, onChange } = this.props

    const trackEl = e.currentTarget
    const input = trackEl.querySelector('input[type="range"]')

    const computeValue = (clientX) => {
      const rect = trackEl.getBoundingClientRect()
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      )
      const raw = minAllowed + fraction * (maxAllowed - minAllowed)
      const snapped = Math.round(raw / snap) * snap
      return Math.max(minAllowed, Math.min(snapped, maxAllowed))
    }

    // Jump knob to click position immediately — set DOM value directly for instant visual
    const initial = computeValue(e.clientX)
    if (input) input.value = initial
    this.setState({ currentValue: initial })
    if (onChange) onChange(initial)

    // Continue dragging via document-level listeners (avoids re-triggering this handler)
    const onMouseMove = (moveEvent) => {
      const v = computeValue(moveEvent.clientX)
      // Update DOM directly for smooth 60fps visual, setState for state sync
      if (input) input.value = v
      this.setState({ currentValue: v })
      if (onChange) onChange(v)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  /** Apply a typed value from the number input, snapped and clamped. */
  applyInputValue(rawValue) {
    const { minAllowed = 0, maxAllowed = 100, snap = 1, onChange } = this.props
    let v = parseFloat(rawValue)
    if (isNaN(v)) return
    v = Math.round(v / snap) * snap
    v = Math.max(minAllowed, Math.min(v, maxAllowed))
    this.setState({ currentValue: v })
    if (onChange) onChange(v)
  }

  handleInputChange(e) {
    this.setState({ valueRaw: e.target.value })
  }

  handleInputBlur(e) {
    this.applyInputValue(this.state.valueRaw ?? e.target.value)
    this.setState({ valueRaw: null })
  }

  handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.applyInputValue(e.target.value)
      this.setState({ valueRaw: null })
      e.target.blur()
    }
  }

  render() {
    const {
      minAllowed = 0,
      maxAllowed = 100,
      snap = 1,
      label,
      validation,
      widthScale,
      size,
      variant = 'normal',
      disabled = false,
      hideInputs = false,
      // consumed — not forwarded
      value: _value,
      onChange: _onChange,
      ...rest
    } = this.props
    const { currentValue, theme, valueRaw } = this.state
    // Validate size only when it changes, so a re-render does not repeat
    // the warning.
    if (this.sizeKey !== size || this.resolvedSize === undefined) {
      this.sizeKey = size
      this.resolvedSize = checkScaleProp(
        'slider',
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
      this.resolvedWidthScale = resolveWidthScale('slider', widthScale, {
        allowAuto: false,
      })
    }
    const { width, flex } = getWidthScaleStyle(
      'slider',
      this.resolvedWidthScale,
      { allowAuto: false, theme },
    )

    const range = maxAllowed - minAllowed
    const fillPct = range > 0 ? ((currentValue - minAllowed) / range) * 100 : 0

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
        <${Wrapper} fontFamily=${theme.typography.fontFamily} ...${rest}>

          <${TrackContainer}
            rowHeight=${step.trackRowHeight}
            thumb=${step.thumb}
            trackThickness=${step.trackThickness}
            thumbFill=${thumbFill}
            thumbBorder=${thumbBorder}
            transition=${theme.transitions.fast}
            onMouseDown=${(e) => this.handleTrackMouseDown(e)}
          >
            <${TrackFill}
              trackThickness=${step.trackThickness}
              trackBg=${trackBg}
              activeBg=${activeBg}
              fillPct=${fillPct}
              knob=${variant === 'knob'}
            />
            <input
              type="range"
              min=${minAllowed}
              max=${maxAllowed}
              step=${snap}
              value=${currentValue}
              disabled=${disabled}
              onInput=${(e) => this.handleSliderInput(e)}
              onChange=${(e) => this.handleSliderChange(e)}
            />
          </${TrackContainer}>

          <!-- Value input bottom-left, invisible spacer bottom-right to match RangeSlider alignment -->
          ${
            !hideInputs &&
            html`
          <${BoundsRow}>
            <${ValueInput}
              type="number"
              fontSize=${step.textFontSize}
              borderRadius=${step.numberRadius}
              color=${disabled ? theme.colors.text.disabled : theme.colors.text.primary}
              borderColor=${disabled ? theme.colors.border.secondary : theme.colors.border.primary}
              borderStyle=${theme.border.style}
              focusBorderColor=${theme.colors.primary.border}
              transition=${theme.transitions.fast}
              value=${valueRaw !== null ? valueRaw : this.formatValue(currentValue)}
              disabled=${disabled}
              step=${snap}
              min=${minAllowed}
              max=${maxAllowed}
              onChange=${(e) => this.handleInputChange(e)}
              onBlur=${(e) => this.handleInputBlur(e)}
              onKeyDown=${(e) => this.handleInputKeyDown(e)}
            />
            <${RightSpacer} />
          </${BoundsRow}>
          `
          }

        </${Wrapper}>
      <${ValidationMessage}
          status=${validation?.status ?? 'idle'}
          message=${validation?.message ?? ''}
        />
      </${FormGroup}>
    `
  }
}
