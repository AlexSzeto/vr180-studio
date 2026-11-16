import { log } from './logger.mjs'
/**
 * Global Audio Player State Manager
 *
 * Manages multiple independent audio channels. Channel 0 is the legacy voice
 * channel; channel 1 is reserved for SFX. Additional channels can be added
 * without any code changes — they are created lazily on first use.
 *
 * All public methods accept an optional `channel` parameter (default 0) so
 * existing call sites require no changes.
 */

class GlobalAudioPlayer {
  constructor() {
    // Sparse array of channel slots; each slot is created lazily by _getChannel().
    // Slot shape: { audioElement, currentAudioUrl, currentInstanceId, _regionEndHandler }
    this._channels = []
    this.listeners = new Set()
  }

  /**
   * Return the channel slot at `idx`, creating it lazily if needed.
   * @param {number} idx
   * @returns {{ audioElement: HTMLAudioElement, currentAudioUrl: string|null, currentInstanceId: any, _regionEndHandler: Function|null }}
   */
  _getChannel(idx) {
    if (!this._channels[idx]) {
      const audioElement = document.createElement('audio')
      audioElement.addEventListener('play', () => this.notifyListeners())
      audioElement.addEventListener('pause', () => this.notifyListeners())
      audioElement.addEventListener('ended', () => this.notifyListeners())
      audioElement.addEventListener('loadedmetadata', () =>
        this.notifyListeners(),
      )
      this._channels[idx] = {
        audioElement,
        currentAudioUrl: null,
        currentInstanceId: null,
        _regionEndHandler: null,
      }
    }
    return this._channels[idx]
  }

  _clearRegionEnd(ch) {
    if (ch._regionEndHandler) {
      ch.audioElement.removeEventListener('timeupdate', ch._regionEndHandler)
      ch._regionEndHandler = null
    }
  }

  _setupRegionEnd(ch, endTime, loopStart = null) {
    ch._regionEndHandler = () => {
      if (ch.audioElement.currentTime >= endTime) {
        // A looping region wraps to its start rather than stopping; the
        // handler stays attached so every pass wraps again.
        if (loopStart != null) {
          ch.audioElement.currentTime = loopStart
          return
        }
        ch.audioElement.pause()
        this._clearRegionEnd(ch)
        this.notifyListeners()
      }
    }
    ch.audioElement.addEventListener('timeupdate', ch._regionEndHandler)
  }

  /**
   * Play audio from a URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {any} [instanceId] - Unique ID of the calling AudioPlayer instance
   * @param {number} [channel=0] - Audio channel index
   * @param {{ loop?: boolean, volume?: number }} [options] - `loop` repeats the
   *   clip (or the region) until stopped; `volume` is 0–1. Both apply to this
   *   call only: a call that omits them resets the channel to no loop, full volume.
   */
  play(audioUrl, region = null, instanceId = null, channel = 0, options = {}) {
    const ch = this._getChannel(channel)
    this._clearRegionEnd(ch)
    const loop = !!options?.loop
    ch.audioElement.loop = loop
    ch.audioElement.volume = Math.max(0, Math.min(1, options?.volume ?? 1))

    const sameUrl = ch.currentAudioUrl === audioUrl

    if (sameUrl && region) {
      // Re-play same URL from the region start point
      const startTime = region.start ?? 0
      ch.currentInstanceId = instanceId
      if (ch.audioElement.readyState >= 2) {
        ch.audioElement.currentTime = startTime
        if (ch.audioElement.paused) ch.audioElement.play()
      } else {
        ch.audioElement.addEventListener(
          'canplay',
          () => {
            if (ch.currentAudioUrl !== audioUrl) return // guard against stale call
            ch.audioElement.currentTime = startTime
            ch.audioElement.play()
          },
          { once: true },
        )
      }
    } else if (sameUrl) {
      // Resume plain playback of the same URL
      ch.currentInstanceId = instanceId
      if (ch.audioElement.paused) {
        ch.audioElement.play()
      }
    } else {
      // New URL — stop current channel and load the new one
      this.stop(channel)
      ch.currentAudioUrl = audioUrl
      ch.currentInstanceId = instanceId
      ch.audioElement.src = audioUrl

      if (region && region.start != null) {
        const startTime = region.start
        ch.audioElement.addEventListener(
          'canplay',
          () => {
            if (ch.currentAudioUrl !== audioUrl) return // guard against stale call
            ch.audioElement.currentTime = startTime
            ch.audioElement.play()
          },
          { once: true },
        )
      } else {
        ch.audioElement.play()
      }
    }

    if (region && region.end != null) {
      this._setupRegionEnd(ch, region.end, loop ? (region.start ?? 0) : null)
    }

    this.notifyListeners()
  }

