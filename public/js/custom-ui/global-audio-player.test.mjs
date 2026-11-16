import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockGainNode() {
  return {
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeMockAudioContext() {
  return {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn().mockImplementation(makeMockGainNode),
    createMediaElementSource: vi
      .fn()
      .mockImplementation(() => ({ connect: vi.fn() })),
  }
}

// Mock Audio constructor — each instance gets its own spy methods
function MockAudio() {
  this.src = ''
  this.currentTime = 0
  this.duration = 30
  this.crossOrigin = null
  this.preload = 'auto'
  this.play = vi.fn().mockResolvedValue(undefined)
  this.pause = vi.fn()
  this.addEventListener = vi.fn()
  this.removeEventListener = vi.fn()
}

// ── globalBgmPlayer tests ────────────────────────────────────────────────────

import {
  globalBgmPlayer,
  globalAmbiencePlayer,
  globalAudioPlayer,
} from './global-audio-player.mjs'

describe('globalBgmPlayer', () => {
  let mockCtx

  beforeEach(() => {
    vi.useFakeTimers()

    mockCtx = makeMockAudioContext()
    window.AudioContext = function MockAudioContext() {
      return mockCtx
    }
    window.Audio = MockAudio

    // Reset singleton state
    globalBgmPlayer.stop()
    globalBgmPlayer._context = null
    globalBgmPlayer._primed = false
    globalBgmPlayer._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ]
    globalBgmPlayer._activeSlot = 0
    globalBgmPlayer._playId = 0
  })

  afterEach(() => {
    globalBgmPlayer.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('unlock() resumes a suspended context and touches both slots, once', () => {
    mockCtx.state = 'suspended'
    globalBgmPlayer.unlock()
    expect(mockCtx.resume).toHaveBeenCalled()
    for (const { audio } of globalBgmPlayer._slots) {
      expect(audio.play).toHaveBeenCalledTimes(1)
      expect(audio.pause).toHaveBeenCalledTimes(1)
    }
    expect(() => globalBgmPlayer.unlock()).not.toThrow()
    for (const { audio } of globalBgmPlayer._slots)
      expect(audio.play).toHaveBeenCalledTimes(1)
  })

  test('play() emits track-start with correct metadata', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))

    globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
    await globalBgmPlayer.play()

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      event: 'track-start',
      url: '/audio/track1.mp3',
      label: 'track1',
      index: 0,
      total: 1,
    })
    expect(globalBgmPlayer.isPlaying()).toBe(true)
    unsub()
  })

  test('a kind tag passes through track-start and getCurrentTrack; untagged items carry null', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))

    globalBgmPlayer.setPlaylist([{ url: '/audio/t.mp3', kind: 'title' }])
    await globalBgmPlayer.play()
    expect(events[0]).toMatchObject({ event: 'track-start', kind: 'title' })
    expect(globalBgmPlayer.getCurrentTrack().kind).toBe('title')
    unsub()

    globalBgmPlayer.stop()
    globalBgmPlayer.setPlaylist(['/audio/a.mp3'])
    await globalBgmPlayer.play()
    expect(globalBgmPlayer.getCurrentTrack().kind).toBe(null)
  })

  test('getCurrentTrack returns current track info', async () => {
    globalBgmPlayer.setPlaylist(['/audio/a.mp3', '/audio/b.mp3'])
    await globalBgmPlayer.play()

    const track = globalBgmPlayer.getCurrentTrack()
    expect(track).toMatchObject({
      url: '/audio/a.mp3',
      label: 'a',
      index: 0,
      total: 2,
    })
  })

  test('getCurrentAudioElement returns the active audio element', async () => {
    globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
    await globalBgmPlayer.play()

    const el = globalBgmPlayer.getCurrentAudioElement()
    expect(el).not.toBeNull()
    expect(el instanceof MockAudio).toBe(true)
  })

  test('getCurrentTime accounts for segment startTime offset', async () => {
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 60, duration: 20 },
    ])
    await globalBgmPlayer.play()

    const audio = globalBgmPlayer.getCurrentAudioElement()
    audio.currentTime = 65 // 5 seconds into the segment
    expect(globalBgmPlayer.getCurrentTime()).toBeCloseTo(5, 1)
  })

  test('getDuration returns segment duration when specified', async () => {
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 0, duration: 20 },
    ])
    await globalBgmPlayer.play()

    expect(globalBgmPlayer.getDuration()).toBe(20)
  })

  describe('seek', () => {
    const twoTracks = (startTime = 0) => [
      { url: '/audio/track1.mp3', startTime, duration: 10 },
      { url: '/audio/track2.mp3', startTime: 0, duration: 10 },
    ]
    const trackStarts = (events) =>
      events.filter((e) => e.event === 'track-start').length

    test('moves the playhead to the fraction, offset by the segment startTime', async () => {
      globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
      globalBgmPlayer.setPlaylist(twoTracks(60))
      await globalBgmPlayer.play()

      globalBgmPlayer.seek(0.5)

      expect(globalBgmPlayer.getCurrentAudioElement().currentTime).toBe(65)
    })

    test('a forward seek brings the next track in sooner', async () => {
      const events = []
      globalBgmPlayer.subscribe((e) => events.push(e))
      globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
      globalBgmPlayer.setPlaylist(twoTracks())
      await globalBgmPlayer.play()

      globalBgmPlayer.seek(0.8) // 2s left
      await vi.advanceTimersByTimeAsync(1900)
      expect(trackStarts(events)).toBe(1)
      await vi.advanceTimersByTimeAsync(200)
      expect(trackStarts(events)).toBe(2)
    })

    test('a backward seek pushes the next track later', async () => {
      const events = []
      globalBgmPlayer.subscribe((e) => events.push(e))
      globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
      globalBgmPlayer.setPlaylist(twoTracks())
      await globalBgmPlayer.play()

      await vi.advanceTimersByTimeAsync(8000)
      globalBgmPlayer.seek(0) // full 10s left again
      await vi.advanceTimersByTimeAsync(5000)
      expect(trackStarts(events)).toBe(1)
      await vi.advanceTimersByTimeAsync(5100)
      expect(trackStarts(events)).toBe(2)
    })

    test('seeking into the final crossfade window starts the next track at once', async () => {
      const events = []
      globalBgmPlayer.subscribe((e) => events.push(e))
      globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 3 })
      globalBgmPlayer.setPlaylist(twoTracks())
      await globalBgmPlayer.play()

      globalBgmPlayer.seek(0.95) // 0.5s left, inside the 3s window
      await vi.advanceTimersByTimeAsync(0)

      expect(trackStarts(events)).toBe(2)
    })

    test('does nothing while stopped', () => {
      expect(() => globalBgmPlayer.seek(0.5)).not.toThrow()
      expect(globalBgmPlayer.getCurrentAudioElement()).toBeNull()
    })

    test('does nothing when the segment length is unknown', async () => {
      globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
      await globalBgmPlayer.play()
      const audio = globalBgmPlayer.getCurrentAudioElement()
      audio.duration = NaN
      globalBgmPlayer._currentDuration = 0
      audio.currentTime = 4

      globalBgmPlayer.seek(0.5)

      expect(audio.currentTime).toBe(4)
    })
  })

  test('advances to next track after segment duration elapses (fade mode)', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))

    globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 0, duration: 10 },
      { url: '/audio/track2.mp3', startTime: 0, duration: 10 },
    ])
    await globalBgmPlayer.play()

    await vi.advanceTimersByTimeAsync(10_000)

    const starts = events.filter((e) => e.event === 'track-start')
    expect(starts.length).toBeGreaterThanOrEqual(2)
    expect(starts[0].url).toBe('/audio/track1.mp3')
    expect(starts[1].url).toBe('/audio/track2.mp3')
    unsub()
  })

  test('stop() resets playlist and emits stop event', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))

    globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
    await globalBgmPlayer.play()
    globalBgmPlayer.stop()

    expect(globalBgmPlayer.isPlaying()).toBe(false)
    expect(globalBgmPlayer.getCurrentTrack()).toBeNull()
    expect(globalBgmPlayer.getCurrentAudioElement()).toBeNull()
    expect(events.some((e) => e.event === 'stop')).toBe(true)

    await globalBgmPlayer.play() // playlist cleared by stop — no-op
    expect(globalBgmPlayer.isPlaying()).toBe(false)
    unsub()
  })

  test('stop() prevents pending advance timer from triggering', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))

    globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 0, duration: 10 },
      { url: '/audio/track2.mp3', startTime: 0, duration: 10 },
    ])
    await globalBgmPlayer.play()
    globalBgmPlayer.stop()

    await vi.advanceTimersByTimeAsync(15_000)

    const starts = events.filter((e) => e.event === 'track-start')
    expect(starts).toHaveLength(1) // only track1 before stop
    unsub()
  })

  test('voice and BGM channels coexist — stopping BGM does not affect voice state', async () => {
    globalBgmPlayer.setPlaylist(['/audio/bgm.mp3'])
    await globalBgmPlayer.play()
    expect(globalBgmPlayer.isPlaying()).toBe(true)

    const voiceBefore = globalAudioPlayer.isPlaying('voice.mp3')
    globalBgmPlayer.stop()

    expect(globalAudioPlayer.isPlaying('voice.mp3')).toBe(voiceBefore)
    expect(globalBgmPlayer.isPlaying()).toBe(false)
  })

  test('play() is a no-op when already playing', async () => {
    globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
    await globalBgmPlayer.play()
    const idBefore = globalBgmPlayer._playId

    await globalBgmPlayer.play()
    expect(globalBgmPlayer._playId).toBe(idBefore)
  })

  describe('setGain', () => {
    async function startPlaying() {
      globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
      await globalBgmPlayer.play()
      mockCtx.currentTime = 5
      const { gain } = globalBgmPlayer._slots[globalBgmPlayer._activeSlot]
      gain.gain.linearRampToValueAtTime.mockClear()
      return gain.gain
    }

    afterEach(() => {
      globalBgmPlayer._targetGain = 1.0
    })

    test('ramps the active slot over the given seconds', async () => {
      const gain = await startPlaying()
      globalBgmPlayer.setGain(0.5, 1)
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 6)
    })

    test('defaults to a 0.2 s ramp', async () => {
      const gain = await startPlaying()
      globalBgmPlayer.setGain(0.5)
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 5.2)
    })

    test('clamps the value to 1', async () => {
      const gain = await startPlaying()
      globalBgmPlayer.setGain(2, 1)
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 6)
    })

    test('while stopped, stores the level and the next track fades in to it', async () => {
      globalBgmPlayer.setGain(0.3)
      expect(mockCtx.createGain).not.toHaveBeenCalled()
      globalBgmPlayer.setPlaylist(['/audio/track1.mp3'])
      await globalBgmPlayer.play()
      const { gain } = globalBgmPlayer._slots[0]
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.3,
        expect.any(Number),
      )
    })
  })
})

