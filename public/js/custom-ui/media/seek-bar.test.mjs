import { vi, describe, test, expect, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/preact'
import { html } from 'htm/preact'
import { SeekBar } from './seek-bar.mjs'

afterEach(() => cleanup())

// jsdom lays nothing out, so give the track a 200px box starting at x = 100.
const mountBar = (props) => {
  const result = render(html`<${SeekBar} progress=${0} ...${props} />`)
  const track = result.container.querySelector('.seek-bar')
  track.getBoundingClientRect = () => ({ left: 100, width: 200 })
  return { ...result, track }
}

const fire = (el, type, clientX) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
  })

const fillWidth = (container) =>
  container.querySelector('.seek-bar-fill').style.width ||
  getComputedStyle(container.querySelector('.seek-bar-fill')).width

describe('SeekBar', () => {
  test('press, drag and release seeks once at the release position', () => {
    const onSeek = vi.fn()
    const { track } = mountBar({ onSeek })

    fire(track, 'pointerdown', 120)
    fire(track, 'pointermove', 160)
    expect(onSeek).not.toHaveBeenCalled()
    fire(track, 'pointerup', 200)

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(0.5)
  })

  test('a press and release with no movement seeks to the press position', () => {
    const onSeek = vi.fn()
    const { track } = mountBar({ onSeek })

    fire(track, 'pointerdown', 150)
    fire(track, 'pointerup', 150)

    expect(onSeek).toHaveBeenCalledWith(0.25)
  })

  test('the fill follows the pointer during a drag', () => {
    const { track, container } = mountBar({ onSeek: vi.fn() })

    fire(track, 'pointerdown', 100)
    fire(track, 'pointermove', 250)

    expect(fillWidth(container)).toBe('75%')
  })

  test('a cancelled drag does not seek', () => {
    const onSeek = vi.fn()
    const { track } = mountBar({ onSeek })

    fire(track, 'pointerdown', 150)
    fire(track, 'pointercancel', 150)
    fire(track, 'pointerup', 150)

    expect(onSeek).not.toHaveBeenCalled()
  })

  test('releasing outside the bar clamps to 0 and 1', () => {
    const onSeek = vi.fn()
    const { track } = mountBar({ onSeek })

    fire(track, 'pointerdown', 150)
    fire(track, 'pointerup', 900)
    fire(track, 'pointerdown', 150)
    fire(track, 'pointerup', -50)

    expect(onSeek.mock.calls).toEqual([[1], [0]])
  })

  test('disabled ignores pointer input', () => {
    const onSeek = vi.fn()
    const { track } = mountBar({ onSeek, disabled: true })

    fire(track, 'pointerdown', 150)
    fire(track, 'pointerup', 150)

    expect(onSeek).not.toHaveBeenCalled()
  })
})
