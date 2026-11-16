import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'

const Track = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  touch-action: none;
  background-color: ${(props) => props.backgroundColor};
  transition: ${(props) => props.transition};

  &:hover {
    height: ${(props) => (props.disabled ? '6px' : '8px')};
  }
`
Track.className = 'seek-bar'

const Fill = styled('div')`
  height: 100%;
  border-radius: 3px;
  width: ${(props) => props.width};
  background-color: ${(props) => props.backgroundColor};
  transition: ${(props) => (props.dragging ? 'none' : 'width 0.1s linear')};
`
Fill.className = 'seek-bar-fill'

const fractionAt = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

/**
 * SeekBar — a progress track the user can click or drag to move a playhead.
 * The fill follows the pointer while dragging; `onSeek` fires once on release,
 * so a plain click is a drag of zero length.
 *
 * @param {Object} props
 * @param {number} props.progress - Current position, 0–1.
 * @param {(fraction: number) => void} props.onSeek - Called once on release with the 0–1 target.
 * @param {boolean} [props.disabled=false] - Ignores pointer input and dims the bar.
 *
 * @example
 * <${SeekBar} progress=${elapsed / duration} onSeek=${(f) => (audio.currentTime = f * duration)} />
 */
export function SeekBar({ progress, onSeek, disabled = false }) {
  const [theme, setTheme] = useState(currentTheme.value)
  const [dragFraction, setDragFraction] = useState(null)

  useEffect(() => currentTheme.subscribe(setTheme), [])

  const handlePointerDown = (e) => {
    if (disabled) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragFraction(fractionAt(e))
  }

  const handlePointerMove = (e) => {
    if (dragFraction === null) return
    setDragFraction(fractionAt(e))
  }

  const handlePointerUp = (e) => {
    if (dragFraction === null) return
    const fraction = fractionAt(e)
    setDragFraction(null)
    onSeek(fraction)
  }

  const handlePointerCancel = () => setDragFraction(null)

  const shown = dragFraction ?? progress
  const percent =
    Math.max(0, Math.min(1, Number.isFinite(shown) ? shown : 0)) * 100

  return html`
    <${Track}
      disabled=${disabled}
      backgroundColor=${theme.colors.overlay.background}
      transition=${`height ${theme.transitions.fast}`}
      onPointerDown=${handlePointerDown}
      onPointerMove=${handlePointerMove}
      onPointerUp=${handlePointerUp}
      onPointerCancel=${handlePointerCancel}
    >
      <${Fill}
        width=${`${percent}%`}
        dragging=${dragFraction !== null}
        backgroundColor=${theme.colors.primary.background}
      />
    </${Track}>
  `
}
