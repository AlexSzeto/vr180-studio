/**
 * content-editable-pill-input.mjs – Reusable contenteditable pill input base.
 *
 * Renders a `contenteditable` div where confirmed entries become dismissible
 * pill spans. A custom autocomplete dropdown appears while the user is typing.
 * The inner contenteditable DOM is managed imperatively (via a ref) so Preact
 * re-renders never clobber the cursor position.
 *
 * @module custom-ui/io/content-editable-pill-input
 */
import { html } from 'htm/preact'
import { useEffect, useRef, useState, useContext, useMemo } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import {
  currentTheme,
  CONTROL_SIZES,
  getControlSize,
  getEmbeddedButtonLayout,
  getPillSize,
  pillSizeInField,
} from '../theme.mjs'
import {
  getWidthScaleStyle,
  resolveFieldSize,
  resolveWidthScale,
} from '../util.mjs'
import { Button } from './button.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'
import { useAutocomplete } from './use-autocomplete.mjs'
import { AutocompleteDropdown } from './autocomplete-dropdown.mjs'
import {
  ValidationMessage,
  validationBorderColor,
} from './validation-message.mjs'

// ── Styled shell (Preact-managed) ─────────────────────────────────────────────

// Vertical margin around each pill (see createPillElement). One pill row is
// the pill's height (`theme.pillSize[pillSizeInField(size)].height`) plus
// this margin top and bottom; the editor's vertical padding is derived so
// one pill row fits the size step's height.
const PILL_MARGIN = 2
// Horizontal padding inside the editor shell (unchanged from the original).
const PAD_X = 8

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.width};
  flex: ${(props) => props.flex};
