/**
 * theme.mjs - Centralized theming system for custom UI components
 *
 * This module provides a complete theming solution with:
 * - Spacing scale (tiny/small/medium/large gap + padding) and border radius scale
 * - Light and dark color themes
 * - Reactive theme switching
 * - Helper functions for accessing theme values
 *
 * ## Usage for non-custom-ui components:
 *
 * ### Accessing current theme values:
 * ```javascript
 * import { currentTheme, getThemeValue } from './theme.mjs';
 *
 * // Direct access to current theme
 * const bgColor = currentTheme.value.colors.background.primary;
 *
 * // Or use helper function with dot notation
 * const textColor = getThemeValue('colors.text.primary');
 * ```
 *
 * ### Subscribing to theme changes:
 * ```javascript
 * import { currentTheme } from './theme.mjs';
 *
 * // In a Preact component using signals
 * const MyComponent = () => {
 *   const theme = currentTheme.value;
 *   return html`<div style="color: ${theme.colors.text.primary}">...</div>`;
 * };
 *
 * // Or subscribe manually
 * currentTheme.subscribe((theme) => {
 *   document.body.style.backgroundColor = theme.colors.background.primary;
 * });
 * ```
 */

import { checkScaleProp, getCookie, setCookie } from './util.mjs'

// ============================================================================
// Spacing Sub-Theme
// ============================================================================

const spacingSubTheme = {
  // Spacing scale — shares the control size names so a row of `size` S
  // controls uses gap S (see COMPOSITION.md "Spacing scale").
  spacing: {
    tiny: { gap: '2px', padding: '2px' },
    small: { gap: '4px', padding: '4px' },
    medium: { gap: '8px', padding: '8px' },
    large: { gap: '16px', padding: '16px' },
  },
  border: {
    width: '2px',
    style: 'solid',
    radius: { tiny: '2px', small: '4px', medium: '8px', large: '16px' },
  },
  transitions: {
    fast: '0.15s ease',
    normal: '0.25s ease',
    slow: '0.4s ease',
    verySlow: '0.6s ease',
  },
  // Shared control size scale (Button, Input, Select, …). `fontSizeKey`
  // references `typography.fontSize` rather than storing px, because
  // typography lives in a separate sub-theme; read steps through
  // getControlSize() to get the resolved `fontSize`. Icons come in three
  // sizes: outside buttons an icon matches the text (`iconSize` = `fontSize`,
  // derived in getControlSize); in an icon + text button or chip it is a
  // little larger (`buttonIconSize`); alone in a square icon-only button it
  // fills about two thirds of the height (`iconOnlySize`).
  controlSize: {
    tiny: {
      height: '24px',
      fontSizeKey: 'small',
      buttonIconSize: '14px',
      iconOnlySize: '16px',
      fieldPadding: '2px 6px',
      buttonPadding: '0 8px',
      borderRadius: '4px',
      gap: '4px',
    },
    small: {
      height: '34px',
      fontSizeKey: 'small',
      buttonIconSize: '16px',
      iconOnlySize: '22px',
      fieldPadding: '4px 6px',
      buttonPadding: '0 8px',
      borderRadius: '4px',
      gap: '4px',
    },
    medium: {
      height: '44px',
      fontSizeKey: 'medium',
      buttonIconSize: '24px',
      iconOnlySize: '28px',
      fieldPadding: '8px 12px',
      buttonPadding: '8px 16px',
      borderRadius: '8px',
      gap: '8px',
    },
    large: {
      height: '54px',
      fontSizeKey: 'large',
      buttonIconSize: '28px',
      iconOnlySize: '34px',
      fieldPadding: '12px 16px',
      buttonPadding: '0 24px',
      borderRadius: '8px',
      gap: '8px',
    },
  },
  // Shared control width scale — the fixed widths behind the `widthScale`
  // prop (`compact` / `normal` / `wide`). Multiples of 80px, and deliberately
  // independent of `controlSize`: a control keeps its width at every size.
  // `full` (100% + flex-grow) and `auto` (fit content) need no token; see
  // getWidthScaleStyle in util.mjs.
  controlWidth: {
    compact: '80px',
    normal: '160px',
    wide: '320px',
  },
  // StackedMeter: bar height, and the peak tick's width and how far it
  // overhangs the bar above and below.
  meter: {
    height: '12px',
    tickWidth: '2px',
    tickOverhang: '3px',
  },
  // Secondary-control size tokens, one group per control family and keyed by
  // the same steps as `controlSize`. Each group is deliberately independent
  // of `controlSize` (including its own font-size key) so a family can be
  // retuned without moving the core controls. Font sizes are keys into
  // `typography.fontSize`, resolved at read time.
  //
  // Checkbox box / check glyph and ToggleSwitch track / knob, plus their
  // inline label text. Neither control reserves the row height — only the
  // indicator and label scale.
  toggleControlSize: {
    tiny: {
      checkboxBox: '14px',
      checkGlyph: '10px',
      trackWidth: '26px',
      trackHeight: '14px',
      knob: '8px',
      labelFontSizeKey: 'small',
    },
    small: {
      checkboxBox: '18px',
      checkGlyph: '13px',
      trackWidth: '34px',
      trackHeight: '18px',
      knob: '11px',
      labelFontSizeKey: 'small',
    },
    medium: {
      checkboxBox: '22px',
      checkGlyph: '16px',
      trackWidth: '42px',
      trackHeight: '22px',
      knob: '14px',
      labelFontSizeKey: 'medium',
    },
    large: {
      checkboxBox: '26px',
      checkGlyph: '19px',
      trackWidth: '50px',
      trackHeight: '26px',
      knob: '17px',
      labelFontSizeKey: 'large',
    },
  },
  // Slider / RangeSlider / DiscreteSlider parts. Sliders keep their stacked
  // layout at every size; `textFontSizeKey` covers the number boxes and the
  // DiscreteSlider option labels (not the field label above the track).
  sliderSize: {
    tiny: {
      trackRowHeight: '16px',
      thumb: '10px',
      trackThickness: '2px',
      textFontSizeKey: 'small',
      numberRadius: '4px',
    },
    small: {
      trackRowHeight: '22px',
      thumb: '14px',
      trackThickness: '3px',
      textFontSizeKey: 'small',
      numberRadius: '4px',
    },
    medium: {
      trackRowHeight: '28px',
      thumb: '18px',
      trackThickness: '4px',
      textFontSizeKey: 'medium',
      numberRadius: '6px',
    },
    large: {
      trackRowHeight: '34px',
      thumb: '22px',
      trackThickness: '5px',
      textFontSizeKey: 'large',
      numberRadius: '8px',
    },
  },
  // Pill (the Preact component) and the DOM pills drawn inside
  // ContentEditablePillInput / TagInput. `height` is its own token rather
  // than a read of `controlSize.height` so pills stay independently
  // adjustable; it starts equal to the control height. `paddingX` widens
  // faster than the text so the straight middle of a larger pill stays in
  // proportion to its rounded ends. `slotPadding` grows so a `{{slot}}`
  // token fills most of the pill's height, keeping the gap to the pill's
  // edge small (2 / 4 / 5 / 6px) instead of widening with the pill.
  pillSize: {
    tiny: {
      height: '24px',
      fontSizeKey: 'small',
      iconSize: '14px',
      paddingX: '8px',
      slotPadding: '2px 6px',
    },
    small: {
      height: '34px',
      fontSizeKey: 'small',
      iconSize: '16px',
      paddingX: '12px',
      slotPadding: '5px 9px',
    },
    medium: {
      height: '44px',
      fontSizeKey: 'medium',
      iconSize: '20px',
      paddingX: '16px',
      slotPadding: '8px 12px',
    },
    large: {
      height: '54px',
      fontSizeKey: 'large',
      iconSize: '24px',
      paddingX: '20px',
      slotPadding: '11px 15px',
    },
  },
  // RowTitle (the title in a title + control row). Holds only the title
  // variant's font size: its height and the text variant's font are read
  // from `controlSize` in getRowTitleSize(), so a row title can never drift
  // from the controls beside it. The title font is its own scale so even a
  // small row's title still reads as a section header.
  rowTitleSize: {
    tiny: { titleFontSize: '14px' },
    small: { titleFontSize: '16px' },
    medium: { titleFontSize: '19px' },
    large: { titleFontSize: '22px' },
  },
  // Max height of a dropdown popover (Select's list, PillSelectPanel's
  // column) before it scrolls. `medium` is Select's original 280px; the
  // other steps scale it by the step's control/pill height (24 / 34 / 44 /
  // 54px) so each holds about the same number of rows as `medium`.
  popoverMaxHeight: {
    tiny: '152px',
    small: '216px',
    medium: '280px',
    large: '344px',
  },
}

