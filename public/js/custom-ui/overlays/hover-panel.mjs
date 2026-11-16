/**
 * hover-panel.mjs - Hover panel component for showing content on hover/programmatically
 *
 * This module provides a context-based hover panel system that can be used to display
 * floating content panels. The panel can be triggered programmatically or attached to
 * elements for hover-based display.
 *
 * The panel follows the mouse cursor by positioning itself above and to the right of
 * the cursor position. Use onMouseMove with follow() to enable cursor tracking.
 *
 * Positioning geometry lives in `positionOverlay` (custom-ui/util.mjs): the preferred
 * placement is above-right of the cursor, flipping to the opposite side of either axis
 * when that would overflow the viewport, then clamping as a backstop.
 *
 * Because the panel's size only changes between `show()` calls, it is measured once per
 * show — rendered with `visibility: hidden` for a single frame so it occupies layout —
 * and the cached size is reused by `follow()`, which can then write the new position
 * synchronously inside the mousemove handler rather than lagging the cursor by a frame.
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

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Styled panel container with glass effect
 */
const HoverPanelContainer = styled('div')`
  z-index: 20000;
  max-width: 350px;
  max-height: 300px;
  overflow: auto;
  opacity: ${(props) => (props.visible ? 1 : 0)};
  transform: translateY(${(props) => (props.visible ? '0' : '-4px')});
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  pointer-events: ${(props) => (props.visible ? 'auto' : 'none')};
`

// ============================================================================
// Context
// ============================================================================

export const HoverPanelContext = createContext(null)

// ============================================================================
// Internal Panel Component
// ============================================================================

/**
 * Internal HoverPanel component rendered by the Provider
 */