  /**
   * Stop the currently playing audio on the given channel.
   * @param {number} [channel=0] - Audio channel index
   */
  stop(channel = 0) {
    if (!this._channels[channel]) return // channel was never used — nothing to stop
    const ch = this._channels[channel]
    this._clearRegionEnd(ch)

    if (!ch.audioElement.paused) {
      ch.audioElement.pause()
    }
    ch.audioElement.currentTime = 0
    ch.currentAudioUrl = null
    ch.currentInstanceId = null
    this.notifyListeners()
  }

  /**
   * Toggle play/pause for a given audio URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {any} [instanceId] - Unique ID of the calling AudioPlayer instance
   * @param {number} [channel=0] - Audio channel index
   * @param {{ loop?: boolean, volume?: number }} [options] - passed to `play()`
   */
  toggle(
    audioUrl,
    region = null,
    instanceId = null,
    channel = 0,
    options = {},
  ) {
    const ch = this._getChannel(channel)

    if (
      ch.currentInstanceId === instanceId &&
      ch.currentAudioUrl === audioUrl &&
      !ch.audioElement.paused
    ) {
      // This exact instance is already playing — stop it
      this.stop(channel)
    } else {
      // A different instance (or stopped) — start playback for this instance
      this.play(audioUrl, region, instanceId, channel, options)
    }
  }

  /**
   * Check if a specific AudioPlayer instance is currently playing.
   * @param {string} audioUrl
   * @param {any} [instanceId]
   * @param {number} [channel=0] - Audio channel index
   */
  isPlaying(audioUrl, instanceId = null, channel = 0) {
    if (!this._channels[channel]) return false
    const ch = this._channels[channel]
    return (
      ch.currentAudioUrl === audioUrl &&
      ch.currentInstanceId === instanceId &&
      !ch.audioElement.paused
    )
  }

  /**
   * Return the current state of a channel for external consumers (e.g. AudioPlayer).
   * Safe to call even if the channel has never been used — returns nulls in that case.
   * @param {number} [channel=0]
   * @returns {{ audioElement: HTMLAudioElement|null, currentAudioUrl: string|null, currentInstanceId: any }}
   */
  getChannelState(channel = 0) {
    const ch = this._channels[channel]
    if (!ch)
      return {
        audioElement: null,
        currentAudioUrl: null,
        currentInstanceId: null,
      }
    return {
      audioElement: ch.audioElement,
      currentAudioUrl: ch.currentAudioUrl,
      currentInstanceId: ch.currentInstanceId,
    }
  }

  /**
   * Subscribe to player state changes (shared across all channels).
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of state change.
   */
  notifyListeners() {
    this.listeners.forEach((callback) => callback())
  }
}

// Export singleton instance
export const globalAudioPlayer = new GlobalAudioPlayer()

// ============================================================================
// GlobalBgmPlayer — Looping background music player with crossfade support.
//
// Uses two HTMLAudioElement slots (A/B) connected through Web Audio gain nodes
// so that CORS is never an issue for URL playback (audio elements play any URL)
// while still allowing smooth gain-ramp transitions.
//
// Playlist items are either plain URL strings or { url, startTime?, duration? }
// objects.  When startTime is set the audio element seeks to that position before
// playback begins; when duration is set the advance timer fires after that many
// seconds instead of waiting for audio end.
//
// With repeat on (setRepeat(true)) the playlist starts over from its first
// item when the last one ends, crossfading as at any other advance, so a
// one-item playlist crossfades into itself as a seamless loop.
//
// Three players coexist independently: globalAudioPlayer (voice, SFX and
// cues, by channel), globalBgmPlayer (BGM) and globalAmbiencePlayer (Play's
// looping spot ambience). None stops another.
// ============================================================================