/** Ordered steps of the control size scale (`theme.controlSize` keys). */
export const CONTROL_SIZES = ['tiny', 'small', 'medium', 'large']

/** Ordered steps of the spacing scale (`theme.spacing` keys). */
export const SPACING_SIZES = ['tiny', 'small', 'medium', 'large']

/**
 * Resolves a spacing-scale prop (layout `gap`, Panel `padding`) to its
 * `theme.spacing` step. A missing value resolves to `medium` silently; an
 * unknown one logs a warning via `log(source, 'warn', …)` and falls back to
 * `medium`, mirroring `widthScale` handling.
 *
 * @param {object} theme - The current theme
 * @param {string} source - Logger source name (e.g. 'panel')
 * @param {string} propName - Prop name for the warning (e.g. 'gap')
 * @param {*} value - The prop value
 * @returns {{ gap: string, padding: string }}
 */
export function getSpacing(theme, source, propName, value) {
  return theme.spacing[
    checkScaleProp(source, propName, value, SPACING_SIZES, 'medium')
  ]
}

/**
 * Returns one step of `theme.controlSize` with `fontSize` resolved from
 * `theme.typography.fontSize[fontSizeKey]`, and `iconSize` (for an icon
 * outside a button, e.g. beside paragraph text) set equal to that
 * `fontSize`. Buttons use `buttonIconSize` (icon + text, chips) or
 * `iconOnlySize` (icon-only) instead.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {{ height: string, fontSize: string, iconSize: string, buttonIconSize: string, iconOnlySize: string, fieldPadding: string, buttonPadding: string, borderRadius: string, gap: string }}
 */
export function getControlSize(theme, size) {
  const step = theme.controlSize[size] || theme.controlSize.medium
  const fontSize = theme.typography.fontSize[step.fontSizeKey]
  return { ...step, fontSize, iconSize: fontSize }
}

/**
 * Nesting rule: a button embedded inside a field renders one size step down
 * (large→medium, medium→small, small→tiny). `tiny` stays `tiny` — a tiny
 * field's embedded button does not fit, a documented known exception.
 * Unknown values are treated as `medium`.
 *
 * @param {'tiny'|'small'|'medium'|'large'} size - The field's size step
 * @returns {'tiny'|'small'|'medium'} The embedded button's size step
 */
export function oneSizeDown(size) {
  const i = CONTROL_SIZES.indexOf(size)
  if (i === -1) return 'small'
  return CONTROL_SIZES[Math.max(0, i - 1)]
}