`
FormGroup.className = 'cepi-form-group'

const StyledLabel = styled('label')`
  margin-bottom: 4px;
  color: ${() => currentTheme.value.colors.text.secondary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
`
StyledLabel.className = 'cepi-label'

const EditorOuter = styled('div')`
  position: relative;
  width: 100%;
  min-height: ${(props) => props.minHeight};
  padding: ${(props) => props.padding};
  border-radius: ${(props) => props.borderRadius};
  border: ${() => currentTheme.value.border.width}
    ${() => currentTheme.value.border.style}
    ${() => currentTheme.value.colors.border.primary};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${(props) => props.fontSize};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  line-height: 1.6;
  word-break: break-word;
  cursor: text;
  box-sizing: border-box;
  transition: ${() => currentTheme.value.transitions.fast};
`
EditorOuter.className = 'cepi-editor-outer'

// ── Imperative DOM helpers (module-level, pure) ───────────────────────────────

/** Return the last child if it is a text node, else null. */
function getTrailingTextNode(container) {
  const last = container.lastChild
  return last && last.nodeType === Node.TEXT_NODE ? last : null
}

/** Ensure the container ends with a text node; return it. */
function ensureTrailingTextNode(container) {
  const last = container.lastChild
  if (last && last.nodeType === Node.TEXT_NODE) return last
  const tn = document.createTextNode('')
  container.appendChild(tn)
  return tn
}

/** Get the uncommitted trailing text (what the user is currently typing). */
function getTrailingText(container) {
  return getTrailingTextNode(container)?.textContent ?? ''
}

/** Set the trailing text node content. */
function setTrailingText(container, text) {
  ensureTrailingTextNode(container).textContent = text
}

/**
 * Extract the values array from the current DOM.
 * Pill values come from data-value; BR elements become '\n'.
 * Trailing text nodes (uncommitted input) are intentionally ignored.
 *
 * @param {HTMLElement} container
 * @returns {string[]}
 */
export function readValues(container) {
  const out = []
  for (const n of container.childNodes) {
    if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute('data-pill')) {
      out.push(n.getAttribute('data-value'))
    } else if (n.nodeName === 'BR') {
      out.push('\n')
    }
    // Text nodes = uncommitted input — excluded from the values array
  }
  return out
}

/**
 * Split pasted text into confirmable segments and decide whether every
 * segment (including the last) should be committed as a pill.
 *
 * @param {string} text
 * @returns {{ parts: string[], commitAll: boolean }}
 */
export function splitPastedText(text) {
  const parts = text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const commitAll = /[,\n]/.test(text)
  return { parts, commitAll }
}

/**
 * Normalise a pill value or suggestion for matching: trimmed, case-insensitive,
 * and with spaces and underscores treated as the same character (as `tagExists`
 * in `app-ui/tags/tags.mjs` does). Shared by the unknown-pill check and the
 * dropdown's hiding of values already present as pills.
 *
 * @param {string} s
 * @returns {string}
 * @example normalizeSuggestionKey('Long_Hair ') // 'long hair'
 */
export function normalizeSuggestionKey(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
}

// Tooltip line appended for a pill that is not in the suggestion list.
const UNKNOWN_TOOLTIP_LINE = 'not in suggestion list'

// Default for the `suggestions` prop: a stable empty array, so the known-key
// Set (memoised on `suggestions`) is not rebuilt on every render.
const NO_SUGGESTIONS = []

/**
 * Create an icon DOM element for use inside imperative pill buttons.
 * Uses Material Symbol (project default) or falls back to a plain text glyph.
 *
 * @param {string} iconName – maps through the project icon map (e.g. 'x' → 'close')
 * @param {string} size     – CSS font-size (e.g. '14px')
 * @param {string} color    – CSS color value
 * @returns {HTMLElement}
 */
export function createPillIconEl(iconName, size, color) {
  const t = currentTheme.value
  // Material Symbol names for the icons we use in pills (keys as in ICON_MAP,
  // custom-ui/layout/icon.mjs)
  const MATERIAL_MAP = { x: 'close', 'alert-triangle': 'warning' }
  if (
    (t.iconSystem || 'material-symbols') === 'material-symbols' &&
    MATERIAL_MAP[iconName]
  ) {
    const span = document.createElement('span')
    span.className = 'material-symbols-outlined'
    Object.assign(span.style, {
      fontSize: size,
      color,
      lineHeight: '1',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: '0',
      userSelect: 'none',
    })
    span.textContent = MATERIAL_MAP[iconName]
    return span
  }
  // Fallback: plain text glyph
  const FALLBACK_TEXT = { 'alert-triangle': '⚠' }
  const span = document.createElement('span')
  span.textContent = FALLBACK_TEXT[iconName] ?? '×'
  Object.assign(span.style, {
    fontSize: size,
    color,
    lineHeight: '1',
    flexShrink: '0',
  })
  return span
}

/**
 * Create the warning icon marking an unknown pill (one whose value is not in
 * the suggestion list). Plain pills get it from `createPillElement`; a custom
 * `renderPill` appends it itself when called with `{ unknown: true }`.
 *
 * @param {'tiny'|'small'|'medium'|'large'} pillStep – pill size step; sets the icon size
 * @param {string} color – CSS colour; pass the pill's own text colour
 * @returns {HTMLElement} a span carrying `data-pill-unknown-icon`
 */
export function createUnknownIconEl(pillStep, color) {
  const { iconSize } = getPillSize(currentTheme.value, pillStep)
  const icon = createPillIconEl('alert-triangle', iconSize, color)
  icon.setAttribute('data-pill-unknown-icon', '')
  Object.assign(icon.style, {
    userSelect: 'none',
    flexShrink: '0',
    lineHeight: '1',
  })
  return icon
}

/**
 * Create a pill DOM element matching the Preact `Pill` component's dismiss variant.
 * Event delegation on the container handles dismiss clicks; no per-element
 * listeners are attached here.
 *
 * @param {string}   value
 * @param {Function} [renderPill]  – (value: string, { pillSize, unknown }) => HTMLElement | null
 * @param {boolean}  [clickable]   – show pointer cursor + hover brightness when true
 * @param {boolean}  [disabled]    – use disabled colour scheme; suppress hover/pointer
 * @param {'tiny'|'small'|'medium'|'large'} [pillStep='tiny'] – pill size step
 *   (`pillSizeInField` of the editor's size); passed on to `renderPill`
 * @param {boolean}  [unknown=false] – value is not in the suggestion list; a plain pill
 *   draws the warning icon, a custom pill receives it as `renderPill`'s `unknown`
 */
function createPillElement(
  value,
  renderPill,
  clickable = false,
  disabled = false,
  pillStep = 'tiny',
  unknown = false,
) {
  // Allow the caller to supply a fully custom element (e.g. template pills)
  if (renderPill) {
    const el = renderPill(value, { pillSize: pillStep, unknown })
    if (el instanceof HTMLElement) {
      el.setAttribute('contenteditable', 'false')
      el.setAttribute('data-pill', '')
      if (unknown) el.setAttribute('data-pill-unknown', '')
      else el.removeAttribute('data-pill-unknown')
      // Respect data-value already set by renderPill (allows value transformation like {{}} expansion)
      if (!el.hasAttribute('data-value')) el.setAttribute('data-value', value)
      // handleClick delegates onPillClick to any [data-pill] body (outside
      // dismiss/slot-cycling zones), so custom-rendered pills need the same
      // pointer cursor + hover feedback plain pills get below.
      if (clickable && !disabled) {
        el.style.cursor = 'pointer'
        el.style.transition = el.style.transition
          ? `${el.style.transition}, filter ${currentTheme.value.transitions.fast}`
          : `filter ${currentTheme.value.transitions.fast}`
        el.addEventListener('mouseenter', () => {
          el.style.filter = 'brightness(1.2)'
        })
        el.addEventListener('mouseleave', () => {
          el.style.filter = ''
        })
      }
      return el
    }
  }

  const t = currentTheme.value
  const pillStepValues = getPillSize(t, pillStep)
  // Disabled pills use muted background/text/border; active pills use primary colours.
  const bg = disabled
    ? t.colors.background.disabled
    : t.colors.primary.background
  const text = disabled ? t.colors.text.disabled : t.colors.primary.text
  const border = disabled
    ? t.colors.border.secondary
    : t.colors.primary.border || t.colors.border.primary

  // Outer container — mirrors PillContainer
  const pill = document.createElement('span')
  pill.setAttribute('contenteditable', 'false')
  pill.setAttribute('data-pill', '')
  pill.setAttribute('data-value', value)
  if (unknown) pill.setAttribute('data-pill-unknown', '')
  Object.assign(pill.style, {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: pillStepValues.height,
    borderRadius: '9999px',
    overflow: 'hidden',
    border: `1px solid ${border}`,
    backgroundColor: bg,
    fontSize: pillStepValues.fontSize,
    fontFamily: t.typography.fontFamily,
    fontWeight: t.typography.fontWeight.medium,
    userSelect: 'none',
    verticalAlign: 'middle',
    margin: `${PILL_MARGIN}px ${PILL_MARGIN}px`,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    lineHeight: '1',
    flexShrink: '0',
  })

  // Dismiss button — mirrors PillIconBtn (transparent bg, rounded hover glow, × on the LEFT)
  const dismissBtn = document.createElement('button')
  dismissBtn.setAttribute('data-pill-dismiss', '')
  dismissBtn.setAttribute('type', 'button')
  dismissBtn.setAttribute('tabindex', '-1')
  dismissBtn.setAttribute('contenteditable', 'false')
  Object.assign(dismissBtn.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
    marginLeft: '4px',
    border: 'none',
    borderRadius: '9999px',
    backgroundColor: 'transparent',
    color: text,
    cursor: disabled ? 'default' : 'pointer',
    lineHeight: '1',
    transition: disabled ? undefined : `background-color ${t.transitions.fast}`,
    flexShrink: '0',
  })
  if (!disabled) {
    dismissBtn.addEventListener('mouseenter', () => {
      dismissBtn.style.backgroundColor = 'rgba(255,255,255,0.22)'
    })
    dismissBtn.addEventListener('mouseleave', () => {
      dismissBtn.style.backgroundColor = 'transparent'
    })
  }
  dismissBtn.appendChild(createPillIconEl('x', pillStepValues.iconSize, text))

  // Content area — mirrors PillContentArea (transparent bg, left pad reduced since dismiss is left)
  const contentArea = document.createElement('span')
  Object.assign(contentArea.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: `0 ${pillStepValues.paddingX} 0 4px`,
    backgroundColor: 'transparent',
    color: text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })
  contentArea.textContent = value
  // The warning icon sits after the text (spaced by the 3px gap), so a flagged
  // pill grows wider but keeps its height.
  if (unknown) contentArea.appendChild(createUnknownIconEl(pillStep, text))

  if (clickable && !disabled) {
    pill.style.cursor = 'pointer'
    pill.style.transition = `filter ${t.transitions.fast}`
    pill.addEventListener('mouseenter', () => {
      pill.style.filter = 'brightness(1.2)'
    })
    pill.addEventListener('mouseleave', () => {
      pill.style.filter = ''
    })
  }

  pill.appendChild(dismissBtn)
  pill.appendChild(contentArea)
  return pill
}

/**
 * Rebuild the contenteditable content entirely from a values array.
 * A text node is placed before every pill/BR and at the end so the caret
 * can be positioned anywhere between elements, not just at the tail.
 * `isUnknown(value)` decides whether each pill is flagged as unknown.
 */
function buildDOM(
  container,
  values,
  renderPill,
  clickable = false,
  disabled = false,
  pillStep = 'tiny',
  isUnknown = () => false,
) {
  container.innerHTML = ''
  container.appendChild(document.createTextNode(''))
  for (const v of values) {
    if (v === '\n') {
      container.appendChild(document.createElement('br'))
    } else {
      container.appendChild(
        createPillElement(
          v,
          renderPill,
          clickable,
          disabled,
          pillStep,
          isUnknown(v),
        ),
      )
    }
    container.appendChild(document.createTextNode(''))
  }
}

/** Move the caret to the end of the container. */
function moveCursorToEnd(container) {
  try {
    const range = document.createRange()
    range.selectNodeContents(container)
    range.collapse(false)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } catch {
    /* non-browser env (vitest/jsdom) */
  }
}

/** Get the bounding rect of the current caret (for dropdown positioning). */
function getCaretRect() {
  try {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    return sel.getRangeAt(0).getBoundingClientRect()
  } catch {
    return null
  }
}

/**
 * Return the text node the caret is in (or adjacent to), as long as it is a
 * direct child of container.
 *
 * Two representations of "cursor between pills" are normalised here:
 *   a) startContainer is the text node itself (startOffset is the char position)
 *   b) startContainer is `container` at some child-index (cursor between two
 *      contenteditable=false siblings) — we resolve to the nearest child text node
 */
function getCaretTextNode(container) {
  try {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const { startContainer, startOffset } = sel.getRangeAt(0)
    if (
      startContainer.nodeType === Node.TEXT_NODE &&
      startContainer.parentNode === container
    ) {
      return startContainer
    }
    if (startContainer === container) {
      // Cursor is between childNodes[startOffset-1] and childNodes[startOffset].
      // Prefer the text node immediately before the cursor; fall back to the one after.
      const before = container.childNodes[startOffset - 1]
      if (before?.nodeType === Node.TEXT_NODE) return before
      const after = container.childNodes[startOffset]
      if (after?.nodeType === Node.TEXT_NODE) return after
    }
    return null
  } catch {
    return null
  }
}

/**
 * Return the sibling node immediately after the caret — but only when the
 * caret is at the end of a text node (i.e. forward-delete would skip to the next node).
 * Returns null when the cursor is mid-text or state is unavailable.
 */
function getNodeAfterCaret(container) {
  try {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return null
    const { startContainer, startOffset } = range
    if (startContainer.nodeType === Node.TEXT_NODE) {
      return startOffset === startContainer.textContent.length
        ? startContainer.nextSibling || null
        : null
    }
    if (startContainer === container) {
      return container.childNodes[startOffset] || null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Return the sibling node immediately before the caret — but only when the
 * caret is at offset 0 of a text node (i.e. normal backspace would do nothing).
 * Returns null when the cursor is mid-text or state is unavailable.
 */
function getNodeBeforeCaret(container) {
  try {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return null
    const { startContainer, startOffset } = range
    if (startContainer.nodeType === Node.TEXT_NODE) {
      return startOffset === 0 ? startContainer.previousSibling || null : null
    }
    if (startContainer === container) {
      return startOffset > 0
        ? container.childNodes[startOffset - 1] || null
        : null
    }
    return null
  } catch {
    return null
  }
}

/** Place the caret at a specific offset within a node. */
function setCursorAt(node, offset) {
  try {
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  } catch {
    /* jsdom */
  }
}

/** Move the caret to the end of a text node. */
function moveCursorToEndOf(node) {
  try {
    setCursorAt(
      node,
      node.nodeType === Node.TEXT_NODE ? node.textContent.length : 0,
    )
  } catch {
    /* jsdom */
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ContentEditablePillInput – contenteditable pill editor with autocomplete.
 *
 * @param {Object}    props
 * @param {string[]}  props.values             – Controlled pill array; '\n' encodes a line break
 * @param {Function}  props.onValuesChange     – (values: string[]) => void
 * @param {string[]}  [props.suggestions=[]]   – Autocomplete candidates, and the known list for
 *   `flagUnknown`. Values already present as pills are never offered in the dropdown.
 * @param {boolean}   [props.flagUnknown=true] – Mark a pill whose value is not in `suggestions`
 *   (trimmed, case-insensitive, spaces ≡ underscores) with a warning icon and a
 *   `not in suggestion list` tooltip line — a nudge to double-check, not a rejection.
 *   Nothing is flagged while `suggestions` is empty.
 * @param {string}    [props.label]            – Label text above the editor
 * @param {Object}    [props.validation]       – Validation result `{ status, message }`; pair with
 *   `useInputValidation` from `./use-input-validation.mjs`, or pass a literal
 * @param {string}    [props.placeholder='']   – Hint when the editor is empty
 * @param {boolean}   [props.disabled=false]
 * @param {boolean}   [props.multiline=false]  – Enter inserts a '\n' line break
 * @param {number}    [props.fixedHeight]      – Fixed height in px; enables scroll overflow
 * @param {number}    [props.minHeight]        – Min-height in px for the outer shell; ignored when fixedHeight is set
 * @param {Function}  [props.renderPill]       – (value: string, { pillSize, unknown }) => HTMLElement | null;
 *   `pillSize` is the pill size step for this editor (`pillSizeInField(size)`), so a custom
 *   renderer can size its pill to match. `unknown` is true when the pill is flagged; the
 *   renderer draws the icon itself (`createUnknownIconEl`). Single-argument renderers keep working.
 * @param {Function}  [props.normalizeValue]   – (text: string) => string; applied to typed, pasted, and
 *   autocompleted text as it becomes a pill (e.g. TagInput turns tag underscores into spaces).
 *   Pills built from the `values` prop are not transformed — normalise those before passing them in.
 * @param {Function}  [props.onContainerReady] – (el: HTMLElement) => void  fired after mount
 * @param {Function}  [props.onPillClick]      – (value: string) => void; fires when pill body is clicked (not dismiss/slot)
 * @param {Function}  [props.getPillTooltip]   – (value: string) => string | null; returns tooltip text for a pill on hover
 *   (an unknown pill appends a `not in suggestion list` line)
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] – Control size step; sets the editor's
 *   min-height (24 | 34 | 44 | 54px), font size, and border radius from `theme.controlSize[size]`.
 *   The editor still grows past the step height as pills and lines wrap. The removed
 *   `heightScale` prop logs a warning and is ignored.
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='full'] – Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `full`; `auto` not accepted (warns and falls back to the default).
 * @param {Object}    [props.buttonProps]          – optional icon button rendered top-right inside the editor
 *   { icon: string, color?: string, disabled?: boolean, onClick: () => void, title?: string, tooltip?: string, loading?: boolean }
 *   Nesting rule: renders one size down from the editor (`oneSizeDown(size)`, `tiny` stays
 *   `tiny`), inset `(stepHeight − buttonHeight) / 2` from the top and right, so it sits
 *   centred in a single-row editor and stays in the first row of a taller one.
 * @param {Object}    [props.secondaryButtonProps] – optional second icon button (same shape as buttonProps),
 *   stacked one `buttonHeight + controlSize[size].gap` below the primary; the editor's
 *   min-height grows to fit both.
 *
 * @example
 * <${ContentEditablePillInput}
 *   label="Tags"
 *   values=${myTags}
 *   onValuesChange=${setMyTags}
 *   suggestions=${allTags}
 *   placeholder="Type to add tags..."
 *   multiline
 * />
 */
export function ContentEditablePillInput({
  values = [],
  onValuesChange,
  suggestions = NO_SUGGESTIONS,
  flagUnknown = true,
  label,
  placeholder = '',
  disabled = false,
  multiline = false,
  fixedHeight,
  minHeight,
  renderPill,
  normalizeValue,
  onContainerReady,
  onPillClick,
  getPillTooltip,
  buttonProps,
  secondaryButtonProps,
  validation,
  size: sizeProp,
  heightScale,
  widthScale,
  ...rest
}) {
  const containerRef = useRef(null)
  const isFocusedRef = useRef(false)

  // Always-current refs — safe to read from inside the `useEffect([])` closure
  const onValuesChangeRef = useRef(onValuesChange)
  const suggestionsRef = useRef(suggestions)
  const renderPillRef = useRef(renderPill)
  const disabledRef = useRef(disabled)
  const multilineRef = useRef(multiline)
  const onPillClickRef = useRef(onPillClick)
  const normalizeValueRef = useRef(normalizeValue)
  normalizeValueRef.current = normalizeValue
  onValuesChangeRef.current = onValuesChange
  suggestionsRef.current = suggestions
  renderPillRef.current = renderPill
  // Pill size step for the imperative DOM builders; assigned during render
  // (below, once `size` is resolved), read by the effects after it.
  const pillStepRef = useRef('tiny')
  disabledRef.current = disabled
  multilineRef.current = multiline
  onPillClickRef.current = onPillClick

  const tooltipCtx = useContext(TooltipContext)
  const tooltipCtxRef = useRef(null)
  const getPillTooltipRef = useRef(getPillTooltip)
  tooltipCtxRef.current = tooltipCtx
  getPillTooltipRef.current = getPillTooltip

  // Unknown-pill check. The known set is built once per suggestion list, never
  // per pill; the ref lets pills created inside the mount-time closure use the
  // latest list.
  const knownKeys = useMemo(
    () => new Set(suggestions.map(normalizeSuggestionKey)),
    [suggestions],
  )
  const isUnknownRef = useRef(() => false)
  isUnknownRef.current = (value) =>
    flagUnknown &&
    knownKeys.size > 0 &&
    value !== '\n' &&
    !knownKeys.has(normalizeSuggestionKey(value))

  // Dropdown candidates: the full list minus values already present as pills,
  // read from the editor DOM at show time rather than from `values`, which
  // lags while the field is focused. The known check above still uses the
  // full list.
  const getAvailableSuggestions = () => {
    const container = containerRef.current
    const list = suggestionsRef.current
    if (!container) return list
    const present = new Set(readValues(container).map(normalizeSuggestionKey))
    if (present.size === 0) return list
    return list.filter((s) => !present.has(normalizeSuggestionKey(s)))
  }

  // Placeholder visibility
  const [showPlaceholder, setShowPlaceholder] = useState(values.length === 0)
  const setShowPlaceholderRef = useRef(setShowPlaceholder)
  setShowPlaceholderRef.current = setShowPlaceholder

  // Bridge: set inside useEffect([]) so the hook's onConfirm callback can call
  // the imperative confirmText + caret repositioning logic.
  const onConfirmRef = useRef(null)

  const {
    dropdownState,
    showDropdownRef,
    closeDropdownRef,
    handleDropdownKeyDownRef,
    handleDropdownClick,
  } = useAutocomplete({
    suggestions: getAvailableSuggestions,
    getAnchorRect: getCaretRect,
    onConfirm: (item) => onConfirmRef.current?.(item),
    maxResults: 20,
    showEmptyOnNoResults: true,
  })

  // ── Mount: build initial DOM + wire all imperative event listeners ──────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    buildDOM(
      container,
      values,
      renderPillRef.current,
      !!onPillClickRef.current,
      disabledRef.current,
      pillStepRef.current,
      isUnknownRef.current,
    )
    setShowPlaceholderRef.current(values.length === 0)
    if (onContainerReady) onContainerReady(container)

    // ── Internal scoped helpers ──

    function updatePlaceholder() {
      const hasPills = [...container.childNodes].some(
        (n) => n.nodeType === Node.ELEMENT_NODE && n.hasAttribute('data-pill'),
      )
      const hasText = [...container.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0,
      )
      setShowPlaceholderRef.current(!hasPills && !hasText)
    }

    function confirmText(text, textNode) {
      const raw = text.trim()
      const trimmed = normalizeValueRef.current
        ? normalizeValueRef.current(raw).trim()
        : raw
      if (!trimmed) return false
      const activeNode = textNode || getTrailingTextNode(container)
      if (!activeNode || activeNode.parentNode !== container) return false
      const pill = createPillElement(
        trimmed,
        renderPillRef.current,
        !!onPillClickRef.current,
        disabledRef.current,
        pillStepRef.current,
        isUnknownRef.current(trimmed),
      )
      // Ensure a text node exists before the new pill for cursor positioning
      if (
        !activeNode.previousSibling ||
        activeNode.previousSibling.nodeType !== Node.TEXT_NODE
      ) {
        container.insertBefore(document.createTextNode(''), activeNode)
      }
      container.insertBefore(pill, activeNode)
      activeNode.textContent = ''
      closeDropdownRef.current()
      onValuesChangeRef.current?.(readValues(container))
      updatePlaceholder()
      return true
    }

    // Wire the hook's onConfirm callback to the imperative confirm + caret logic
    onConfirmRef.current = (item) => {
      const caretNode = getCaretTextNode(container)
      confirmText(item, caretNode || undefined)
      const curr = caretNode || getTrailingTextNode(container)
      if (curr) moveCursorToEndOf(curr)
      container.focus()
    }

    // ── DOM event handlers ──

    function handleInput() {
      if (disabledRef.current) return
      const caretNode = getCaretTextNode(container)
      const text = caretNode
        ? caretNode.textContent
        : getTrailingText(container)

      // Auto-confirm when the user types a comma
      const commaIdx = text.indexOf(',')
      if (commaIdx !== -1) {
        const before = text.slice(0, commaIdx)
        const after = text.slice(commaIdx + 1).replace(/^\s+/, '')
        const activeNode = caretNode || getTrailingTextNode(container)
        if (before.trim()) confirmText(before, activeNode)
        // confirmText cleared activeNode; put the post-comma text back in it
        if (activeNode) activeNode.textContent = after
        if (activeNode) {
          if (after) moveCursorToEndOf(activeNode)
          else setCursorAt(activeNode, 0)
        }
        showDropdownRef.current(after)
        return
      }

      showDropdownRef.current(text)
      updatePlaceholder()
    }

    function handleKeyDown(e) {
      if (disabledRef.current) return
      // Delegate to the autocomplete hook first; if it handles the key, stop here.
      if (handleDropdownKeyDownRef.current(e)) return

      const ds = dropdownState

      switch (e.key) {
        case 'Tab': {
          e.preventDefault()
          const caretNode = getCaretTextNode(container)
          const text = caretNode
            ? caretNode.textContent
            : getTrailingText(container)
          // Tab: prefer highlighted dropdown item → first dropdown item → verbatim text
          const target =
            ds.visible && ds.items.length > 0 && ds.index >= 0
              ? ds.items[ds.index]
              : ds.visible && ds.items.length > 0
                ? ds.items[0]
                : text
          if (target.trim()) {
            confirmText(target, caretNode || undefined)
            const curr = caretNode || getTrailingTextNode(container)
            if (curr) moveCursorToEndOf(curr)
          }
          break
        }

        case 'Enter': {
          e.preventDefault()
          if (multilineRef.current) {
            const caretNode = getCaretTextNode(container)
            if (caretNode) {
              // Split the text node at the cursor and insert a BR between the two halves.
              // When the browser represents the position as container-level offset (common
              // between contenteditable=false pills), the cursor is logically at the end of
              // the resolved text node, so fall back to its full length.
              const offset = (() => {
                try {
                  const range = window.getSelection().getRangeAt(0)
                  return range.startContainer === caretNode
                    ? range.startOffset
                    : caretNode.textContent.length
                } catch {
                  return 0
                }
              })()
              const afterText = caretNode.textContent.slice(offset)
              caretNode.textContent = caretNode.textContent.slice(0, offset)
              const br = document.createElement('br')
              const newTextNode = document.createTextNode(afterText)
              caretNode.parentNode.insertBefore(br, caretNode.nextSibling)
              caretNode.parentNode.insertBefore(newTextNode, br.nextSibling)
              setCursorAt(newTextNode, 0)
            } else {
              const trailing = ensureTrailingTextNode(container)
              container.insertBefore(document.createElement('br'), trailing)
              setCursorAt(trailing, 0)
            }
            closeDropdownRef.current()
            onValuesChangeRef.current?.(readValues(container))
          } else if (ds.visible && ds.index >= 0) {
            // Non-multiline: Enter selects the highlighted dropdown item
            const caretNode = getCaretTextNode(container)
            confirmText(ds.items[ds.index], caretNode || undefined)
            const curr = caretNode || getTrailingTextNode(container)
            if (curr) moveCursorToEndOf(curr)
          }
          break
        }

        case 'ArrowDown':
          if (ds.visible) {
            e.preventDefault()
            // handled by hook when dropdown is visible; fallback for safety
          }
          break

        case 'ArrowUp':
          if (ds.visible) {
            e.preventDefault()
            // handled by hook when dropdown is visible; fallback for safety
          }
          break

        case 'Escape':
          if (ds.visible) {
            e.preventDefault()
            closeDropdownRef.current()
          }
          break

        case 'Backspace': {
          // Walk backwards past empty structural text nodes to find the nearest pill or BR.
          // If the cursor is mid-text (offset > 0), getNodeBeforeCaret returns null and
          // the browser handles normal character deletion without interference.
          let before = getNodeBeforeCaret(container)
          while (
            before &&
            before.nodeType === Node.TEXT_NODE &&
            !before.textContent
          ) {
            before = before.previousSibling
          }
          if (
            before &&
            (before.hasAttribute?.('data-pill') || before.nodeName === 'BR')
          ) {
            e.preventDefault()
            container.removeChild(before)
            onValuesChangeRef.current?.(readValues(container))
            updatePlaceholder()
          }
          break
        }

        case 'Delete': {
          // When the cursor is at the end of a line and the next meaningful node is a BR,
          // erase only the BR (joining the two lines) rather than letting the browser
          // consume the first pill of the next line. If the next node is regular text,
          // fall through to default browser forward-delete.
          let after = getNodeAfterCaret(container)
          while (
            after &&
            after.nodeType === Node.TEXT_NODE &&
            !after.textContent
          ) {
            after = after.nextSibling
          }
          if (after && after.nodeName === 'BR') {
            e.preventDefault()
            container.removeChild(after)
            onValuesChangeRef.current?.(readValues(container))
            updatePlaceholder()
          }
          // Otherwise let the browser delete the next character normally.
          break
        }
      }
    }

    function handleMouseDown(e) {
      // Dismiss pill via event delegation (mousedown so focus doesn't shift first)
      const dismissBtn = e.target.closest?.('[data-pill-dismiss]')
      if (dismissBtn && !disabledRef.current) {
        e.preventDefault()
        const pill = dismissBtn.closest('[data-pill]')
        if (pill && pill.parentNode === container) {
          container.removeChild(pill)
          ensureTrailingTextNode(container)
          moveCursorToEnd(container)
          onValuesChangeRef.current?.(readValues(container))
          updatePlaceholder()
        }
      }
    }

    function handleClick(e) {
      if (!onPillClickRef.current) return
      if (e.ctrlKey || e.metaKey) return
      const pillEl = e.target.closest?.('[data-pill]')
      if (!pillEl) return
      if (e.target.closest?.('[data-pill-dismiss]')) return
      if (e.target.closest?.('[data-slot-cycling]')) return
      onPillClickRef.current(pillEl.getAttribute('data-value') ?? '')
    }

    function handleFocus() {
      isFocusedRef.current = true
      setShowPlaceholderRef.current(false)
    }

    function handleBlur() {
      isFocusedRef.current = false
      // Confirm any uncommitted text in any text node (left to right)
      for (const n of [...container.childNodes]) {
        if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
          confirmText(n.textContent.trim(), n)
        }
      }
      closeDropdownRef.current()
      updatePlaceholder()
    }

    function handlePaste(e) {
      if (disabledRef.current) return
      e.preventDefault()
      const text =
        (e.clipboardData || window.clipboardData)?.getData('text/plain') ?? ''
      if (!text) return
      const caretNode = getCaretTextNode(container)
      const activeNode = caretNode || getTrailingTextNode(container)
      const { parts, commitAll } = splitPastedText(text)
      if (parts.length === 0) return
      if (commitAll) {
        for (const part of parts) confirmText(part, activeNode)
        activeNode.textContent = ''
        setCursorAt(activeNode, 0)
        closeDropdownRef.current()
        return
      }
      for (let i = 0; i < parts.length - 1; i++)
        confirmText(parts[i], activeNode)
      const last = parts[parts.length - 1]
      if (last && activeNode) {
        activeNode.textContent = last
        moveCursorToEndOf(activeNode)
        showDropdownRef.current(last)
      }
    }

    // Every path must end in an explicit show or hide: mouseleave does not
    // bubble and is bound to the container, so moving pill→pill (or onto the
    // gap between pills) fires no leave event. A bare early return would leave
    // the previous pill's tooltip on screen, misattributed to the pill now
    // under the cursor.
    function handlePillMouseOver(e) {
      const pill = e.target.closest?.('[data-pill]')
      if (!pill) {
        tooltipCtxRef.current?.hide()
        return
      }
      const val = pill.getAttribute('data-value')
      const callerText = getPillTooltipRef.current?.(val)
      const text = pill.hasAttribute('data-pill-unknown')
        ? [callerText, UNKNOWN_TOOLTIP_LINE].filter(Boolean).join('\n')
        : callerText
      if (text) tooltipCtxRef.current?.show(text, e.clientX, e.clientY, pill)
      else tooltipCtxRef.current?.hide()
    }

    function handlePillMouseLeave() {
      tooltipCtxRef.current?.hide()
    }

    container.addEventListener('input', handleInput)
    container.addEventListener('keydown', handleKeyDown)
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('click', handleClick)
    container.addEventListener('focus', handleFocus)
    container.addEventListener('blur', handleBlur)
    container.addEventListener('paste', handlePaste)
    container.addEventListener('mouseover', handlePillMouseOver)
    container.addEventListener('mouseleave', handlePillMouseLeave)

    return () => {
      container.removeEventListener('input', handleInput)
      container.removeEventListener('keydown', handleKeyDown)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('click', handleClick)
      container.removeEventListener('focus', handleFocus)
      container.removeEventListener('blur', handleBlur)
      container.removeEventListener('paste', handlePaste)
      container.removeEventListener('mouseover', handlePillMouseOver)
      container.removeEventListener('mouseleave', handlePillMouseLeave)
    }
  }, []) // intentional: mount/unmount only

  // ── Sync values prop → DOM when not focused ────────────────────────────────
  // lastSyncedRef must advance whenever `values` changes, even while focused —
  // imperative pill deletion (dismiss button, Backspace) updates `values` without
  // touching this cache, so a later revert to the pre-deletion values would
  // otherwise compare equal to the stale cache and skip the DOM rebuild.
  const lastSyncedRef = useRef(null)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (JSON.stringify(values) === JSON.stringify(lastSyncedRef.current)) return
    lastSyncedRef.current = [...values]
    if (isFocusedRef.current) return
    buildDOM(
      container,
      values,
      renderPillRef.current,
      !!onPillClickRef.current,
      disabledRef.current,
      pillStepRef.current,
      isUnknownRef.current,
    )
    setShowPlaceholder(values.length === 0)
  }, [values]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh unknown flags in place when the list or flagUnknown changes ────
  // Runs regardless of focus and never rebuilds the editor or touches text
  // nodes, so the caret survives. A custom pill is re-rendered whole, since
  // its renderer owns its DOM.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    for (const pill of [...container.children]) {
      if (!pill.hasAttribute('data-pill')) continue
      const value = pill.getAttribute('data-value')
      const unknown = isUnknownRef.current(value)
      if (unknown === pill.hasAttribute('data-pill-unknown')) continue
      if (renderPillRef.current) {
        pill.replaceWith(
          createPillElement(
            value,
            renderPillRef.current,
            !!onPillClickRef.current,
            disabledRef.current,
            pillStepRef.current,
            unknown,
          ),
        )
      } else if (unknown) {
        // A plain pill's content area is its last child, and its colour is
        // the pill's own text colour (disabled or primary).
        const contentArea = pill.lastElementChild
        contentArea.appendChild(
          createUnknownIconEl(pillStepRef.current, contentArea.style.color),
        )
        pill.setAttribute('data-pill-unknown', '')
      } else {
        pill.querySelector('[data-pill-unknown-icon]')?.remove()
        pill.removeAttribute('data-pill-unknown')
      }
    }
  }, [knownKeys, flagUnknown])

  // ── Render ────────────────────────────────────────────────────────────────
  const t = currentTheme.value
  const status = validation?.status ?? 'idle'

  // Size geometry. Memoised on the props so a re-render does not repeat a
  // size warning.
  const size = useMemo(
    () => resolveFieldSize('pill-input', sizeProp, heightScale, CONTROL_SIZES),
    [sizeProp, heightScale],
  )
  const step = getControlSize(t, size)
  const embedded = getEmbeddedButtonLayout(t, size)
  const pillStep = pillSizeInField(size)
  pillStepRef.current = pillStep
  const pillRowHeight =
    parseFloat(getPillSize(t, pillStep).height) + 2 * PILL_MARGIN
  // The pills are imperative DOM, so a later `size` change must rebuild them
  // at the new pill step. The mount effect already built them at the initial
  // step, so the first run is skipped.
  const builtPillStepRef = useRef(pillStep)
  useEffect(() => {
    if (builtPillStepRef.current === pillStep) return
    builtPillStepRef.current = pillStep
    const container = containerRef.current
    if (!container || isFocusedRef.current) return
    buildDOM(
      container,
      values,
      renderPillRef.current,
      !!onPillClickRef.current,
      disabledRef.current,
      pillStep,
      isUnknownRef.current,
    )
  }, [pillStep]) // eslint-disable-line react-hooks/exhaustive-deps
  // Memoised on the prop so a re-render does not repeat a widthScale warning.
  const resolvedWidthScale = useMemo(
    () =>
      resolveWidthScale('pill-input', widthScale, {
        allowAuto: false,
        fallback: 'full',
      }),
    [widthScale],
  )
  const { width, flex } = getWidthScaleStyle('pill-input', resolvedWidthScale, {
    allowAuto: false,
    fallback: 'full',
    theme: t,
  })
  const borderWidth = parseFloat(t.border.width)
  const stepHeight = parseFloat(step.height)
  // Vertical padding centres one pill row (pillRowHeight) inside the step
  // height; at medium this reproduces the original 6px.
  const padY = Math.max(0, (stepHeight - 2 * borderWidth - pillRowHeight) / 2)
  // Absolutely positioned buttons are placed from the padding edge (inside
  // the border), so subtract the border from the outer-edge inset.
  const buttonInset = Math.max(0, embedded.offset - borderWidth)
  const secondaryTop = buttonInset + embedded.buttonHeight + embedded.gap
  // Placeholder text is vertically centred within the first pill row.
  const placeholderTop =
    padY + (pillRowHeight - parseFloat(step.fontSize) * 1.6) / 2
  const outerStyle = {
    ...(fixedHeight != null
      ? {
          height: `${fixedHeight}px`,
          minHeight: `${fixedHeight}px`,
          maxHeight: `${fixedHeight}px`,
          overflowY: 'auto',
        }
      : {}),
    // Multiline: lay the shell out as a column so the contenteditable div can
    // grow to fill the full shell height, making the entire area click-to-focus.
    ...(multiline ? { display: 'flex', flexDirection: 'column' } : {}),
    // secondaryButtonProps sits one button + gap below the primary, so the
    // shell needs room for both plus the inset below. The caller-supplied
    // minHeight can only raise that floor, never lower it.
    ...(fixedHeight == null && (minHeight != null || secondaryButtonProps)
      ? {
          minHeight: `${Math.max(
            minHeight ?? 0,
            secondaryButtonProps
              ? 2 * embedded.offset + 2 * embedded.buttonHeight + embedded.gap
              : 0,
          )}px`,
        }
      : {}),
    // Disabled: swap to muted background/border colours (reuse Button disabled tokens)
    ...(disabled
      ? {
          backgroundColor: t.colors.background.disabled,
          borderColor: t.colors.border.secondary,
          cursor: 'default',
        }
      : {}),
    // A judged validation status takes over the border; a disabled field stays muted.
    ...(!disabled && status !== 'idle'
      ? { borderColor: validationBorderColor(status, t) }
      : {}),
  }

  // Right-pad so text/pills don't flow under the buttons. The primary and
  // secondary buttons are stacked in one column, so one button's width plus
  // its insets covers both (see getEmbeddedButtonLayout).
  const hasButtons = !!(buttonProps || secondaryButtonProps)
  const buttonPaddingRight = hasButtons
    ? `${embedded.paddingRight}px`
    : undefined
  const placeholderRight = hasButtons
    ? `${embedded.paddingRight + PAD_X}px`
    : `${PAD_X}px`
  const mergedButtonDisabled = buttonProps
    ? buttonProps.disabled || disabled
    : undefined
  const mergedSecondaryDisabled = secondaryButtonProps
    ? secondaryButtonProps.disabled || disabled
    : undefined

  return html`
    <${FormGroup} width=${width} flex=${flex}>
      ${label ? html`<${StyledLabel}>${label}</${StyledLabel}>` : null}
      <${EditorOuter}
        style=${outerStyle}
        minHeight=${step.height}
        padding=${`${padY}px ${PAD_X}px`}
        borderRadius=${step.borderRadius}
        fontSize=${step.fontSize}
      >
        ${
          showPlaceholder && placeholder
            ? html`
                <span
                  style=${{
                    position: 'absolute',
                    top: `${placeholderTop}px`,
                    left: `${PAD_X}px`,
                    right: placeholderRight,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    color: disabled
                      ? t.colors.text.disabled
                      : t.colors.text.placeholder,
                    fontSize: step.fontSize,
                    fontFamily: t.typography.fontFamily,
                    lineHeight: '1.6',
                  }}
                  >${placeholder}</span
                >
              `
            : null
        }
        <div
          ref=${containerRef}
          contenteditable=${disabled ? 'false' : 'true'}
          spellcheck="false"
          ...${rest}
          style=${{
            ...(rest.style || {}),
            outline: 'none',
            minHeight: fixedHeight
              ? `${fixedHeight - 16}px`
              : `${pillRowHeight}px`,
            // In multiline mode the shell is a flex column; grow to fill its full
            // height so empty space below the text/pills still focuses the editor.
            ...(multiline ? { flexGrow: 1 } : {}),
            // No opacity reduction — the outer container's disabled colours carry
            // the visual weight; inner opacity would double-dim pills.
            color: disabled ? t.colors.text.disabled : undefined,
            ...(buttonPaddingRight !== undefined
              ? { paddingRight: buttonPaddingRight }
              : {}),
          }}
        ></div>
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
                    top: `${buttonInset}px`,
                    right: `${buttonInset}px`,
                  }}
                />
              `
            : null
        }
        ${
          secondaryButtonProps
            ? html`
                <${Button}
                  size=${embedded.buttonSize}
                  icon=${secondaryButtonProps.icon}
                  color=${secondaryButtonProps.color}
                  disabled=${mergedSecondaryDisabled}
                  loading=${secondaryButtonProps.loading}
                  title=${secondaryButtonProps.title}
                  tooltip=${secondaryButtonProps.tooltip}
                  onClick=${secondaryButtonProps.onClick}
                  style=${{
                    position: 'absolute',
                    top: `${secondaryTop}px`,
                    right: `${buttonInset}px`,
                  }}
                />
              `
            : null
        }
      </${EditorOuter}>
      <${AutocompleteDropdown} dropdownState=${dropdownState} onItemClick=${handleDropdownClick} />
      <${ValidationMessage}
        status=${status}
        message=${validation?.message ?? ''}
      />
    </${FormGroup}>
  `
}