function HoverPanelInternal({
  content,
  visible,
  position,
  measured,
  width,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) {
  const [theme, setTheme] = useState(currentTheme.value)

  useEffect(() => {
    const unsubscribe = currentTheme.subscribe(setTheme)
    return () => unsubscribe()
  }, [])

  const style = {
    position: 'fixed',
    // Until measured, the panel is pinned at the viewport origin where nothing
    // constrains its width. A `position: fixed` box with a `max-width` and no
    // `width` shrink-to-fits against the viewport, so measuring it at the
    // preferred near-the-edge position would report a narrow, tall rect and
    // position a panel that was never going to be that shape.
    left: measured ? `${position.x}px` : '0px',
    top: measured ? `${position.y}px` : '0px',
    // Locked to the measured natural width once known, so a clamped position
    // can't squeeze the panel into a narrower column and re-wrap its content.
    ...(measured && width != null ? { width: `${width}px` } : {}),
    // Gates the one-frame hidden measure pass only; `visible` still drives the
    // opacity/transform fade, so a shown-and-measured panel is fully opaque.
    visibility: measured ? 'visible' : 'hidden',
    padding: theme.spacing.large.padding,
    borderRadius: theme.border.radius.medium,
    backgroundColor: theme.colors.overlay.glass,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: theme.shadow.elevated,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize.medium,
    lineHeight: '1.5',
  }

  return html`
    <${HoverPanelContainer}
      id="custom-ui-hover-panel"
      visible=${visible}
      style=${style}
      onMouseEnter=${onMouseEnter}
      onMouseMove=${onMouseMove}
      onMouseLeave=${onMouseLeave}
    >
      ${content}
    </${HoverPanelContainer}>
  `
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * HoverPanelProvider - Context provider for hover panel functionality
 *
 * Wrap your application with this provider to enable hover panel functionality.
 * Use the useHoverPanel hook to access show/hide methods.
 *
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content wrapped by provider
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${HoverPanelProvider}>
 *     <${MyApp} />
 *   </${HoverPanelProvider}>
 * `
 */
export function HoverPanelProvider({ children }) {
  const [state, setState] = useState({
    content: null,
    visible: false,
    position: { x: 0, y: 0 },
    measured: false,
    width: null,
  })

  const hideTimeoutRef = useRef(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  /** @type {{ current: { width: number, height: number } | null }} */
  const sizeRef = useRef(null)
  const rafRef = useRef(null)

  const cancelMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /**
   * Compute the panel's fixed-position coordinates for a cursor position, using a
   * previously measured size. Preferred placement is above-right of the cursor; the
   * offsets and the viewport-edge margin both come from the theme's small padding.
   *
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {{ width: number, height: number }} size
   * @returns {{ x: number, y: number }}
   */
  const computePosition = useCallback((mouseX, mouseY, size) => {
    const gap = parseFloat(currentTheme.value.spacing.medium.padding) || 0
    const { left, top } = positionOverlay({
      anchor: { x: mouseX, y: mouseY },
      size,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      margin: gap,
      placement: {
        horizontal: 'right',
        vertical: 'above',
        offsetX: gap,
        offsetY: gap,
      },
    })
    return { x: left, y: top }
  }, [])

  /**
   * Show the hover panel with content at mouse cursor position
   *
   * @param {string|preact.VNode} content - Content to display in the panel
   * @param {MouseEvent|Object} mouseEventOrCoords - Mouse event or {x, y} coordinates
   */
  const show = useCallback(
    (content, mouseEventOrCoords) => {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      // A measure queued for the previous content must not write state for it.
      cancelMeasure()

      // Extract mouse coordinates
      let mouseX, mouseY
      if (mouseEventOrCoords && typeof mouseEventOrCoords === 'object') {
        if (
          'clientX' in mouseEventOrCoords &&
          'clientY' in mouseEventOrCoords
        ) {
          // It's a mouse event
          mouseX = mouseEventOrCoords.clientX
          mouseY = mouseEventOrCoords.clientY
        } else if ('x' in mouseEventOrCoords && 'y' in mouseEventOrCoords) {
          // It's a coordinates object
          mouseX = mouseEventOrCoords.x
          mouseY = mouseEventOrCoords.y
        }
      }

      // Validate coordinates
      if (mouseX === undefined || mouseY === undefined) {
        throw new Error('HoverPanel: No valid mouse coordinates provided')
      }

      // Store mouse position
      mousePositionRef.current = { x: mouseX, y: mouseY }

      // Content is the only thing that changes the panel's size, so the cached
      // measurement is invalidated on every show().
      sizeRef.current = null

      // Render hidden at the last known coordinates, then measure and reveal.
      setState((prev) => ({
        content,
        visible: true,
        position: prev.position,
        measured: false,
        width: null,
      }))

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const panel = document.getElementById('custom-ui-hover-panel')
        if (!panel) return

        const rect = panel.getBoundingClientRect()
        const size = { width: rect.width, height: rect.height }
        sizeRef.current = size

        const { x, y } = mousePositionRef.current
        setState((prev) => ({
          ...prev,
          position: computePosition(x, y, size),
          measured: true,
          width: size.width,
        }))
      })
    },
    [cancelMeasure, computePosition],
  )

  /**
   * Hide the hover panel
   *
   * @param {boolean} immediate - If true, hide immediately without delay
   */
  const hide = useCallback(
    (immediate = false) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }

      // Don't let a queued measure reveal content that is on its way out.
      cancelMeasure()

      if (immediate) {
        setState((prev) => ({ ...prev, visible: false }))
      } else {
        // Small delay to allow mouse to move to panel
        hideTimeoutRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, visible: false }))
          hideTimeoutRef.current = null
        }, 150)
      }
    },
    [cancelMeasure],
  )

  /**
   * Cancel pending hide (e.g., when mouse enters panel)
   */
  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  /**
   * Update panel position to follow cursor movement
   * Call this from onMouseMove handlers to enable cursor tracking
   *
   * Computes and writes synchronously from the size cached by the last show() —
   * no requestAnimationFrame and no re-measure, so the panel doesn't trail the
   * cursor by a frame. If the first measure hasn't resolved yet there is no size
   * to position against, so the update is skipped rather than measuring here.
   *
   * @param {MouseEvent} e - Mouse event with clientX and clientY coordinates
   */
  const follow = useCallback(
    (e) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY }

      const size = sizeRef.current
      if (!size) return

      const position = computePosition(e.clientX, e.clientY, size)
      setState((prev) => ({ ...prev, position }))
    },
    [computePosition],
  )

  // Cleanup timeout and any queued measure on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const value = {
    show,
    hide,
    follow,
    isVisible: state.visible,
  }

  return html`
    <${HoverPanelContext.Provider} value=${value}>
      ${children}
      ${createPortal(
        html`
          <${HoverPanelInternal}
            id="custom-ui-hover-panel"
            content=${state.content}
            visible=${state.visible}
            position=${state.position}
            measured=${state.measured}
            width=${state.width}
            onMouseEnter=${cancelHide}
            onMouseMove=${follow}
            onMouseLeave=${() => hide()}
          />
        `,
        document.body,
      )}
    </${HoverPanelContext.Provider}>
  `
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access hover panel functionality
 *
 * @returns {Object} Hover panel methods
 * @returns {Function} return.show - Show hover panel: show(content, mouseEvent)
 * @returns {Function} return.hide - Hide hover panel: hide(immediate?)
 * @returns {Function} return.follow - Update panel position to follow cursor: follow(mouseEvent)
 * @returns {boolean} return.isVisible - Whether the panel is currently visible
 *
 * @example
 * function MyComponent() {
 *   const hoverPanel = useHoverPanel();
 *
 *   const handleMouseEnter = (e) => {
 *     hoverPanel.show('Tooltip content here', e);
 *   };
 *
 *   const handleMouseMove = (e) => {
 *     hoverPanel.follow(e);
 *   };
 *
 *   const handleMouseLeave = () => {
 *     hoverPanel.hide();
 *   };
 *
 *   return html`
 *     <button
 *       onMouseEnter=${handleMouseEnter}
 *       onMouseMove=${handleMouseMove}
 *       onMouseLeave=${handleMouseLeave}
 *     >
 *       Hover me
 *     </button>
 *   `;
 * }
 */
export function useHoverPanel() {
  const context = useContext(HoverPanelContext)
  if (!context) {
    throw new Error('useHoverPanel must be used within a HoverPanelProvider')
  }
  return context
}