/**
 * Spacing pairing rule: distinct groups of controls, and the Panel padding
 * around them, step one size up from the controls' size (tiny→small,
 * small→medium, medium→large). `large` stays `large` (clamped).
 * Unknown values are treated as `medium`.
 *
 * @param {'tiny'|'small'|'medium'|'large'} size - The controls' size step
 * @returns {'small'|'medium'|'large'} The group gap / Panel padding step
 */
export function oneSizeUp(size) {
  const i = CONTROL_SIZES.indexOf(size)
  if (i === -1) return 'large'
  return CONTROL_SIZES[Math.min(CONTROL_SIZES.length - 1, i + 1)]
}

/**
 * Pill nesting rule: a pill embedded inside a field (ContentEditablePillInput,
 * TagInput) renders two size steps down, clamped at `tiny` — large→small,
 * medium→tiny, small→tiny, tiny→tiny. Distinct from `oneSizeDown` (the
 * embedded-button rule): a pill one step down would nearly fill its field.
 * A tiny field still cannot fit a tiny pill row and grows to fit it, the
 * documented known exception. Unknown values are treated as `tiny`.
 *
 * @param {'tiny'|'small'|'medium'|'large'} size - The field's size step
 * @returns {'tiny'|'small'} The embedded pill's size step
 */
export function pillSizeInField(size) {
  return size === 'large' ? 'small' : 'tiny'
}

/**
 * Returns one step of `theme.toggleControlSize` with `labelFontSize`
 * resolved from `theme.typography.fontSize[labelFontSizeKey]`.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {{ checkboxBox: string, checkGlyph: string, trackWidth: string, trackHeight: string, knob: string, labelFontSize: string }}
 */
export function getToggleControlSize(theme, size) {
  const step = theme.toggleControlSize[size] || theme.toggleControlSize.medium
  return {
    ...step,
    labelFontSize: theme.typography.fontSize[step.labelFontSizeKey],
  }
}

/**
 * Returns one step of `theme.sliderSize` with `textFontSize` resolved from
 * `theme.typography.fontSize[textFontSizeKey]`.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {{ trackRowHeight: string, thumb: string, trackThickness: string, textFontSize: string, numberRadius: string }}
 */
export function getSliderSize(theme, size) {
  const step = theme.sliderSize[size] || theme.sliderSize.medium
  return {
    ...step,
    textFontSize: theme.typography.fontSize[step.textFontSizeKey],
  }
}

/**
 * Returns one step of `theme.pillSize` with `fontSize` resolved from
 * `theme.typography.fontSize[fontSizeKey]`. Unknown steps fall back to
 * `tiny`, Pill's default.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {{ height: string, fontSize: string, iconSize: string, paddingX: string, slotPadding: string }}
 */
export function getPillSize(theme, size) {
  const step = theme.pillSize[size] || theme.pillSize.tiny
  return { ...step, fontSize: theme.typography.fontSize[step.fontSizeKey] }
}

/**
 * Returns the `theme.popoverMaxHeight` step for a size — the height past
 * which a dropdown popover (Select, PillSelectPanel) scrolls. Unknown steps
 * fall back to `medium`.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {string} A CSS pixel length, e.g. `'280px'`
 */
export function getPopoverMaxHeight(theme, size) {
  return theme.popoverMaxHeight[size] || theme.popoverMaxHeight.medium
}

/**
 * Returns RowTitle geometry for a size step: `height` and `textFontSize`
 * come from `getControlSize` (the control's `height` and `fontSize`), and
 * `titleFontSize` from `theme.rowTitleSize`. Unknown steps fall back to
 * `medium`.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - Size step
 * @returns {{ height: string, titleFontSize: string, textFontSize: string }}
 */
export function getRowTitleSize(theme, size) {
  const step = theme.rowTitleSize[size] ? size : 'medium'
  const { height, fontSize } = getControlSize(theme, step)
  return {
    height,
    titleFontSize: theme.rowTitleSize[step].titleFontSize,
    textFontSize: fontSize,
  }
}

/**
 * Geometry for embedded buttons inside a field of the given size, in px
 * numbers. The button renders at `oneSizeDown(size)` and is inset by
 * `offset = (fieldHeight − buttonHeight) / 2` from the field's top and right
 * outer edges, so it sits vertically centred in a one-row field. For fields
 * taller than one row (Textarea, multi-line ContentEditablePillInput) the
 * step height is still the reference box, so the button stays in the top row.
 *
 * `paddingRight` is the right padding the field needs so its text does not
 * run under `count` buttons laid out in a horizontal row:
 * `count × buttonHeight + (count − 1) × gap + 2 × offset`.
 *
 * @param {Object} theme - A theme object (e.g. `currentTheme.value`)
 * @param {'tiny'|'small'|'medium'|'large'} size - The field's size step
 * @param {number} [count=1] - Number of buttons in a horizontal row
 * @returns {{ buttonSize: string, fieldHeight: number, buttonHeight: number, offset: number, gap: number, paddingRight: number }}
 */
export function getEmbeddedButtonLayout(theme, size, count = 1) {
  const buttonSize = oneSizeDown(size)
  const fieldHeight = parseFloat(getControlSize(theme, size).height)
  const buttonHeight = parseFloat(getControlSize(theme, buttonSize).height)
  const gap = parseFloat(getControlSize(theme, size).gap)
  const offset = Math.max(0, (fieldHeight - buttonHeight) / 2)
  const n = Math.max(1, count)
  return {
    buttonSize,
    fieldHeight,
    buttonHeight,
    offset,
    gap,
    paddingRight: n * buttonHeight + (n - 1) * gap + 2 * offset,
  }
}

// ============================================================================
// Typography Sub-Themes
// ============================================================================

