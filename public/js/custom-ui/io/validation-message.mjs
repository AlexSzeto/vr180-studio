/**
 * validation-message.mjs – Shared renderer for field-level validation results.
 *
 * Every io component renders its `validation` prop through `ValidationMessage`
 * and colors its border via `validationBorderColor`, so a validation result
 * looks identical no matter which control produced it.
 *
 * @module custom-ui/io/validation-message
 */
import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'

const StyledValidationMessage = styled('span')`
  margin-top: 4px;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
`
StyledValidationMessage.className = 'validation-message'

/**
 * Border (and focus ring) color for a validation status.
 *
 * `validating` deliberately keeps the neutral border — an in-flight check is
 * not a judgment yet.
 *
 * @param {string} status - 'idle' | 'validating' | 'valid' | 'warning' | 'invalid'
 * @param {Object} theme  - A theme object from `custom-ui/theme.mjs`
 * @returns {string} CSS color
 */
export function validationBorderColor(status, theme) {
  switch (status) {
    case 'valid':
      return theme.colors.success.border
    case 'warning':
      return theme.colors.warning.border
    case 'invalid':
      return theme.colors.danger.border
    default:
      return theme.colors.border.primary
  }
}

/**
 * Focus-ring color for a validation status.
 *
 * A judged status takes over the ring; the two neutral statuses (`idle` and
 * `validating`) keep the normal primary focus ring, so an untouched field looks
 * exactly as it did before it grew a `validation` prop.
 *
 * @param {string} status
 * @param {Object} theme
 * @returns {string} CSS color
 */
export function validationFocusColor(status, theme) {
  if (status === 'idle' || status === 'validating') {
    return theme.colors.primary.border
  }
  return validationBorderColor(status, theme)
}

/**
 * `Panel` color-theme *name* for a validation status.
 *
 * Unlike its sibling `validationBorderColor`, this returns a color name rather
 * than a resolved CSS color — `Panel` does its own theme lookup from the name.
 * The two neutral statuses return `undefined` so the panel stays uncolored.
 *
 * @param {string} status - 'idle' | 'validating' | 'valid' | 'warning' | 'invalid'
 * @returns {string|undefined} A `Panel` `color` prop value, or undefined
 */
export function validationPanelColor(status) {
  switch (status) {
    case 'valid':
      return 'success'
    case 'warning':
      return 'warning'
    case 'invalid':
      return 'danger'
    default:
      return undefined
  }
}

/**
 * Message text color for a validation status.
 *
 * @param {string} status
 * @param {Object} theme
 * @returns {string} CSS color
 */
function validationTextColor(status, theme) {
  if (status === 'validating') return theme.colors.text.secondary
  return validationBorderColor(status, theme)
}

/**
 * ValidationMessage - Small themed status line rendered beneath a field.
 *
 * Renders nothing when there is no message or the field is idle, which is what
 * makes a `valid` result with no message produce no output at all.
 *
 * @param {Object} props
 * @param {string} [props.status='idle'] - 'idle' | 'validating' | 'valid' | 'warning' | 'invalid'
 * @param {string} [props.message=''] - Text to display
 * @returns {preact.VNode|null}
 *
 * @example
 * <ValidationMessage status="invalid" message="Path does not exist" />
 */
export function ValidationMessage({ status = 'idle', message = '' }) {
  const [theme, setTheme] = useState(currentTheme.value)

  useEffect(() => currentTheme.subscribe(setTheme), [])

  if (!message || status === 'idle') return null

  return html`
    <${StyledValidationMessage}
      color=${validationTextColor(status, theme)}
      fontSize=${theme.typography.fontSize.small}
    >${message}</${StyledValidationMessage}>
  `
}
