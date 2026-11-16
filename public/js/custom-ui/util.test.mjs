/**
 * util.test.mjs – Unit tests for helpers in util.mjs.
 */
import { test, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger.mjs', () => ({ log: vi.fn() }))

import { log } from './logger.mjs'
import {
  checkScaleProp,
  formatFileSize,
  getWidthScaleStyle,
  PageTitleManager,
  positionOverlay,
} from './util.mjs'

beforeEach(() => {
  log.mockClear()
})

const SIZES = ['tiny', 'small', 'medium', 'large']

test('checkScaleProp returns a valid value unchanged without logging', () => {
  expect(checkScaleProp('button', 'size', 'small', SIZES, 'medium')).toBe(
    'small',
  )
  expect(log).not.toHaveBeenCalled()
})

test('checkScaleProp falls back and warns once on an invalid value', () => {
  expect(
    checkScaleProp(
      'button',
      'variant',
      'small-icon',
      SIZES,
      'medium',
      'size="small"',
    ),
  ).toBe('medium')
  expect(log).toHaveBeenCalledTimes(1)
  const [source, level, message] = log.mock.calls[0]
  expect(source).toBe('button')
  expect(level).toBe('warn')
  expect(message).toContain('variant')
  expect(message).toContain('small-icon')
  expect(message).toContain('size="small"')
})

test('checkScaleProp warns without a hint when none is given', () => {
  expect(checkScaleProp('input', 'size', 'huge', SIZES, 'medium')).toBe(
    'medium',
  )
  expect(log).toHaveBeenCalledTimes(1)
  expect(log.mock.calls[0][2]).toContain('size="huge"')
})

test('checkScaleProp returns the fallback for undefined without logging', () => {
  expect(checkScaleProp('button', 'size', undefined, SIZES, 'medium')).toBe(
    'medium',
  )
  expect(log).not.toHaveBeenCalled()
})

const THEME = {
  controlWidth: { compact: '80px', normal: '160px', wide: '320px' },
}

test('getWidthScaleStyle maps compact/normal/wide to the controlWidth tokens', () => {
  for (const value of ['compact', 'normal', 'wide']) {
    expect(getWidthScaleStyle('input', value, { theme: THEME })).toEqual({
      width: THEME.controlWidth[value],
    })
  }
  expect(log).not.toHaveBeenCalled()
})

test('getWidthScaleStyle maps full to 100% width plus flex-grow', () => {
  expect(getWidthScaleStyle('input', 'full', { theme: THEME })).toEqual({
    width: '100%',
    flex: '1 0 0',
  })
})

test('getWidthScaleStyle returns no width for auto when auto is allowed', () => {
  expect(
    getWidthScaleStyle('button', 'auto', { allowAuto: true, theme: THEME }),
  ).toEqual({})
  expect(log).not.toHaveBeenCalled()
})

test('getWidthScaleStyle warns once and falls back when auto is not allowed', () => {
  expect(
    getWidthScaleStyle('input', 'auto', {
      allowAuto: false,
      fallback: 'wide',
      theme: THEME,
    }),
  ).toEqual({ width: '320px' })
  expect(log).toHaveBeenCalledTimes(1)
  const [source, level, message] = log.mock.calls[0]
  expect(source).toBe('input')
  expect(level).toBe('warn')
  expect(message).toContain('widthScale="auto"')
})

test('getWidthScaleStyle warns once and falls back on an unknown value', () => {
  expect(
    getWidthScaleStyle('input', 'narrow', { fallback: 'full', theme: THEME }),
  ).toEqual({ width: '100%', flex: '1 0 0' })
  expect(log).toHaveBeenCalledTimes(1)
  expect(log.mock.calls[0][0]).toBe('input')
  expect(log.mock.calls[0][1]).toBe('warn')
  expect(log.mock.calls[0][2]).toContain('widthScale="narrow"')
})

test('getWidthScaleStyle returns the fallback silently for undefined', () => {
  expect(
    getWidthScaleStyle('input', undefined, {
      fallback: 'compact',
      theme: THEME,
    }),
  ).toEqual({ width: '80px' })
  expect(log).not.toHaveBeenCalled()
})

test('formatFileSize renders 0 bytes as "0b"', () => {
  expect(formatFileSize(0)).toBe('0b')
})

test('formatFileSize renders a sub-1KB value as whole bytes', () => {
  expect(formatFileSize(512)).toBe('512b')
})

test('formatFileSize renders exactly 1MB as "1mb"', () => {
  expect(formatFileSize(1024 * 1024)).toBe('1mb')
})

test('formatFileSize renders a fractional-MB value with one decimal', () => {
  expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5mb')
})

test('formatFileSize renders kb and gb suffixes', () => {
  expect(formatFileSize(840 * 1024)).toBe('840kb')
  expect(formatFileSize(1024 * 1024 * 1024 * 1.4)).toBe('1.4gb')
})

const VIEWPORT = { width: 1000, height: 800 }
const SIZE = { width: 200, height: 100 }
const MARGIN = 8
const PLACEMENT = {
  horizontal: 'right',
  vertical: 'below',
  offsetX: 12,
  offsetY: 16,
}

test('positionOverlay keeps the preferred placement when it fits', () => {
  expect(
    positionOverlay({
      anchor: { x: 400, y: 300 },
      size: SIZE,
      viewport: VIEWPORT,
      margin: MARGIN,
      placement: PLACEMENT,
    }),
  ).toEqual({ left: 412, top: 316 })
})

test('positionOverlay flips horizontally near the right edge', () => {
  const anchor = { x: 960, y: 300 }
  const { left, top } = positionOverlay({
    anchor,
    size: SIZE,
    viewport: VIEWPORT,
    margin: MARGIN,
    placement: PLACEMENT,
  })
  expect(left).toBe(748)
  expect(left + SIZE.width).toBeLessThanOrEqual(anchor.x)
  expect(top).toBe(316)
})

test('positionOverlay flips a "below" overlay above a bottom-edge anchor', () => {
  const anchor = { x: 400, y: 780 }
  const { left, top } = positionOverlay({
    anchor,
    size: SIZE,
    viewport: VIEWPORT,
    margin: MARGIN,
    placement: PLACEMENT,
  })
  expect(left).toBe(412)
  expect(top).toBe(664)
  expect(top + SIZE.height).toBeLessThanOrEqual(anchor.y)
})

test('positionOverlay flips an "above" overlay below a top-edge anchor', () => {
  const anchor = { x: 400, y: 10 }
  const { left, top } = positionOverlay({
    anchor,
    size: SIZE,
    viewport: VIEWPORT,
    margin: MARGIN,
    placement: { ...PLACEMENT, vertical: 'above' },
  })
  expect(left).toBe(412)
  expect(top).toBe(26)
  expect(top).toBeGreaterThanOrEqual(anchor.y)
})

test('positionOverlay flips both axes for a bottom-right anchor', () => {
  expect(
    positionOverlay({
      anchor: { x: 960, y: 780 },
      size: SIZE,
      viewport: VIEWPORT,
      margin: MARGIN,
      placement: PLACEMENT,
    }),
  ).toEqual({ left: 748, top: 664 })
})

test('positionOverlay clamps to the margin when the overlay is wider than the viewport', () => {
  const { left } = positionOverlay({
    anchor: { x: 100, y: 300 },
    size: { width: 300, height: 100 },
    viewport: { width: 200, height: 800 },
    margin: MARGIN,
    placement: PLACEMENT,
  })
  expect(left).toBe(MARGIN)
})

test('PageTitleManager.setDefaultTitle with no prefix sets the bare title', () => {
  const m = new PageTitleManager('AnyTale')
  m.setDefaultTitle('Mine')
  expect(document.title).toBe('Mine')
  expect(m.getTitle()).toBe('Mine')
})

test('PageTitleManager.setDefaultTitle keeps the current prefix', () => {
  const m = new PageTitleManager('AnyTale')
  m.update('(1m 20s)')
  expect(document.title).toBe('(1m 20s) - AnyTale')
  m.setDefaultTitle('Mine')
  expect(document.title).toBe('(1m 20s) - Mine')
  m.reset()
  expect(document.title).toBe('Mine')
  expect(m.prefix).toBe(null)
})