describe('globalBgmPlayer repeat', () => {
  let mockCtx

  beforeEach(() => {
    vi.useFakeTimers()
    mockCtx = makeMockAudioContext()
    window.AudioContext = function MockAudioContext() {
      return mockCtx
    }
    window.Audio = MockAudio
    globalBgmPlayer.stop()
    globalBgmPlayer._context = null
    globalBgmPlayer._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ]
    globalBgmPlayer._activeSlot = 0
    globalBgmPlayer._playId = 0
    globalBgmPlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 })
  })

  afterEach(() => {
    globalBgmPlayer.setRepeat(false)
    globalBgmPlayer.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('with repeat on, a one-item playlist starts again in the other slot when its window arrives', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))
    globalBgmPlayer.setRepeat(true)
    globalBgmPlayer.setPlaylist([{ url: '/audio/bed.mp3', duration: 10 }])
    await globalBgmPlayer.play()
    expect(globalBgmPlayer._activeSlot).toBe(0)

    await vi.advanceTimersByTimeAsync(7900)
    expect(events.filter((e) => e.event === 'track-start')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(200) // the 2 s crossfade window opens at 8 s

    const starts = events.filter((e) => e.event === 'track-start')
    expect(starts).toHaveLength(2)
    expect(starts[1].url).toBe('/audio/bed.mp3')
    expect(globalBgmPlayer._activeSlot).toBe(1)
    expect(globalBgmPlayer._slots[1].audio.src).toBe('/audio/bed.mp3')
    expect(globalBgmPlayer._slots[1].audio.play).toHaveBeenCalled()
    expect(globalBgmPlayer.isPlaying()).toBe(true)
    unsub()
  })

  test('with repeat on, the last item of a longer playlist is followed by the first', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))
    globalBgmPlayer.setRepeat(true)
    globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 })
    globalBgmPlayer.setPlaylist([
      { url: '/audio/a.mp3', duration: 10 },
      { url: '/audio/b.mp3', duration: 10 },
    ])
    await globalBgmPlayer.play()
    await vi.advanceTimersByTimeAsync(20_000)

    const urls = events
      .filter((e) => e.event === 'track-start')
      .map((e) => e.url)
    expect(urls.slice(0, 3)).toEqual([
      '/audio/a.mp3',
      '/audio/b.mp3',
      '/audio/a.mp3',
    ])
    unsub()
  })

  test('with repeat off, a one-item playlist stops when its window arrives', async () => {
    const events = []
    const unsub = globalBgmPlayer.subscribe((e) => events.push(e))
    globalBgmPlayer.setPlaylist([{ url: '/audio/bed.mp3', duration: 10 }])
    await globalBgmPlayer.play()
    await vi.advanceTimersByTimeAsync(8100)

    expect(events.filter((e) => e.event === 'track-start')).toHaveLength(1)
    expect(events.some((e) => e.event === 'stop')).toBe(true)
    expect(globalBgmPlayer.isPlaying()).toBe(false)
    unsub()
  })

  test('globalAmbiencePlayer is a separate instance from globalBgmPlayer', () => {
    expect(globalAmbiencePlayer).not.toBe(globalBgmPlayer)
    expect(typeof globalAmbiencePlayer.setRepeat).toBe('function')
  })
})