const arialTypographySubTheme = {
  typography: {
    fontFamily: 'Arial, sans-serif',
    fontSize: {
      small: '12px',
      medium: '14px',
      large: '16px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      bold: '600',
    },
  },
}

const typographySubTheme = {
  typography: {
    fontFamily: '"Figtree", sans-serif',
    fontSize: {
      small: '12px',
      medium: '14px',
      large: '16px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      bold: '600',
    },
  },
}

// ============================================================================
// Monotype Sub-Theme
// ============================================================================

const monotypeSubTheme = {
  monotype: {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: {
      small: '11px',
      medium: '13px',
    },
  },
}

// ============================================================================
// Shadow Sub-Theme
// ============================================================================

const shadowSubTheme = {
  light: {
    shadow: {
      color: 'rgba(0, 0, 0, 0.15)',
      colorStrong: 'rgba(0, 0, 0, 0.25)',
      elevated: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15)',
    },
  },
  dark: {
    shadow: {
      color: 'rgba(0, 0, 0, 0.3)',
      colorStrong: 'rgba(0, 0, 0, 0.3)',
      elevated: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.3)',
    },
  },
}

// ============================================================================
// Glass Sub-Theme (AnyTale Play's glass kit, `app-ui/glass/`)
// ============================================================================

// Sizes are in `cqw` — percent of the Play frame's width (the frame is a size
// container) — so the layout scales with the frame alone: a viewport taller
// than the frame, or mobile browser chrome, never shifts it. Only the blur
// radius is in px. (Outside a container, `cqw` falls
// back to the small viewport width.)
const glassSize = {
  fontSize: '3.1cqw',
  fontSizeSmall: '2.3cqw',
  // Captions under icon buttons (bottom panels, the options panel).
  fontSizeCaption: '1.7cqw',
  // A caption's widest line; longer captions wrap to a second line.
  captionWidth: '10cqw',
  // Multiplies every icon button's size (button, icon, caption). The Play
  // frame sets the variable: 1, or `glassFrame.mobileIconScale` below the
  // mobile breakpoint. Outside the frame it falls back to 1.
  iconScale: 'var(--glass-icon-scale, 1)',
  // Multiplies a text-only button's font size and side padding (so its
  // width). The Play frame sets the variable: 1, or
  // `glassFrame.mobileTextScale` below the mobile breakpoint.
  textScale: 'var(--glass-text-scale, 1)',
  // Multiplies a text-only button's height. The Play frame sets the
  // variable: 1, or `glassFrame.mobileTextHeightScale` below the breakpoint.
  textHeightScale: 'var(--glass-text-height-scale, 1)',
  // Multiplies the visual-novel dialog's name and text font sizes. The Play
  // frame sets the variable: 1, or `glassFrame.mobileDialogTextScale` below
  // the breakpoint.
  dialogTextScale: 'var(--glass-dialog-text-scale, 1)',
  // Multiplies the spinner's centre text (the percentage and "Ready"). The
  // Play frame sets the variable: 1, or `glassFrame.mobileSpinnerTextScale`
  // below the breakpoint.
  spinnerTextScale: 'var(--glass-spinner-text-scale, 1)',
  icon: '4.4cqw',
  button: '8.4cqw',
  // `SwipeVerdict`'s icon and caption: the reject/match graphic over the
  // stage.
  verdictIcon: '18cqw',
  verdictCaption: '4.4cqw',
  // The freeze badge (`GlassButton`'s `frozen`): a small snowflake in the
  // bottom-right corner of a toggle whose media is unavailable here. Its
  // size, and its inset from the button's corner; both scale with
  // `iconScale` alongside the button.
  frozenBadge: '2.4cqw',
  frozenBadgeInset: '0.6cqw',
  gap: '1.9cqw',
  radius: '2.6cqw',
  // Fully rounded ends (a pill), e.g. the play screen's page indicator.
  radiusPill: '999px',
  inset: '3.2cqw',
  // A speech bubble's width (`SpeechBubbleButton`): about two thirds of the
  // frame, right-aligned as the player's lines.
  bubbleWidth: '66cqw',
  // A word balloon's rounded corners, shared by `VnDialog` and
  // `SpeechBubbleButton`; the balloon's one square corner is its tail.
  balloonRadius: '5.2cqw',
  // A word balloon's padding (vertical, then horizontal), shared by
  // `VnDialog` and `SpeechBubbleButton`.
  balloonPadding: '2.6cqw 5.2cqw',
  // A Flirt photo's chat frame (a CSS `aspect-ratio`): the portrait shape of
  // the generated selfie, so the frame has its final size before the image
  // arrives.
  photoAspectRatio: '2 / 3',
  // A Flirt photo's width inside its chat balloon: a small preview (tapping it
  // opens the full-frame viewer), a third of a speech bubble's inner width.
  photoWidth: '18.5cqw',
  // The loading screen's reading panel (`ReadingPanel`) scrolls past this
  // height: about a third of the portrait Play frame's height.
  readingPanelMaxHeight: '55cqw',
  // The reading panel's text size, relative to the dialog text (`dialogTextScale`).
  readingTextScale: 0.8,
  // Flirt's profile viewer panel (`FlirtProfileViewer`): about two thirds of
  // the frame, leaving plenty of backdrop around it to tap.
  profilePanelWidth: '64.5cqw',
  // The glass scrollbar (`CategoryList`, `ReadingPanel`): its thickness, and
  // the gap kept on each side of it, to the content and to the glass edge.
  scrollbarWidth: '1cqw',
  scrollbarGap: '1cqw',
}

