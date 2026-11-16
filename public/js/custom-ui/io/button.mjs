import { html } from 'htm/preact'
import { Component } from 'preact'
import { styled, keyframes } from '../goober-setup.mjs'
import { currentTheme, CONTROL_SIZES, getControlSize } from '../theme.mjs'
import {
  getWidthScaleStyle,
  resolveWidthScale,
  checkScaleProp,
} from '../util.mjs'
import { log } from '../logger.mjs'
import { Icon } from '../layout/icon.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'

// =========================================================================
// Styled Components
// =========================================================================

const StyledButton = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  /* Layout */
  gap: ${(props) => props.gap};
  height: ${(props) => props.height};
  min-width: ${(props) => props.minWidth};
  padding: ${(props) => props.padding};
  width: ${(props) => props.width || 'auto'};
  flex: ${(props) => props.flex || 'none'};
  pointer-events: ${(props) => props.pointerEvents || 'auto'};

  /* Typography */
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
  font-family: ${(props) => props.fontFamily};
  color: ${(props) => props.textColor};

  /* Border */
  border-width: ${(props) => props.borderWidth};
  border-style: ${(props) => props.borderStyle};
  border-color: ${(props) => props.borderColor};
  border-radius: ${(props) => props.borderRadius};

  /* Colors */
  background-color: ${(props) => props.bgColor};

  /* Transitions */
  transition: ${(props) => props.transition};

  &:hover:not(:disabled) {
    background-color: ${(props) => props.hoverBg};
    border-color: ${(props) => props.hoverBorder};
  }

  &:active:not(:disabled) {
    background-color: ${(props) => props.activeBg};
    border-color: ${(props) => props.activeBorder};
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
StyledButton.className = 'styled-button'

const TextSpan = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`
TextSpan.className = 'text-span'

const LabelWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: ${(props) => props.width || 'auto'};
  flex: ${(props) => props.flex || 'none'};
`
LabelWrapper.className = 'button-label-wrapper'

const LabelText = styled('span')`
  margin-bottom: 5px;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-weight: ${(props) => props.fontWeight};
`
LabelText.className = 'button-label-text'

// Legacy size-bearing `variant` values and the replacement each maps to.
// Used only to build the migration hint in the warning.
const LEGACY_VARIANT_HINTS = {
  'medium-text': 'the default size (remove variant)',
  'medium-icon': 'size="small"',
  'medium-icon-text': 'the default size (remove variant)',
  'large-icon': 'the default size (remove variant)',
  'large-text': 'the default size (remove variant)',
  'small-text': 'size="small"',
  'small-icon': 'size="small"',
  'small-icon-text': 'size="small"',
}

const VARIANTS = ['default', 'chip']

/** True when `children` would render something (not null/false/''/[]). */
function hasContent(children) {
  if (children === null || children === undefined) return false
  if (children === false || children === true || children === '') return false
  if (Array.isArray(children)) return children.some(hasContent)
  return true
}

/**
 * Button - Themed button on the shared control size scale
 *
 * Dimensions (height, font size, icon size, padding, radius, gap) come from
 * `theme.controlSize[size]`, so a Button lines up with any other control at
 * the same `size`. Content is inferred from what is passed:
 * - `icon` (or `loading`) with no children → icon-only, rendered square
 *   (width = height = the size step's height)
 * - children with no icon → text
 * - both → icon + text
 *
 * @param {Object} props
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Size step (24 | 34 | 44 | 54px tall)
 * @param {'default'|'chip'} [props.variant='default'] - Appearance; 'chip' is fully rounded at the given size.
 *   Legacy size values ('small-text', 'medium-icon', …) log a warning with their replacement and render as 'default'.
 * @param {'primary'|'secondary'|'success'|'danger'|'transparent'} [props.color='secondary'] - Color theme
 *   - 'transparent': No background, subtle hover effect, uses primary text color
 * @param {boolean} [props.loading=false] - Shows spinner, disables button
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.icon] - `ICON_MAP` key for the Icon component (e.g. 'play', 'trash')
 * @param {string} [props.label] - Optional label rendered above the button
 * @param {string} [props.tooltip] - Tooltip text shown via TooltipContext on hover.
 *   Also shows while `disabled`/`loading` (the hover target is then a wrapper
 *   span, since a disabled button fires no mouse events) — use it to explain why.
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.title] - Native tooltip text
 * @param {string} [props.type='button'] - Button type attribute
 * @param {'compact'|'normal'|'wide'|'full'|'auto'} [props.widthScale='auto'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow | auto fits content. Default `auto`; `auto` accepted.
 * @param {preact.ComponentChildren} [props.children] - Button text
 * @returns {preact.VNode}
 *
 * @example
 * // Medium text button (keeps a 120px min-width)
 * <Button color="primary">Submit</Button>
 *
 * @example
 * // Small text button
 * <Button size="small" icon="folder-open" color="secondary">Load</Button>
 *
 * @example
 * // Small icon-only button, 34x34
 * <Button size="small" icon="trash" color="danger" />
 *
 * @example
 * // Large icon + text button
 * <Button size="large" icon="play" color="success">Play</Button>
 *
 * @example
 * // Tiny rounded chip
 * <Button variant="chip" size="tiny">tag</Button>
 *
 * @example
 * // Loading state
 * <Button loading={true}>Processing...</Button>
 *
 * @example
 * // Transparent button for tabs or overlays
 * <Button color="transparent">No Background</Button>
 */
export class Button extends Component {
  static contextType = TooltipContext

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
      variant: variantProp,
      size: sizeProp,
      color = 'secondary',
      loading = false,
      disabled = false,
      icon = null,
      label = null,
      tooltip = null,
      widthScale,
      heightScale,
      children,
      ...rest
    } = this.props
    const { theme } = this.state
    const tooltipCtx = this.context

    // Validate the scale props only when they change, so a re-render (e.g. a
    // theme change) does not repeat the same warning.
    const propKey = `${variantProp}|${sizeProp}|${heightScale}|${widthScale}`
    if (this.resolvedPropKey !== propKey) {
      this.resolvedPropKey = propKey
      // heightScale was removed from Button; warn so lib-sync consumers see
      // the cutover, then ignore it.
      if (heightScale !== undefined && heightScale !== null) {
        log(
          'button',
          'warn',
          `heightScale="${heightScale}" is no longer supported — use size="small" (was compact) or size="medium" (was normal); ignoring`,
        )
      }
      this.resolvedVariant = checkScaleProp(
        'button',
        'variant',
        variantProp,
        VARIANTS,
        'default',
        LEGACY_VARIANT_HINTS[variantProp],
      )
      this.resolvedSize = checkScaleProp(
        'button',
        'size',
        sizeProp,
        CONTROL_SIZES,
        'medium',
      )
      this.resolvedWidthScale = resolveWidthScale('button', widthScale, {
        fallback: 'auto',
      })
    }
    const variant = this.resolvedVariant
    const sizeName = this.resolvedSize
    const step = getControlSize(theme, sizeName)

    const hasIcon = !!(icon || loading)
    const hasText = hasContent(children)
    const isIconOnly = hasIcon && !hasText

    const size = {
      height: step.height,
      minWidth: isIconOnly
        ? step.height
        : sizeName === 'medium'
          ? '120px'
          : 'auto',
      padding: isIconOnly ? '0' : step.buttonPadding,
      fontSize: step.fontSize,
      // An icon beside a label is a little larger than the text; an icon
      // alone fills about two thirds of the square.
      iconSize: isIconOnly ? step.iconOnlySize : step.buttonIconSize,
      borderRadius: variant === 'chip' ? '9999px' : step.borderRadius,
      gap: step.gap,
    }

    // Color configurations
    const getColorStyles = (colorName) => {
      // Handle transparent variant specially
      if (colorName === 'transparent') {
        return {
          bg: 'transparent',
          hover: theme.colors.background.hover,
          active: theme.colors.background.hover,
          hoverBorder: 'transparent',
          activeBorder: 'transparent',
          focus: 'transparent',
          text: theme.colors.text.primary,
        }
      }

      const colorTheme = theme.colors[colorName] || theme.colors.secondary
      return {
        bg: colorTheme.background,
        hover: colorTheme.hover,
        active: colorTheme.active,
        hoverBorder: colorTheme.background,
        activeBorder: colorTheme.hover,
        focus: colorTheme.focus,
        text: colorTheme.text || '#ffffff',
      }
    }

    const colorStyles = getColorStyles(color)

    // Prepare props for styled component
    let bgColor = colorStyles.bg
    let borderColor = colorStyles.bg
    let textColor = colorStyles.text

    // Disabled styling override
    if (disabled || loading) {
      bgColor = theme.colors.background.disabled
      borderColor = theme.colors.border.secondary
      textColor = theme.colors.text.disabled
    }

    // `auto` gets no width from the scale: a text button fits its label, and
    // an icon-only button falls back to its content-inferred width (the step
    // height), which keeps it square even inside a stretching flex column.
    const { width: scaleWidth, flex: buttonFlex } = getWidthScaleStyle(
      'button',
      this.resolvedWidthScale,
      { theme },
    )
    const buttonWidth = scaleWidth ?? (isIconOnly ? step.height : undefined)

    const iconColor = disabled ? theme.colors.text.disabled : colorStyles.text
    // Use theme spinner color for loading state for better visibility across themes
    const spinnerColor = theme.colors.spinner.color
    const iconElement = loading
      ? html`<${Icon}
          name="loader-alt"
          animation="spin"
          size=${size.iconSize}
          color=${spinnerColor}
        />`
      : hasIcon && icon
        ? html`<${Icon}
            name=${icon}
            size=${size.iconSize}
            color=${iconColor}
          />`
        : null

    const isInert = disabled || loading
    const tooltipHandlers =
      tooltip && tooltipCtx
        ? {
            onMouseEnter: (e) => tooltipCtx.show(tooltip, e.clientX, e.clientY),
            onMouseLeave: () => tooltipCtx.hide(),
          }
        : {}
    // A disabled <button> fires no mouse events, so a tooltip explaining why
    // it is disabled would never appear. In that case the handlers move to a
    // plain wrapper span that takes over the button's width/flex (so the
    // surrounding layout is unchanged) while the inner button fills it.
    // Enabled buttons keep the handlers on the <button> with no wrapper.
    const useWrapper = !!(tooltip && tooltipCtx && isInert)
    // A caller-supplied style object positions the button as a whole (e.g. an
    // embedded field button's `position: absolute`), so it moves to the
    // wrapper; everything else in `rest` stays on the <button>.
    const { style: restStyle, ...restWithoutStyle } = rest
    const moveStyle =
      useWrapper && restStyle !== null && typeof restStyle === 'object'
    const buttonRest = moveStyle ? restWithoutStyle : rest

    const buttonEl = html`
      <${StyledButton}
        disabled=${isInert}
        gap=${size.gap}
        height=${size.height}
        minWidth=${size.minWidth}
        padding=${size.padding}
        width=${useWrapper ? undefined : buttonWidth}
        flex=${useWrapper ? '1 1 auto' : buttonFlex}
        pointerEvents=${useWrapper ? 'none' : undefined}
        fontSize=${size.fontSize}
        fontWeight=${theme.typography.fontWeight.medium}
        fontFamily=${theme.typography.fontFamily}
        textColor=${textColor}
        borderWidth=${theme.border.width}
        borderStyle=${theme.border.style}
        borderColor=${borderColor}
        borderRadius=${size.borderRadius}
        bgColor=${bgColor}
        hoverBg=${colorStyles.hover}
        hoverBorder=${colorStyles.hoverBorder}
        activeBg=${colorStyles.active}
        activeBorder=${colorStyles.activeBorder}
        transition=${`background-color ${theme.transitions.fast}, border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
        ...${useWrapper ? {} : tooltipHandlers}
        ...${buttonRest}
      >
        ${iconElement}
        ${hasText && html`<${TextSpan}>${children}</${TextSpan}>`}
      </${StyledButton}>
    `

    // The wrapper mirrors StyledButton's own sizing rules: the scale width
    // (or `auto`) and the scale flex (or `none`, which also keeps it from
    // shrinking, like the button's `flex-shrink: 0`). The inner button is
    // `pointer-events: none` so the span itself is always the hover target —
    // some browsers swallow pointer events on a disabled button outright.
    const content = useWrapper
      ? html`<span
          class="button-tooltip-wrapper"
          style=${{
            display: 'inline-flex',
            width: buttonWidth ?? 'auto',
            flex: buttonFlex || 'none',
            ...(moveStyle ? restStyle : {}),
          }}
          ...${tooltipHandlers}
        >
          ${buttonEl}
        </span>`
      : buttonEl

    return label
      ? html`
      <${LabelWrapper} width=${buttonWidth} flex=${buttonFlex}>
        <${LabelText}
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.medium}
          fontWeight=${theme.typography.fontWeight.medium}
          fontFamily=${theme.typography.fontFamily}
        >${label}</${LabelText}>
        ${content}
      </${LabelWrapper}>
    `
      : content
  }
}
