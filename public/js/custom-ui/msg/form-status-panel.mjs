/**
 * form-status-panel.mjs – Form-wide (non-field) status display.
 *
 * Formalizes the "outlined danger panel above the action buttons" pattern so
 * every form reports form-wide errors with identical layout, color and
 * placement. The status vocabulary and its color mapping are shared with the
 * field-level `useInputValidation` hook, so a form-level failure and a
 * field-level one read as the same kind of thing.
 *
 * Placement is the caller's responsibility: render this immediately above the
 * form's action button row and let the enclosing layout's gap space it.
 *
 * @module custom-ui/msg/form-status-panel
 */
import { html } from 'htm/preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { Panel } from '../layout/panel.mjs'
import { Label } from '../themed-base.mjs'
import { validationPanelColor } from '../io/validation-message.mjs'

const StyledMessageList = styled('ul')`
  margin: 0;
  padding-left: ${() => currentTheme.value.spacing.large.padding};
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.medium.gap};
`
StyledMessageList.className = 'form-status-panel-list'

/**
 * FormStatusPanel - Panel reporting form-wide status messages.
 *
 * Renders nothing when there is nothing to say, so callers can drop it into a
 * form unconditionally rather than wrapping it in a ternary.
 *
 * @param {Object} props
 * @param {string[]} [props.messages=[]] - One line each. Empty renders nothing.
 * @param {string} [props.status='invalid'] - 'idle' | 'validating' | 'valid' | 'warning' | 'invalid'
 * @returns {preact.VNode|null}
 *
 * @example
 * <FormStatusPanel messages=${formErrors} />
 *
 * @example
 * <FormStatusPanel status="warning" messages=${warnings} />
 */
export function FormStatusPanel({ messages = [], status = 'invalid' }) {
  if (!messages || messages.length === 0 || status === 'idle') return null

  const body =
    messages.length === 1
      ? html`<${Label}>${messages[0]}</${Label}>`
      : html`
          <${StyledMessageList}>
            ${messages.map(
              (message, index) =>
                html`<li key=${index}><${Label}>${message}</${Label}></li>`,
            )}
          </${StyledMessageList}>
        `

  return html`
    <${Panel}
      variant="outlined"
      padding="medium"
      color=${validationPanelColor(status)}
    >${body}</${Panel}>
  `
}