const glassMotion = {
  duration: '0.4s',
  durationMs: 400,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  // Flirt's chat balloons growing into place (`growBalloon`): half the speed
  // of `durationMs`, so the dots-to-text change reads as one shape growing.
  balloonGrowMs: 800,
  // How far beyond its edge a sliding element starts or ends.
  travel: '15.4cqw',
  // How far below centre `SwipeVerdict` starts; it rises to centre as its
  // progress reaches 1.
  verdictRise: '15.4cqw',
  // Match's pause between a reject's `SwipeVerdict` finishing its fade and
  // the loading spinner fading in, so the two never overlap.
  rejectLoadingDelayMs: 1000,
  // The page swipe: `ImageStage`'s directional exit, the old image sliding
  // out (left going forward, right going back) over the new one. `travel` is
  // the full frame width, so it leaves the frame entirely; it fades only to
  // `finalOpacity`, so it is still partly visible as it slides out.
  swipe: {
    duration: '0.8s',
    durationMs: 800,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    travel: '100cqw',
    finalOpacity: 0.5,
  },
  // VnDialog's character reveal: one character every `charIntervalMs`, each
  // fading in over `charFade` (`charFadeMs` is the same duration for timers).
  // Raise `charIntervalMs` to slow the reveal, lower it to speed it up.
  charIntervalMs: 30,
  charFade: '0.1s',
  charFadeMs: 100,
  // The loading screen's reading panel leaves once this many seconds or fewer
  // remain to ready, so it is out of view before the spinner's Ready beat. It
  // comes back only `LOADING_HYSTERESIS_SECONDS` (play-navigation.mjs) above
  // this, so a jittering estimate cannot flick it in and out.
  readingLeadSeconds: 3,
  // The glass spinner's ring: one full turn.
  spin: '1.1s',
  // The spinner's "Ready" beat: its ring grows to `readyScale` times its size
  // over `readyGrow` (`readyGrowMs` is the same duration for timers), and only
  // then does the loading UI fade out. The centre "Ready" grows to
  // `readyTextScale` over the same `readyGrow`, and starts fading at `readyTextFadeDelay` into the beat and, because its fade
  // (`readyTextFade`) runs past the end of the beat, is only partly faded when
  // the ring vanishes, leaving the loading UI's own fade-out to finish it.
  readyGrow: '3s',
  readyGrowMs: 3000,
  readyScale: 3,
  readyTextScale: 1.5,
  readyTextFadeDelay: '1.5s',
  readyTextFade: '3s',
  // How long a glass toast stays shown once it has slid in.
  toastHoldMs: 4000,
}

// Play's portrait frame: the whole Play UI lives inside it, at v1's aspect
// ratio (the Play image size, 896 × 1152), with a margin to the viewport on
// desktop and the full screen below the mobile breakpoint.
const glassFrame = {
  ratioWidth: 896,
  ratioHeight: 1152,
  margin: '40px',
  mobileBreakpoint: '768px',
  // Icon buttons (button, icon, caption) grow by this much on mobile.
  mobileIconScale: 1.5,
  // Text-only buttons (Start, Match, Flirt, Date) double their font size and
  // width on mobile.
  mobileTextScale: 2,
  // ...and their height by this much.
  mobileTextHeightScale: 1.5,
  // The dialog's character name and text grow by this much on mobile.
  mobileDialogTextScale: 1.5,
  // The spinner's percentage and "Ready" text grow by this much on mobile.
  mobileSpinnerTextScale: 1.5,
  // A choice-list row's name and description grow by this much on mobile.
  mobileOptionTextScale: 1.5,
  // Flirt's conversation notices (errors, "Sent from", logged off, went
  // idle) grow by this much on mobile: text, padding, and all.
  mobileNoticeScale: 1.5,
}

// The play screen's page dots (`PageDots`): their geometry and window. The
// colours are per theme, in `glass.dots` below.
const glassDotGeometry = {
  size: '1.9cqw',
  gap: '1.1cqw',
  // At most this many dots show at once: every dot is rendered in a track
  // that slides inside a clipped viewport this many dots wide, keeping the
  // current page centred. The number must be odd - it is currently set to 9.
  maxVisible: 9,
  // Edge dots hint at pages cropped out of sight. With one page hidden past
  // an edge, the edge dot is at `edgeScaleNear`; with two or more, the edge
  // dot is at `edgeScaleFar` and the one inside it at `edgeScaleNear`.
  edgeScaleNear: 0.75,
  edgeScaleFar: 0.5,
  // Vertical room inside the clipped viewport (offset by a matching negative
  // margin) so `overflow: hidden` doesn't crop the dots' `glass.shadow`.
  shadowRoom: '4cqw',
  // One pulse of a loading dot (hollow → solid and back), as v1's loading
  // pulse.
  pulseDuration: '1.5s',
}

// Stage gestures (`useStageGestures`): a tap in the outer `edgeZone` of the
// frame's width on either side turns a page. `swipeDistance` (a fraction of
// the stage width) decides both whether a release-only move is a swipe and
// whether a drag-follow release commits the page turn rather than snapping
// back: it is *the* knob for tuning how eager page turns are.
// `rubberBandCap` is the furthest (as a fraction of the stage width) a drag
// toward a blocked move can pull the image. `intentWindowMs` is the rolling
// window over which a stroke's recent travel of `swipeDistance` counts as the
// reader's intent at release: still pushing the page on commits, pulling it
// back snaps back, and a pause past the window leaves distance to decide.
const glassGesture = {
  edgeZone: 0.25,
  swipeDistance: 0.16,
  rubberBandCap: 0.16,
  intentWindowMs: 200,
}

// Stacking order of the Play overlays: the options panel over its backdrop,
// and a glass prompt (with its own backdrop) over both.
const glassLayer = {
  backdrop: 100,
  panel: 101,
  // The glass toast floats over the screens and the options panel, under a
  // prompt.
  toast: 150,
  prompt: 200,
}

