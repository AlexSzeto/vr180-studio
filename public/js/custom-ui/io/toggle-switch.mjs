import { html } from 'htm/preact'
import { Component } from 'preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme, CONTROL_SIZES, getToggleControlSize } from '../theme.mjs'
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
// switch keeps the exact markup (and inline-flex sizing) it had before.
const ValidationColumn = styled('div')`
  display: inline-flex;
  flex-direction: column;
  gap: ${(props) => props.gap};
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
ValidationColumn.className = 'toggle-switch-validation-column'

// The outer <label> wraps the hidden checkbox, track, and knob together
// so clicking anywhere on the component toggles the checkbox.
const SwitchLabel = styled('label')`
  display: inline-flex;
  align-items: center;
  gap: ${(props) => props.gap};
  cursor: ${(props) => props.cursor};
  opacity: ${(props) => props.opacity};
  user-select: none;
  font-family: ${(props) => props.fontFamily};
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
  box-sizing: border-box;
`
SwitchLabel.className = 'toggle-switch-label'

// Visually-hidden checkbox — browser handles toggle logic and focus.
const HiddenCheckbox = styled('input')`
  display: none;
`
HiddenCheckbox.className = 'toggle-switch-hidden-checkbox'

// The pill-shaped track
const Track = styled('div')`
  position: relative;
  width: ${(props) => props.trackWidth};
  height: ${(props) => props.trackHeight};
  border-radius: ${(props) => props.borderRadius};
  flex-shrink: 0;
  background-color: ${(props) => props.backgroundColor};
  border: 2px solid ${(props) => props.borderColor};
  transition:
    background-color ${(props) => props.transition},
    border-color ${(props) => props.transition};
`
Track.className = 'toggle-switch-track'

// The circular knob that slides left/right
const Knob = styled('div')`
  position: absolute;
  top: ${(props) => props.top};
  left: ${(props) => props.left};
  width: ${(props) => props.knobSize};
  height: ${(props) => props.knobSize};
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor};
  transition:
    left ${(props) => props.transition},
    background-color ${(props) => props.transition};
`
Knob.className = 'toggle-switch-knob'

// Grows into any slack a fixed `widthScale` leaves beside the track; at the
// default `auto` width there is no slack, so this is a no-op.
const LabelText = styled('span')`
  flex: 1 1 auto;
  min-width: 0;
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
  color: ${(props) => props.color};
