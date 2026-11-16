/**
 * log-view.mjs – Generic, layout-agnostic log display.
 *
 * `LogView` is purely presentational: it has no fixed height, no positioning,
 * and no knowledge of what process (if any) produced its lines. It fills
 * whatever box its parent gives it, so a host can drop it into a setup step,
 * a page section, a modal, or a floating panel without changes. The host owns
 * fetching/streaming the lines and the `followTail` state — this component
 * only renders them and reports scroll/toggle intent back up.
 *
 * @module custom-ui/msg/log-view
 */
import { html } from 'htm/preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { HorizontalEdgesLayout, Label } from '../themed-base.mjs'
import { ToggleSwitch } from '../io/toggle-switch.mjs'
import { Button } from '../io/button.mjs'

/**
 * @typedef {Object} LogLine
 * @property {number} ts     - Date.now() at capture
 * @property {'stdout'|'stderr'|'meta'} stream
 * @property {string} text   - the raw line, unparsed
 */

// How far (in px) the user has to scroll up from the bottom before we treat
// it as "left the tail" and ask the host to flip followTail off.
const SCROLL_BOTTOM_THRESHOLD = 24

// A scroll event carries no information about who caused it, and the browser
// dispatches them asynchronously (at most once per frame). During a burst of
// log lines a scroll event queued by our own pin-to-bottom can therefore land
// after a later render has already grown scrollHeight, making it look like the
// user scrolled up by the height of the new content. So a scroll only counts
// as user intent when a real input gesture landed this recently.
const GESTURE_WINDOW_MS = 1000

// Keys that scroll a container. Space is included because it pages down.
const GESTURE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
])

const LogViewRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.gap};
  width: 100%;
  height: 100%;
  min-height: 0;
`
LogViewRoot.className = 'log-view-root'

const LogLineRow = styled('div')`
  color: ${(props) => props.color};
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ${(props) => props.fontFamily};
  font-size: ${(props) => props.fontSize};
  line-height: 1.4;
`
LogLineRow.className = 'log-view-line'

/**
 * LogView - Scrollable monospace log body with a follow-tail toggle and copy action.
 *
 * The scroll container is a plain `<div>` (not a `styled()` wrapper) because
 * its ref is used for DOM scroll measurement, which only works against a raw
 * DOM node.
 *
 * @param {Object} props
 * @param {LogLine[]} [props.lines=[]] - Lines to render, in capture order.
 * @param {boolean} [props.followTail=true] - When true, auto-scrolls to the bottom on every `lines` change.
 * @param {Function} [props.onFollowTailChange] - Called with the new boolean when the toggle is changed by
 *   the user, or when the user manually scrolls away from the bottom (called with `false`). A scroll only
 *   counts as manual when it accompanies a recent wheel, touch, or key gesture; scrolling caused by
 *   LogView's own pin-to-bottom never disables follow-tail. LogView never re-enables follow-tail on its
 *   own — the toggle is the only way back on.
 * @param {Function} [props.onCopy] - Called when the copy button is clicked. LogView does not implement
 *   clipboard access itself — the host decides what "copy" means (e.g. join all lines' text).
 * @param {string} [props.emptyMessage='No output yet'] - Message shown via `Label` when `lines` is empty.
 * @returns {preact.VNode}
 *
 * @example
 * // Host owns followTail state and line data
 * <LogView
 *   lines={lines}
 *   followTail={followTail}
 *   onFollowTailChange={setFollowTail}
 *   onCopy={() => navigator.clipboard.writeText(lines.map((l) => l.text).join('\n'))}
 * />
 */
export function LogView({
  lines = [],
  followTail = true,
  onFollowTailChange,
  onCopy,
  emptyMessage = 'No output yet',
}) {
  const [theme, setTheme] = useState(currentTheme.value)
  const scrollRef = useRef(null)
  const lastGestureRef = useRef(0)
  const programmaticRef = useRef(false)

  useEffect(() => currentTheme.subscribe(setTheme), [])

  useEffect(() => {
    if (!followTail) return
    let frame = null

    const pinToBottom = () => {
      const el = scrollRef.current
      if (!el) return
      programmaticRef.current = true
      el.scrollTop = el.scrollHeight
      // Scroll events land a frame later, so hold the guard until then.
      frame = requestAnimationFrame(() => {
        programmaticRef.current = false
        frame = null
      })
    }

    pinToBottom()
    // A burst can grow the container after this effect ran; re-pin next frame.
    const rePin = requestAnimationFrame(pinToBottom)

    return () => {
      cancelAnimationFrame(rePin)
      if (frame !== null) cancelAnimationFrame(frame)
      programmaticRef.current = false
    }
  }, [lines, followTail])

  const markGesture = () => {
    lastGestureRef.current = Date.now()
  }

  const handleKeyDown = (e) => {
    if (GESTURE_KEYS.has(e.key)) markGesture()
  }

  const handleScroll = (e) => {
    if (!followTail) return
    if (programmaticRef.current) return
    if (Date.now() - lastGestureRef.current > GESTURE_WINDOW_MS) return
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom > SCROLL_BOTTOM_THRESHOLD) {
      onFollowTailChange?.(false)
    }
  }

  const lineColor = (stream) => {
    if (stream === 'stderr') return theme.colors.danger.background
    if (stream === 'meta') return theme.colors.text.secondary
    return theme.colors.text.primary
  }

  return html`
    <${LogViewRoot} gap=${theme.spacing.medium.gap}>
      <${HorizontalEdgesLayout}>
        <${ToggleSwitch}
          label="Follow tail"
          checked=${followTail}
          onChange=${(e) => onFollowTailChange?.(e.target.checked)}
        />
        <${Button}
          size="small"
          icon="copy"
          title="Copy log"
          onClick=${onCopy}
        />
      </${HorizontalEdgesLayout}>
      <div
        ref=${scrollRef}
        onScroll=${handleScroll}
        onWheel=${markGesture}
        onTouchMove=${markGesture}
        onKeyDown=${handleKeyDown}
        style=${{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          // Chromium's scroll anchoring re-adjusts scrollTop when lines are
          // inserted, fighting the pin and firing spurious scroll events.
          overflowAnchor: 'none',
          fontFamily: theme.monotype.fontFamily,
          fontSize: theme.monotype.fontSize.medium,
          backgroundColor: theme.colors.background.secondary,
          border: `${theme.border.width} ${theme.border.style} ${theme.colors.border.primary}`,
          borderRadius: theme.border.radius.small,
          padding: theme.spacing.medium.padding,
        }}
      >
        ${
          lines.length === 0
            ? html`<${Label}>${emptyMessage}</${Label}>`
            : lines.map(
                (line, index) => html`
                  <${LogLineRow}
                    key=${index}
                    color=${lineColor(line.stream)}
                    fontFamily=${theme.monotype.fontFamily}
                    fontSize=${theme.monotype.fontSize.medium}
                  >${line.text}</${LogLineRow}>
                `,
              )
        }
      </div>
    </${LogViewRoot}>
  `
}