const glassSubTheme = {
  light: {
    glass: {
      // The Play frame's themed media: the day logo video, placeholder, and
      // Match background.
      media: {
        logoVideo: '/media/anytale-logo-day.webm',
        placeholder: '/media/anytale-placeholder-day.png',
        // Match's static background, supplied by hand.
        matchBackground: '/media/anytale-match-background-day.png',
        // The frame's fill until the logo video or a page image has drawn: a
        // very light gray, so the light media fades in without a dark flash.
        backdrop: '#eeeeee',
      },
      size: glassSize,
      motion: glassMotion,
      layer: glassLayer,
      frame: glassFrame,
      gesture: glassGesture,
      blur: '14px',
      // The visual-novel dialog's text (VnDialog), loaded in public/css/fonts.css.
      dialogFontFamily: '"Comic Neue", "Figtree", sans-serif',
      // Panels (GlassPanel).
      surface: 'rgba(255, 255, 255, 0.35)',
      // Buttons: a near-neutral gray, opaque enough to stand off a completely
      // black background (less so than off a light one); a toggle's on state
      // is markedly lighter.
      buttonSurface: 'rgba(200, 200, 200, 0.6)',
      buttonSurfaceHover: 'rgba(215, 215, 215, 0.7)',
      buttonSurfaceActive: 'rgba(250, 250, 250, 0.88)',
      // The mobile press flash: an intense version of the contrast colour
      // (near-black here; an intense white in dark mode).
      buttonSurfacePressed: 'rgba(20, 20, 30, 0.85)',
      // Panel-backed text: everything with a glass surface behind it —
      // button labels, icons, and captions, panel bodies, and the titles of
      // lists, prompts, and toasts. Dark here; white in dark mode.
      text: 'rgba(20, 20, 30, 0.92)',
      // The glass scrollbar's thumb (`CategoryList`, `ReadingPanel`); its
      // track is transparent.
      scrollbarThumb: 'rgba(20, 20, 30, 0.35)',
      // Text drawn straight over the tale's imagery, with no panel behind it
      // (dialog speaker names, the reading panel's heading, the decision and
      // end screens' title and closing line, the spinner's percentage and
      // label, the autoplay indicator): white in both themes, over the strong `overImageShadow` halo.
      overImageText: 'rgba(255, 255, 255, 0.98)',
      overImageShadow: '0 0.8cqw 1.6cqw rgba(0, 0, 0, 0.8)',
      // The glass kit's soft diffused drop: boxes take it as box-shadow and
      // panel-backed text as text-shadow. The only other shadow is
      // `overImageShadow`, for text over imagery; no text stroke is used
      // anywhere in the glass kit.
      shadow: '0 0.8cqw 3.1cqw rgba(0, 0, 0, 0.18)',
      // The overlay behind the options panel and prompts.
      backdrop: 'rgba(255, 255, 255, 0.15)',
      offOpacity: 0.33,
      // Page dots: a page with nothing started is a hollow `ring`; a loading
      // one pulses between that ring and solid `secondary`; a ready one is
      // solid `secondary`; one whose image or dialog failed is solid `error`.
      // The current page is `primary`: solid when ready, else pulsing.
      dots: {
        ...glassDotGeometry,
        ring: 'rgba(160, 160, 160, 1)',
        secondary: 'rgba(160, 160, 160, 1)',
        primary: '#2f80ed',
        error: 'rgba(220, 53, 69, 1)',
      },
      // A static label pill (`ReadingPanel`'s archetype pills): the primary
      // colour with light text.
      pill: { background: '#2f80ed' },
    },
  },
  dark: {
    glass: {
      // The Play frame's themed media: the night logo video, placeholder, and
      // Match background.
      media: {
        logoVideo: '/media/anytale-logo-night.webm',
        placeholder: '/media/anytale-placeholder-night.png',
        // Match's static background, supplied by hand.
        matchBackground: '/media/anytale-match-background-night.png',
        // The frame's fill until the logo video or a page image has drawn.
        backdrop: '#000',
      },
      size: glassSize,
      motion: glassMotion,
      layer: glassLayer,
      frame: glassFrame,
      gesture: glassGesture,
      blur: '14px',
      // The visual-novel dialog's text (VnDialog), loaded in public/css/fonts.css.
      dialogFontFamily: '"Comic Neue", "Figtree", sans-serif',
      // Panels (GlassPanel).
      surface: 'rgba(20, 20, 30, 0.35)',
      // Buttons: a near-neutral mid gray, opaque enough to stand off a
      // completely black background (less so than off a light one); a
      // toggle's on state is markedly lighter.
      buttonSurface: 'rgba(128, 128, 128, 0.45)',
      buttonSurfaceHover: 'rgba(145, 145, 145, 0.55)',
      buttonSurfaceActive: 'rgba(205, 205, 205, 0.6)',
      // The mobile press flash: an intense white.
      buttonSurfacePressed: 'rgba(255, 255, 255, 0.95)',
      text: 'rgba(255, 255, 255, 0.95)',
      // The glass scrollbar's thumb, as in the light theme.
      scrollbarThumb: 'rgba(255, 255, 255, 0.4)',
      // Text over imagery, as in the light theme.
      overImageText: 'rgba(255, 255, 255, 0.98)',
      overImageShadow: '0 0.8cqw 1.6cqw rgba(0, 0, 0, 0.8)',
      shadow: '0 0.8cqw 3.1cqw rgba(0, 0, 0, 0.4)',
      // Darkens the screen behind the options panel and prompts.
      backdrop: 'rgba(0, 0, 0, 0.45)',
      offOpacity: 0.33,
      // Page dots, as in the light theme.
      dots: {
        ...glassDotGeometry,
        ring: 'rgba(190, 190, 190, 1)',
        secondary: 'rgba(190, 190, 190, 1)',
        primary: '#4c9aff',
        error: 'rgba(255, 90, 100, 1)',
      },
      // A static label pill, as in the light theme.
      pill: { background: '#4c9aff' },
    },
  },
}