`
LabelText.className = 'toggle-switch-label-text'

// =========================================================================
// Component
// =========================================================================

/**
 * ToggleSwitch — Themed on/off toggle using a hidden checkbox with CSS transitions.
 *
 * The `checked` state is managed entirely via the native checkbox `onChange`
 * event — no manual JS toggle logic. Visual transitions (track color, knob
 * position) are driven by CSS through goober props. The `disabled` attribute
 * is forwarded directly to the underlying checkbox for native browser behavior.
 *
 * @param {Object}   props
 * @param {boolean}  [props.checked=false]   - Checked (on) state
 * @param {Function} [props.onChange]        - Change handler, called with the native event
 * @param {boolean}  [props.disabled=false]  - Disabled state (native, reduces opacity)
 * @param {string}   [props.label]           - Optional label displayed beside the switch
 * @param {'left'|'right'} [props.labelPosition='right'] - Side of the label relative to switch
 * @param {string}   [props.id]              - ID forwarded to the hidden checkbox
 * @param {Object}   [props.validation]      - Validation result `{ status, message }`; when present
 *   the row is wrapped in a column so the message can sit beneath it. Pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Size step: scales the track, knob, and label text from `theme.toggleControlSize`. The control does not reserve the row height — it lines up in a row via the row's vertical centring.
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale='auto'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `auto`; `auto` accepted. A fixed width applies to the outer wrapper and the label absorbs the slack.
 * @returns {preact.VNode}
 *
 * @example
 * // Minimal toggle
 * <ToggleSwitch checked={true} onChange={(e) => console.log(e.target.checked)} />
 *
 * @example
 * // With label
 * <ToggleSwitch label="Enable feature" checked={false} onChange={handleChange} />
 *
 * @example
 * // Disabled
 * <ToggleSwitch label="Unavailable" disabled={true} checked={false} />
 *
 * @example
 * // Label on left
 * <ToggleSwitch label="Dark mode" labelPosition="left" checked={isDark} onChange={toggle} />
 */
export class ToggleSwitch extends Component {
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
    if (this.unsubscribe) this.unsubscribe()
  }

  render() {
    const {
      checked = false,
      onChange,
      disabled = false,
      label,
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
        'toggle-switch',
        'size',
        size,
        CONTROL_SIZES,
        'medium',
      )
    }
    const step = getToggleControlSize(theme, this.resolvedSize)
    // Knob geometry, derived from the step so medium reproduces the original
    // hand-tuned values (track 42x22, radius 12px, knob 14px at top 2px,
    // left 2px <-> 22px). BORDER is the track border, INSET the knob's
    // resting distance from the track's left edge.
    const BORDER = 2
    const INSET = 2
    const trackW = parseFloat(step.trackWidth)
    const trackH = parseFloat(step.trackHeight)
    const knob = parseFloat(step.knob)
    const knobTop = (trackH - 2 * BORDER - knob) / 2
    const knobLeftOn = trackW - 2 * BORDER - knob - INSET

    const hasLabel = label != null && String(label).trim() !== ''

    // Validate widthScale only when it changes, so a re-render does not
    // repeat the warning.
    if (
      this.widthScaleKey !== widthScale ||
      this.resolvedWidthScale === undefined
    ) {
      this.widthScaleKey = widthScale
      this.resolvedWidthScale = resolveWidthScale('toggle-switch', widthScale, {
        fallback: 'auto',
      })
    }
    const { width, flex } = getWidthScaleStyle(
      'toggle-switch',
      this.resolvedWidthScale,
      { fallback: 'auto', theme },
    )
    // The width goes on the outermost element: the validation column when
    // present (the row then fills it), otherwise the row itself.
    const rowWidth = validation ? undefined : width
    const rowFlex = validation ? undefined : flex

    const trackEl = html`
      <${Track}
        trackWidth=${step.trackWidth}
        trackHeight=${step.trackHeight}
        borderRadius=${`${trackH / 2 + 1}px`}
        backgroundColor=${checked ? theme.colors.primary.background : theme.colors.background.tertiary}
        borderColor=${checked ? theme.colors.primary.background : theme.colors.border.primary}
        transition=${theme.transitions.normal}
      >
        <${Knob}
          top=${`${knobTop}px`}
          left=${`${checked ? knobLeftOn : INSET}px`}
          knobSize=${step.knob}
          backgroundColor=${checked ? theme.colors.primary.text : theme.colors.text.muted}
          shadow=${theme.shadow.elevated}
          transition=${theme.transitions.normal}
        />
      </${Track}>
    `

    const labelEl = hasLabel
      ? html`
      <${LabelText}
        fontSize=${step.labelFontSize}
        fontWeight=${theme.typography.fontWeight.medium}
        color=${disabled ? theme.colors.text.disabled : theme.colors.text.secondary}
      >${label}</${LabelText}>
    `
      : null

    const row = html`
      <${SwitchLabel}
        gap=${hasLabel ? '8px' : '0'}
        cursor=${disabled ? 'not-allowed' : 'pointer'}
        opacity=${disabled ? '0.5' : '1'}
        fontFamily=${theme.typography.fontFamily}
        width=${rowWidth}
        flex=${rowFlex}
      >
        <${HiddenCheckbox}
          type="checkbox"
          id=${id}
          name=${id}
          checked=${checked}
          disabled=${disabled}
          onChange=${onChange}
          ...${rest}
        />
        ${
          labelPosition === 'left'
            ? html`${labelEl}${trackEl}`
            : html`${trackEl}${labelEl}`
        }
      </${SwitchLabel}>
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