class GlobalBgmPlayer {
  constructor() {
    this._context = null
    // Set by unlock(): playback was primed inside a user gesture.
    this._primed = false
    // Two playback slots for crossfade (slot A = 0, slot B = 1)
    this._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ]
    this._activeSlot = 0
    this._playlist = [] // normalised { url, startTime, duration|null }
    this._currentIndex = -1
    this._currentDuration = 0 // effective duration of current segment
    this._transition = { mode: 'crossfade', durationSeconds: 2 }
    this._listeners = new Set()
    this._isPlaying = false
    this._advanceTimer = null
    this._playId = 0
    this._targetGain = 1.0
    this._stopFadeId = 0
    this._repeat = false
  }

  _getContext() {
    if (!this._context) {
      this._context = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this._context.state === 'suspended') this._context.resume()
    return this._context
  }

  /**
   * Prime playback from inside a user gesture: resume the AudioContext and
   * play-then-pause both (silent, gain 0) slot elements. Mobile browsers —
   * iOS Safari above all — refuse a later programmatic `play()` unless the
   * context and the elements were first touched within a gesture, and music
   * often starts from an effect that runs after the gesture has ended.
   * Repeat calls are no-ops; a failure is logged and never thrown.
   */
  unlock() {
    if (this._primed) return
    this._primed = true
    try {
      this._initSlots()
      for (const { audio } of this._slots) {
        // An element with no source rejects, and the immediate pause aborts
        // the rest; touching it inside the gesture is what counts.
        Promise.resolve(audio.play()).catch(() => {})
        audio.pause()
      }
    } catch (e) {
      log('audio-player', 'warn', `Audio unlock failed: ${e}`)
    }
  }

  _initSlots() {
    const ctx = this._getContext()
    for (let i = 0; i < 2; i++) {
      if (this._slots[i].audio) continue
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(ctx.destination)
      this._slots[i] = { audio, source, gain }
    }
  }

  _normalise(item) {
    if (typeof item === 'string')
      return {
        url: item,
        startTime: 0,
        duration: null,
        label: null,
        kind: null,
      }
    return {
      url: item.url,
      startTime: item.startTime ?? 0,
      duration: item.duration ?? null,
      label: item.label ?? null,
      kind: item.kind ?? null,
    }
  }

  /**
   * Set the playlist. Each item is a URL string or `{ url, startTime?, duration?, label?, kind? }` (`kind` is an opaque tag passed through to `getCurrentTrack()` and `track-start`).
   * @param {(string|{ url:string, startTime?:number, duration?:number, label?:string })[]} items
   */
  setPlaylist(items) {
    this._playlist = items.map((i) => this._normalise(i))
  }

  /**
   * Configure the transition between tracks.
   * @param {{ mode: 'crossfade'|'fade', durationSeconds: number }} config
   */
  setTransition(config) {
    this._transition = { ...this._transition, ...config }
  }

  /**
   * Repeat the playlist: when the last item ends (or reaches its crossfade
   * window) playback starts again at the first item instead of stopping.
   * @param {boolean} value
   */
  setRepeat(value) {
    this._repeat = !!value
  }

  /**
   * Set the master gain for BGM playback, ramped over `seconds` if playing.
   * While stopped the value is stored, and the next track fades in to it.
   * @param {number} value - 0 (silent) to 1 (full volume)
   * @param {number} [seconds=0.2] - Ramp length
   */
  setGain(value, seconds = 0.2) {
    this._targetGain = Math.max(0, Math.min(1, value))
    const rampSeconds = Math.max(0, seconds)
    if (!this._isPlaying || !this._context) return
    const ctx = this._context
    const now = ctx.currentTime
    const { gain } = this._slots[this._activeSlot]
    if (!gain) return
    try {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(this._targetGain, now + rampSeconds)
    } catch (e) {}
  }

  /** Start playback from the first track. No-op if already playing or playlist is empty. */
  async play() {
    this._stopFadeId++ // cancel any in-flight fade-out from stop()
    if (this._playlist.length === 0 || this._isPlaying) return
    this._isPlaying = true
    this._initSlots()
    await this._playTrackAt(0)
  }

  /**
   * Append a track to the end of the queue. Starts playback immediately if not already playing.
   * @param {string|{ url:string, startTime?:number, duration?:number, label?:string }} item
   */
  async appendToPlaylist(item) {
    this._playlist.push(this._normalise(item))
    if (!this._isPlaying) {
      this._isPlaying = true
      this._initSlots()
      await this._playTrackAt(0)
    } else {
      this._notifyListeners({
        event: 'playlist-updated',
        total: this._playlist.length,
      })
    }
  }

  /**
   * Skip the currently playing track and immediately crossfade/fade into the next.
   * Stops playback if the queue has no next track.
   */
  skipCurrent() {
    if (!this._isPlaying || this._playlist.length === 0) return
    if (this._advanceTimer !== null) {
      clearTimeout(this._advanceTimer)
      this._advanceTimer = null
    }
    this._playId++
    this._consumeAndAdvance()
  }

  /**
   * Move the playhead within the current segment and re-arm the next-track
   * timer from the time left. Seeking into the final crossfade window leaves no
   * time, so the next track starts at once, like a skip. No-op when stopped or
   * when the segment length is unknown (advance then relies on `ended`).
   * @param {number} fraction 0–1 position within the current segment
   */
  seek(fraction) {
    const duration = this.getDuration()
    const audio = this.getCurrentAudioElement()
    if (!audio || duration <= 0) return
    const clamped = Math.min(1, Math.max(0, fraction))
    const item = this._playlist[this._currentIndex]
    audio.currentTime = (item?.startTime ?? 0) + clamped * duration
    this._scheduleAdvance(this._playId, duration * (1 - clamped))
  }

  /** Stop playback and reset the playlist, fading out smoothly if audio is active. */
  stop() {
    this._playId++
    this._stopFadeId++
    const capturedStopFadeId = this._stopFadeId

    if (this._advanceTimer !== null) {
      clearTimeout(this._advanceTimer)
      this._advanceTimer = null
    }

    const ctx = this._context
    if (ctx && this._isPlaying) {
      const now = ctx.currentTime
      const fadeDuration = Math.min(this._transition.durationSeconds, 1.5)
      for (const { gain } of this._slots) {
        if (gain) {
          try {
            gain.gain.cancelScheduledValues(now)
            gain.gain.setValueAtTime(gain.gain.value, now)
            gain.gain.linearRampToValueAtTime(0, now + fadeDuration)
          } catch (e) {}
        }
      }
      setTimeout(
        () => {
          if (this._stopFadeId !== capturedStopFadeId) return
          for (const { audio } of this._slots) {
            if (audio) {
              try {
                audio.pause()
              } catch (e) {}
            }
          }
        },
        fadeDuration * 1000 + 50,
      )
    } else {
      for (const { audio } of this._slots) {
        if (audio) {
          try {
            audio.pause()
          } catch (e) {}
        }
      }
    }

    this._isPlaying = false
    this._playlist = []
    this._currentIndex = -1
    this._currentDuration = 0
    this._notifyListeners({ event: 'stop' })
  }

  /** @returns {boolean} */
  isPlaying() {
    return this._isPlaying
  }

  /**
   * @returns {{ url:string, label:string, kind:string|null, index:number, total:number }|null}
   */
  getCurrentTrack() {
    if (!this._isPlaying || this._currentIndex < 0) return null
    const item = this._playlist[this._currentIndex]
    return {
      url: item.url,
      label: item.label || this._urlToLabel(item.url),
      kind: item.kind ?? null,
      index: this._currentIndex,
      total: this._playlist.length,
    }
  }

  /**
   * The HTMLAudioElement that is currently playing (null when stopped).
   * Attach a `timeupdate` listener to this to build a live progress bar.
   * @returns {HTMLAudioElement|null}
   */
  getCurrentAudioElement() {
    return this._isPlaying ? this._slots[this._activeSlot].audio : null
  }

  /**
   * Elapsed seconds within the current segment (accounts for startTime offset).
   * @returns {number}
   */
  getCurrentTime() {
    const audio = this.getCurrentAudioElement()
    if (!audio) return 0
    const item = this._playlist[this._currentIndex]
    return Math.max(0, audio.currentTime - (item?.startTime ?? 0))
  }

  /**
   * Duration of the current segment in seconds (from playlist item or audio.duration).
   * @returns {number}
   */
  getDuration() {
    return this._currentDuration
  }

  /** @returns {number} 0–1 */
  getProgress() {
    const d = this.getDuration()
    return d > 0 ? Math.min(1, Math.max(0, this.getCurrentTime() / d)) : 0
  }

  /**
   * Subscribe to player events.
   * Callback receives `{ event: 'track-start'|'stop', url?, label?, index?, total? }`.
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this._listeners.add(callback)
    return () => this._listeners.delete(callback)
  }

  _notifyListeners(data) {
    this._listeners.forEach((cb) => cb(data))
  }

  _urlToLabel(url) {
    if (!url) return ''
    return decodeURIComponent(
      url
        .split('/')
        .pop()
        .replace(/\.[^.]+$/, ''),
    )
  }

  _consumeAndAdvance() {
    const finished = this._playlist.splice(0, 1)
    // Repeat re-queues the finished item at the back, so once the last item
    // finishes the playlist is back at its first one.
    if (this._repeat) this._playlist.push(...finished)
    if (this._playlist.length > 0) {
      this._playTrackAt(0)
    } else {
      const ctx = this._context
      const now = ctx ? ctx.currentTime : 0
      for (const { audio, gain } of this._slots) {
        if (audio) {
          try {
            audio.pause()
          } catch (e) {}
        }
        if (gain && ctx) {
          try {
            gain.gain.setValueAtTime(0, now)
          } catch (e) {}
        }
      }
      this._isPlaying = false
      this._currentIndex = -1
      this._currentDuration = 0
      this._notifyListeners({ event: 'stop' })
    }
  }

  /**
   * (Re)arm the timer that moves on to the next track, `remainingSeconds` of
   * track left to play. Crossfade mode fires one fade length early so the next
   * track fades in as this one ends.
   * @param {number} playId
   * @param {number} remainingSeconds
   */
  _scheduleAdvance(playId, remainingSeconds) {
    if (this._advanceTimer !== null) clearTimeout(this._advanceTimer)
    const fadeDuration = Math.max(0, this._transition.durationSeconds)
    const advanceAfterMs =
      this._transition.mode === 'crossfade'
        ? Math.max(0, (remainingSeconds - fadeDuration) * 1000)
        : Math.max(0, remainingSeconds * 1000)

    this._advanceTimer = setTimeout(() => {
      this._advanceTimer = null
      if (this._playId !== playId) return
      this._consumeAndAdvance()
    }, advanceAfterMs)
  }

  async _playTrackAt(index) {
    if (index < 0 || index >= this._playlist.length) {
      this.stop()
      return
    }

    const playId = this._playId
    const item = this._playlist[index]
    const ctx = this._getContext()
    const fadeDuration = Math.max(0, this._transition.durationSeconds)
    const now = ctx.currentTime

    // Alternate slots: first track → slot 0; each advance → the other slot
    const slot = this._currentIndex === -1 ? 0 : 1 - this._activeSlot
    const prevSlot = this._activeSlot
    const { audio, gain } = this._slots[slot]
    const prevGain = this._slots[prevSlot].gain
    const prevAudio = this._slots[prevSlot].audio

    // Load and seek the new slot
    audio.src = item.url
    audio.currentTime = item.startTime ?? 0

    // Fade in new slot
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(this._targetGain, now + fadeDuration)

    // Fade out previous slot (if a track was playing)
    if (this._currentIndex >= 0) {
      prevGain.gain.setValueAtTime(prevGain.gain.value, now)
      prevGain.gain.linearRampToValueAtTime(0, now + fadeDuration)
      const capturedPrevAudio = prevAudio
      setTimeout(
        () => {
          try {
            capturedPrevAudio.pause()
          } catch (e) {}
        },
        (fadeDuration + 0.05) * 1000,
      )
    }

    this._activeSlot = slot
    this._currentIndex = index

    try {
      await audio.play()
    } catch (e) {
      if (this._playId === playId) {
        log('audio-player', 'error', `Failed to play: ${item.url} ${e}`)
        this.stop()
      }
      return
    }

    if (this._playId !== playId) return

    // Determine effective duration: prefer explicit segment duration, fall back to audio.duration
    const effectiveDuration =
      item.duration !== null
        ? item.duration
        : isFinite(audio.duration)
          ? audio.duration
          : 0
    this._currentDuration = effectiveDuration

    this._notifyListeners({
      event: 'track-start',
      url: item.url,
      label: item.label || this._urlToLabel(item.url),
      kind: item.kind ?? null,
      index,
      total: this._playlist.length,
    })

    // Schedule advance
    if (effectiveDuration > 0) {
      this._scheduleAdvance(playId, effectiveDuration)
    } else {
      if (this._advanceTimer !== null) clearTimeout(this._advanceTimer)
      // Duration unknown yet — fall back to audio ended event
      const capturedPlayId = playId
      audio.addEventListener(
        'ended',
        () => {
          if (this._playId !== capturedPlayId || this._activeSlot !== slot)
            return
          this._consumeAndAdvance()
        },
        { once: true },
      )
    }
  }
}

export const globalBgmPlayer = new GlobalBgmPlayer()

/** A second, independent instance for Play's looping spot ambience. */
export const globalAmbiencePlayer = new GlobalBgmPlayer()