// ============================================================================
// Color Themes
// ============================================================================

const lightColors = {
  // Primary Color Theme
  primary: {
    background: '#007bff',
    hover: '#0056b3',
    active: '#004085',
    focus: 'rgba(0, 123, 255, 0.5)',
    highlight: '#007acc',
    backgroundLight: '#e7f3ff',
    border: '#99ccff',
    text: '#ffffff',
  },
  // Secondary Color Theme
  secondary: {
    background: '#888888',
    hover: '#666666',
    active: '#3d4449',
    focus: 'rgba(108, 117, 125, 0.5)',
    highlight: '#cccccc',
    backgroundLight: '#e9ecef',
    border: '#cccccc',
    text: '#ffffff',
  },
  // Success Color Theme
  success: {
    background: '#28a745',
    hover: '#218838',
    active: '#1e7e34',
    focus: 'rgba(40, 167, 69, 0.5)',
    backgroundLight: '#d4edda',
    border: '#9fdfb0',
    text: '#ffffff',
  },
  // Warning Color Theme
  warning: {
    background: '#ffc107',
    hover: '#e0a800',
    active: '#c69500',
    focus: 'rgba(255, 193, 7, 0.5)',
    backgroundLight: '#fff3cd',
    border: '#ffeeba',
    text: '#212529',
  },
  // Danger Color Theme
  danger: {
    background: '#dc3545',
    hover: '#c82333',
    active: '#bd2130',
    border: '#dc3545',
    borderHover: '#c82333',
    backgroundLight: '#f8d7da',
    focus: 'rgba(220, 53, 69, 0.5)',
    text: '#ffffff',
  },
  // Background Colors
  background: {
    page: '#eeeeee',
    primary: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#e9ecef',
    elevated: '#b0b8c0',
    card: '#f8f9fa',
    hover: '#f1f1f1',
    disabled: '#e9ecef',
  },
  // Border Colors
  border: {
    primary: '#cccccc',
    secondary: '#cccccc',
    focus: '#80bdff',
    highlight: '#007bff',
  },
  // Text Colors
  text: {
    primary: 'black',
    secondary: '#495057',
    muted: '#888888',
    placeholder: '#adb5bd',
    disabled: '#868e96',
    inverse: '#ffffff',
  },
  tagOrigin: {
    page: { text: '#007bff', background: '#007bff', border: '#99ccff' },
    expression: { text: '#1a7f37', background: '#1a7f37', border: '#9fdfb0' },
    expanded: { text: '#8250df', background: '#8250df', border: '#c9b3f5' },
    rule: { text: '#d1242f', background: '#d1242f', border: '#f5b3b8' },
  },
  // StackedMeter track (unfilled bar) and peak tick.
  meter: { track: '#e9ecef', tick: '#212529' },
  // Memory readout segments, one per app process group.
  memoryGroup: { anytale: '#6f42c1', comfyui: '#007bff', llamacpp: '#17a2b8' },
  // UI Component Colors
  overlay: {
    background: 'rgba(0, 0, 0, 0.5)',
    backgroundStrong: 'rgba(0, 0, 0, 0.8)',
    glass: 'rgba(255, 255, 255, 0.6)',
  },
  focus: {
    shadowPrimary: 'rgba(0, 123, 255, 0.25)',
    shadowWhite: 'rgba(255, 255, 255, 0.3)',
  },
  scrollbar: {
    track: '#f1f1f1',
    thumb: '#c1c1c1',
    thumbHover: '#a1a1a1',
  },
  // Loading spinner color (darker for light backgrounds)
  spinner: {
    color: '#666666',
  },
}

