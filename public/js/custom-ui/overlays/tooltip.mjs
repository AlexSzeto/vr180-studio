/**
 * tooltip.mjs – Custom tooltip system using context/provider pattern.
 *
 * Renders a single shared tooltip portal anchored to the cursor position
 * captured at hover-start. The tooltip appears after a 600ms delay and
 * stays fixed at that position (no cursor follow). Placement prefers
 * below-right of the cursor and flips to the opposite side of either axis when
 * that would overflow the viewport, resolved by `positionOverlay` after a
 * one-frame hidden measure pass so the un-flipped position is never painted.
 *
 * Usage:
 *   Wrap your app in <TooltipProvider>. Consume via useTooltip() hook or
 *   read TooltipContext directly (e.g. in class components via contextType).
 *
 * @module custom-ui/overlays/tooltip
 */
import { html } from 'htm/preact'
import { createContext } from 'preact'
import {
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { positionOverlay } from '../util.mjs'

/**
 * DOM id of the single portalled tooltip box.
 *
 * The measure pass needs the real DOM node, and a `ref` on a goober `styled()`
 * component yields the Preact component instance instead (see
 * `.claude/rules/client.md`), so the node is looked up by id — the same
 * approach the sibling `hover-panel.mjs` uses.
 */
const TOOLTIP_BOX_ID = 'custom-ui-tooltip-box'

/** Preferred gap between the cursor and the tooltip box, in px. */
const TOOLTIP_OFFSET_X = 12
const TOOLTIP_OFFSET_Y = 16

// ============================================================================
// Styled Components
// ============================================================================

const TooltipBox = styled('div')`
  position: fixed;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  visibility: ${(props) => props.visibility};
  /* Locked to the measured natural width once known, so a clamped position
     can't squeeze the box into a narrower column and re-wrap its text. */
  width: ${(props) => (props.width == null ? 'auto' : `${props.width}px`)};
  z-index: 30000;
  pointer-events: none;
  max-width: 300px;
  padding: ${(props) => props.theme.spacing.medium.padding};
  border-radius: ${(props) => props.theme.border.radius.small};
  background-color: ${(props) => props.theme.colors.overlay.glass};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: ${(props) => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  box-shadow: ${(props) => props.theme.shadow.elevated};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.fontSize.small};
  color: ${(props) => props.theme.colors.text.primary};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
`
TooltipBox.className = 'tooltip-box'

// ============================================================================
// Context
// ============================================================================

export const TooltipContext = createContext(null)

/**
 * TooltipProvider – Wraps the app and provides the tooltip show/hide API.
 *
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${TooltipProvider}>
 *     <${App} />
 *   </${TooltipProvider}>
 * `
 */
export function TooltipProvider({ children }) {
  // { text, anchorX, anchorY, left, top, width, measured } | null
  //
  // `left`/`top` start at the preferred below-right placement and are
  // overwritten by the one-frame hidden measure pass below; `measured` gates
  // visibility so the un-flipped first placement is never painted.
  const [tooltip, setTooltip] = useState(null)
  const timerRef = useRef(null)
  const sourceElRef = useRef(null)
  const observerRef = useRef(null)
  const rafRef = useRef(null)
  const theme = currentTheme.value

  const cancelMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopWatchingSource = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    sourceElRef.current = null
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    cancelMeasure()
    stopWatchingSource()
    setTooltip(null)
  }, [stopWatchingSource, cancelMeasure])

  const show = useCallback(
    (text, anchorX, anchorY, sourceEl) => {
      if (!text) return
      // Clear any pending show
      if (timerRef.current) clearTimeout(timerRef.current)
      cancelMeasure()
      stopWatchingSource()
      sourceElRef.current = sourceEl || null
      timerRef.current = setTimeout(() => {
        // `measured: false` forces a fresh hidden measure pass even when a
        // tooltip is already on screen, so new content gets its own flip.
        setTooltip({
          text,
          anchorX,
          anchorY,
          left: anchorX + TOOLTIP_OFFSET_X,
          top: anchorY + TOOLTIP_OFFSET_Y,
          width: null,
          measured: false,
        })
        timerRef.current = null
        // If the hover source is removed from the DOM (e.g. content swap)
        // before the cursor leaves it, no mouseleave event fires. Watch for
        // that and self-dismiss instead of leaving the tooltip stuck.
        if (sourceElRef.current) {
          observerRef.current = new MutationObserver(() => {
            if (!sourceElRef.current?.isConnected) hide()
          })
          observerRef.current.observe(document.body, {
            childList: true,
            subtree: true,
          })
        }
      }, 600)
    },
    [hide, stopWatchingSource, cancelMeasure],
  )

  // One-frame hidden measure pass: the box is in the DOM with
  // `visibility: hidden` (so it still occupies layout and reports a real rect)
  // and pinned at the viewport origin, where nothing constrains its width. A
  // `position: fixed` box with a `max-width` and no `width` shrink-to-fits
  // against the viewport, so measuring it at the preferred near-the-edge
  // position would report a narrow, tall rect and place a tooltip that was
  // never going to be that shape. It is revealed only at the corrected
  // position, with the measured width locked in. Comparing against the exact
  // state object discards a frame that lands after a hide or a re-show.
  useEffect(() => {
    if (!tooltip || tooltip.measured) return
    const pending = tooltip
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = document.getElementById(TOOLTIP_BOX_ID)
      const rect = el ? el.getBoundingClientRect() : { width: 0, height: 0 }
      const size = { width: rect.width || 0, height: rect.height || 0 }
      const { left, top } = positionOverlay({
        anchor: { x: pending.anchorX, y: pending.anchorY },
        size,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        margin: parseFloat(theme.spacing.medium.padding) || 0,
        placement: {
          horizontal: 'right',
          vertical: 'below',
          offsetX: TOOLTIP_OFFSET_X,
          offsetY: TOOLTIP_OFFSET_Y,
        },
      })
      setTooltip((prev) =>
        prev === pending
          ? { ...prev, left, top, width: size.width, measured: true }
          : prev,
      )
    })
    return cancelMeasure
  }, [tooltip, theme, cancelMeasure])

  // Unmounting with a frame queued would otherwise set state on a dead provider.
  useEffect(() => cancelMeasure, [cancelMeasure])

  const value = { show, hide }

  return html`
    <${TooltipContext.Provider} value=${value}>
      ${children}
      ${
        tooltip &&
        createPortal(
          html`
        <${TooltipBox}
          id=${TOOLTIP_BOX_ID}
          x=${tooltip.measured ? tooltip.left : 0}
          y=${tooltip.measured ? tooltip.top : 0}
          width=${tooltip.measured ? tooltip.width : null}
          visibility=${tooltip.measured ? 'visible' : 'hidden'}
          theme=${theme}
        >
          ${tooltip.text}
        </${TooltipBox}>
      `,
          document.body,
        )
      }
    </${TooltipContext.Provider}>
  `
}

/**
 * useTooltip – Hook to access the tooltip context.
 *
 * @returns {{ show: Function, hide: Function }}
 *
 * @example
 * const tooltip = useTooltip();
 * // In an element:
 * // onMouseEnter=${(e) => tooltip.show('Hello!', e.clientX, e.clientY, e.currentTarget)}
 * // onMouseLeave=${() => tooltip.hide()}
 * // Pass the hover source element (4th arg) so the tooltip can self-dismiss
 * // if that element is removed from the DOM before the cursor leaves it.
 */
export function useTooltip() {
  const ctx = useContext(TooltipContext)
  if (!ctx) throw new Error('useTooltip must be used within a TooltipProvider')
  return ctx
}