describe('globalAudioPlayer play options', () => {
  // Distinct channels per test so state from one never leaks into another.
  let channel = 10

  beforeEach(() => {
    channel++
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('loop: true sets the channel element to loop, and a later call without options clears it', () => {
    globalAudioPlayer.play('/a.mp3', null, null, channel, { loop: true })
    const { audioElement } = globalAudioPlayer.getChannelState(channel)
    expect(audioElement.loop).toBe(true)

    globalAudioPlayer.play('/b.mp3', null, null, channel)
    expect(audioElement.loop).toBe(false)
  })

  test('volume sets the element volume, and a later call without options resets it to 1', () => {
    globalAudioPlayer.play('/a.mp3', null, null, channel, { volume: 0.25 })
    const { audioElement } = globalAudioPlayer.getChannelState(channel)
    expect(audioElement.volume).toBe(0.25)

    globalAudioPlayer.play('/b.mp3', null, null, channel)
    expect(audioElement.volume).toBe(1)
  })

  test('a looping region seeks back to its start at the region end and does not pause', () => {
    globalAudioPlayer.play('/a.mp3', { start: 2, end: 5 }, null, channel, {
      loop: true,
    })
    const { audioElement } = globalAudioPlayer.getChannelState(channel)
    const pause = HTMLMediaElement.prototype.pause
    pause.mockClear()

    audioElement.currentTime = 5.1
    audioElement.dispatchEvent(new Event('timeupdate'))

    expect(audioElement.currentTime).toBe(2)
    expect(pause).not.toHaveBeenCalled()
  })

  test('a non-looping region still pauses at its end', () => {
    globalAudioPlayer.play('/a.mp3', { start: 2, end: 5 }, null, channel)
    const { audioElement } = globalAudioPlayer.getChannelState(channel)
    const pause = HTMLMediaElement.prototype.pause
    pause.mockClear()

    audioElement.currentTime = 5.1
    audioElement.dispatchEvent(new Event('timeupdate'))

    expect(pause).toHaveBeenCalled()
  })
})