const darkColors = {
  // Primary Color Theme
  primary: {
    background: '#007bff',
    hover: '#0056b3',
    active: '#004085',
    focus: 'rgba(0, 123, 255, 0.5)',
    highlight: '#007acc',
    backgroundLight: '#1a3a52',
    border: '#2d5a8c',
    text: '#ffffff',
  },
  // Secondary Color Theme
  secondary: {
    background: '#888888',
    hover: '#666666',
    active: '#3d4449',
    focus: 'rgba(108, 117, 125, 0.5)',
    highlight: '#5a6268',
    backgroundLight: '#3a3f44',
    border: '#5a6268',
    text: '#ffffff',
  },
  // Success Color Theme
  success: {
    background: '#28a745',
    hover: '#218838',
    active: '#1e7e34',
    focus: 'rgba(40, 167, 69, 0.5)',
    backgroundLight: '#1e4d2b',
    border: '#2d7a3f',
    text: '#ffffff',
  },
  // Warning Color Theme
  warning: {
    background: '#e0a800',
    hover: '#c69500',
    active: '#a07800',
    focus: 'rgba(255, 193, 7, 0.5)',
    backgroundLight: '#4a3800',
    border: '#7a5f00',
    text: '#ffffff',
  },
  // Danger Color Theme
  danger: {
    background: '#dc3545',
    hover: '#c82333',
    active: '#bd2130',
    border: '#dc3545',
    borderHover: '#c82333',
    backgroundLight: '#4d1f23',
    focus: 'rgba(220, 53, 69, 0.5)',
    text: '#ffffff',
  },
  // Background Colors
  background: {
    primary: '#121212',
    page: '#121212',
    secondary: '#1e1e1e',
    tertiary: '#2a2a2a',
    elevated: '#5a5a5a',
    card: '#1e1e1e',
    hover: '#333333',
    disabled: '#2a2a2a',
  },
  // Border Colors
  border: {
    primary: '#666666',
    secondary: '#444444',
    focus: '#555555',
    highlight: '#ffffff',
  },
  // Text Colors
  text: {
    primary: '#ffffff',
    secondary: '#cccccc',
    muted: '#999999',
    placeholder: '#666666',
    disabled: '#888888',
    inverse: '#121212',
  },
  tagOrigin: {
    page: { text: '#4dabff', background: '#007bff', border: '#2d5a8c' },
    expression: { text: '#3fb950', background: '#1a7f37', border: '#2d7a3f' },
    expanded: { text: '#bc8cff', background: '#8250df', border: '#5a3d8c' },
    rule: { text: '#ff7b72', background: '#d1242f', border: '#8c2d33' },
  },
  meter: { track: '#2a2a2a', tick: '#f0f0f0' },
  memoryGroup: { anytale: '#a371f7', comfyui: '#4c9aff', llamacpp: '#3dc9dc' },
  // UI Component Colors
  overlay: {
    background: 'rgba(0, 0, 0, 0.5)',
    backgroundStrong: 'rgba(0, 0, 0, 0.8)',
    glass: 'rgba(40, 40, 40, 0.4)',
  },
  focus: {
    shadowPrimary: 'rgba(255, 255, 255, 0.6)',
    shadowWhite: 'rgba(255, 255, 255, 0.3)',
  },
  scrollbar: {
    track: '#1e1e1e',
    thumb: '#555555',
    thumbHover: '#666666',
  },
  // Loading spinner color (lighter for dark backgrounds)
  spinner: {
    color: '#ffffff',
  },
}

// ============================================================================
// Merged Themes
// ============================================================================

export const themes = {
  light: {
    ...spacingSubTheme,
    ...typographySubTheme,
    ...monotypeSubTheme,
    ...shadowSubTheme.light,
    ...glassSubTheme.light,
    colors: lightColors,
    name: 'light',
    iconSystem: 'material-symbols',
  },
  dark: {
    ...spacingSubTheme,
    ...typographySubTheme,
    ...monotypeSubTheme,
    ...shadowSubTheme.dark,
    ...glassSubTheme.dark,
    colors: darkColors,
    name: 'dark',
    iconSystem: 'material-symbols',
  },
}

// ============================================================================
// Reactive Theme Store
// ============================================================================

/**
 * Simple reactive store for current theme
 * Supports subscriptions for reactive updates
 */
function createThemeStore(initialTheme) {
  let value = initialTheme
  const subscribers = new Set()

  return {
    get value() {
      return value
    },
    set value(newValue) {
      value = newValue
      subscribers.forEach((fn) => fn(value))
    },
    subscribe(fn) {
      subscribers.add(fn)
      fn(value) // Call immediately with current value
      return () => subscribers.delete(fn)
    },
  }
}

/**
 * Current theme reactive store
 * Subscribe to get notified when the theme changes
 * Default theme is loaded from cookie, or detected from browser's preferred color scheme
 *
 * @type {{ value: typeof themes.dark, subscribe: (fn: (theme: typeof themes.dark) => void) => () => void }}
 */
const getDefaultTheme = () => {
  // Try to load theme from cookie first
  const savedTheme = getCookie('theme')
  if (savedTheme && themes[savedTheme]) {
    return themes[savedTheme]
  }

  // If no cookie, detect from browser preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
    const defaultTheme = prefersDark ? themes.dark : themes.light
    // Save the detected preference to cookie
    setCookie('theme', defaultTheme.name)
    return defaultTheme
  }

  // Fallback to dark if matchMedia not available
  setCookie('theme', 'dark')
  return themes.dark
}

export const currentTheme = createThemeStore(getDefaultTheme())

// ============================================================================
// Public API
// ============================================================================

/**
 * Set the current theme by name
 *
 * @param {'light'|'dark'} themeName - Name of the theme to activate
 * @throws {Error} If theme name is not found
 *
 * @example
 * setTheme('dark');
 * setTheme('light');
 */
export function setTheme(themeName) {
  if (!themes[themeName]) {
    throw new Error(
      `Theme "${themeName}" not found. Available themes: ${Object.keys(themes).join(', ')}`,
    )
  }
  currentTheme.value = themes[themeName]
  setCookie('theme', themeName)
}

/**
 * Toggle between light and dark themes
 * Automatically saves the new theme to cookie
 *
 * @returns {string} The name of the newly active theme
 *
 * @example
 * toggleTheme(); // Switches from dark to light or vice versa
 */
export function toggleTheme() {
  const newTheme = currentTheme.value.name === 'dark' ? 'light' : 'dark'
  setTheme(newTheme)
  return newTheme
}

/**
 * Get a specific value from the current theme using dot notation
 *
 * @param {string} path - Dot-notation path to the theme value (e.g., 'colors.primary.background')
 * @returns {*} The theme value at the specified path, or undefined if not found
 *
 * @example
 * getThemeValue('colors.primary.background'); // '#007bff'
 * getThemeValue('spacing.medium.padding'); // '8px'
 * getThemeValue('colors.text.primary'); // '#ffffff' (in dark theme)
 */
export function getThemeValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], currentTheme.value)
}

/**
 * Get all available theme names
 *
 * @returns {string[]} Array of available theme names
 *
 * @example
 * getAvailableThemes(); // ['light', 'dark']
 */
export function getAvailableThemes() {
  return Object.keys(themes)
}
