import { html } from 'htm/preact'
import { Component } from 'preact'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { Button } from '../io/button.mjs'
import { Panel } from '../layout/panel.mjs'
import { SeekBar } from './seek-bar.mjs'
import { globalAudioPlayer } from '../global-audio-player.mjs'
import { getWidthScaleStyle, resolveWidthScale } from '../util.mjs'

// Monotonically increasing counter used to give each AudioPlayer instance a
// unique identity, so instances sharing the same audioUrl don't interfere.
let _nextInstanceId = 0

// =========================================================================
// Styled Components
// =========================================================================

const PlayerContainer = styled('div')`
  width: ${(props) => props.width || 'auto'};
  ${(props) => (props.flex ? `flex: ${props.flex};` : '')}
`
PlayerContainer.className = 'player-container'

const Controls = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  gap: ${(props) => props.gap};
`
Controls.className = 'controls'

const TimelineWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  gap: ${(props) => props.gap};
`
TimelineWrapper.className = 'timeline-wrapper'

const Time = styled('span')`
  font-family: monospace;
  min-width: 40px;
  text-align: center;
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
`
Time.className = 'time'

// =========================================================================
// AudioTimeline Component (isolated to prevent parent re-renders)
// =========================================================================

/**
 * AudioTimeline Component
 * Displays progress bar and time information for audio playback.
 * Manages its own currentTime state to prevent parent re-renders.
 *
 * @param {Object} props
 * @param {HTMLAudioElement} props.audioElement - Reference to the audio element
 * @param {number} props.duration - Playback duration to display (region duration or full file)
 * @param {number} [props.startOffset=0] - Start offset in seconds (for region-based playback)
 * @param {boolean} [props.compact=false] - When true, hide left label; right shows currentTime while playing, duration otherwise
 * @param {boolean} [props.isPlaying=false] - Whether audio is currently playing
 */
class AudioTimeline extends Component {
  constructor(props) {
    super(props)
    this.state = {
      theme: currentTheme.value,
      currentTime: 0,
    }
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })

    const { audioElement } = this.props
    if (audioElement) {
      audioElement.addEventListener('timeupdate', this.handleTimeUpdate)
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme()
    }

    const { audioElement } = this.props
    if (audioElement) {
      audioElement.removeEventListener('timeupdate', this.handleTimeUpdate)
    }
  }

  componentDidUpdate(prevProps) {
    // Handle audioElement changes (e.g., when audio source changes)
    if (prevProps.audioElement !== this.props.audioElement) {
      if (prevProps.audioElement) {
        prevProps.audioElement.removeEventListener(
          'timeupdate',
          this.handleTimeUpdate,
        )
      }
      if (this.props.audioElement) {
        this.props.audioElement.addEventListener(
          'timeupdate',
          this.handleTimeUpdate,
        )
      }
      // Reset playhead whenever the element reference changes so stale position
      // is never shown for a new (or newly-stopped) audio source.
      this.setState({ currentTime: 0 })
    }
  }

  handleTimeUpdate = () => {
    const { audioElement } = this.props
    if (audioElement) {
      this.setState({ currentTime: audioElement.currentTime })
    }
  }

  handleSeek = (fraction) => {
    const {
      audioElement,
      duration,
      startOffset = 0,
      onSeekRequest,
    } = this.props

    const newTime = startOffset + fraction * duration

    if (audioElement) {
      // Already playing — seek directly on the live audio element.
      audioElement.currentTime = newTime
      this.setState({ currentTime: newTime })
    } else if (onSeekRequest) {
      // Not playing — delegate to the parent to start playback from this position.
      onSeekRequest(newTime)
    }
  }

  formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'

    // Short duration format: if total duration is under 1s, show seconds with 2 decimals
    const { duration } = this.props
    if (duration > 0 && duration < 1) {
      return `${seconds.toFixed(2)}s`
    }

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  render() {
    const {
      duration,
      compact = false,
      isPlaying = false,
      startOffset = 0,
    } = this.props
    const { theme, currentTime } = this.state

    // Time relative to the region start (or 0 if no region)
    const relativeTime = Math.max(0, currentTime - startOffset)
    const progress =
      duration > 0 ? Math.min(100, (relativeTime / duration) * 100) : 0

    // In compact mode: right label shows relativeTime while playing, duration otherwise
    const rightLabelValue = compact
      ? isPlaying
        ? relativeTime
        : duration
      : duration

    return html`
      <${TimelineWrapper} gap=${theme.spacing.medium.gap}>
        ${
          !compact
            ? html`
          <${Time}
            color=${theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.small}
          >${this.formatTime(relativeTime)}</${Time}>
        `
            : null
        }

        <${SeekBar} progress=${progress / 100} onSeek=${this.handleSeek} />

        <${Time}
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.small}
        >${this.formatTime(rightLabelValue)}</${Time}>
      </${TimelineWrapper}>
    `
  }
}

// =========================================================================
// AudioPlayer Component
// =========================================================================

/**
 * AudioPlayer Component
 * An overlay audio player with play/pause, progress bar, and time display.
 * Designed to sit at the bottom of an album image or as a standalone player.
 *
 * @param {Object} props
 * @param {string} props.audioUrl - URL of the audio file to play (required)
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='full'] - Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `full`; `auto` not accepted (warns and falls back to the default). Any value other than `full` switches to the compact layout.
 * @param {number} [props.start] - Optional start time in seconds for region playback
 * @param {number} [props.end] - Optional end time in seconds for region playback
 * @param {boolean} [props.loop=false] - Repeat the clip (or region) until stopped or until another clip takes the channel. No visible control; the seek bar wraps with playback.
 * @returns {preact.VNode|null} Returns null if audioUrl is not provided
 *
 * @example
 * // Basic usage
 * <AudioPlayer audioUrl="/path/to/audio.mp3" />
 *
 * @example
 * // Region playback (plays only 10s–25s of the file)
 * <AudioPlayer audioUrl="/audio.mp3" start=${10} end=${25} />
 *
 * @example
 * // Looping bed (plays until stopped)
 * <AudioPlayer audioUrl="/rain.mp3" loop=${true} />
 *
 * @example
 * // As overlay on album image
 * <div style="position: relative;">
 *   <img src="/album-cover.jpg" />
 *   <AudioPlayer audioUrl="/audio.mp3" />
 * </div>
 */
export class AudioPlayer extends Component {
  constructor(props) {
    super(props)
    this._instanceId = ++_nextInstanceId
    this.state = {
      theme: currentTheme.value,
      isPlaying: false,
      duration: 0,
    }
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme })
    })
    // Sync play/pause and duration with the global audio player
    this.unsubscribeAudio = globalAudioPlayer.subscribe(
      this.handleAudioStateChange,
    )
    this._loadMetadata(this.props.audioUrl)
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) this.unsubscribeTheme()
    if (this.unsubscribeAudio) this.unsubscribeAudio()
    this._cancelMetadataLoad()

    // Stop audio if this specific instance is currently playing
    const { audioUrl, channel = 0 } = this.props
    if (
      audioUrl &&
      globalAudioPlayer.isPlaying(audioUrl, this._instanceId, channel)
    ) {
      globalAudioPlayer.stop(channel)
    }
  }

  componentDidUpdate(prevProps) {
    // When the audio source changes, stop if this instance owns playback, then reset
    if (prevProps.audioUrl !== this.props.audioUrl) {
      const channel = this.props.channel ?? 0
      if (
        prevProps.audioUrl &&
        globalAudioPlayer.isPlaying(
          prevProps.audioUrl,
          this._instanceId,
          channel,
        )
      ) {
        globalAudioPlayer.stop(channel)
      }
      this.setState({ isPlaying: false, duration: 0 })
      this._cancelMetadataLoad()
      this._loadMetadata(this.props.audioUrl)
    }
  }

  // Preload only audio metadata so duration is available before the user clicks play.
  _loadMetadata(audioUrl) {
    if (!audioUrl) return
    const audio = new Audio()
    audio.preload = 'metadata'
    this._metadataAudio = audio
    audio.addEventListener('loadedmetadata', () => {
      if (this._metadataAudio === audio && isFinite(audio.duration)) {
        this.setState({ duration: audio.duration })
        this._metadataAudio = null
      }
    })
    audio.src = audioUrl
    // Explicitly trigger the metadata fetch — required by some browsers when
    // the element is not attached to the DOM and preload alone is insufficient.
    audio.load()
  }

  _cancelMetadataLoad() {
    if (this._metadataAudio) {
      this._metadataAudio.src = ''
      this._metadataAudio = null
    }
  }

  handleAudioStateChange = () => {
    const { audioUrl, channel = 0 } = this.props
    const isPlaying = globalAudioPlayer.isPlaying(
      audioUrl,
      this._instanceId,
      channel,
    )
    const updates = { isPlaying }

    // Update duration when this instance owns the active audio element
    const { audioElement, currentAudioUrl, currentInstanceId } =
      globalAudioPlayer.getChannelState(channel)
    if (
      currentAudioUrl === audioUrl &&
      currentInstanceId === this._instanceId &&
      audioElement
    ) {
      const d = audioElement.duration
      if (isFinite(d)) updates.duration = d
    }

    this.setState(updates)
  }

  togglePlayPause = () => {
    const { audioUrl, start, end, channel = 0, loop = false } = this.props
    if (!audioUrl) return
    const region = start != null && end != null ? { start, end } : null
    globalAudioPlayer.toggle(audioUrl, region, this._instanceId, channel, {
      loop,
    })
  }

  handleSeekRequest = (newTime) => {
    const { audioUrl, end, channel = 0, loop = false } = this.props
    if (!audioUrl) return
    // Start playback from the clicked position. Preserve the region end if set.
    const region = end != null ? { start: newTime, end } : { start: newTime }
    globalAudioPlayer.play(audioUrl, region, this._instanceId, channel, {
      loop,
    })
  }

  render() {
    const {
      audioUrl,
      widthScale,
      start,
      end,
      disabled = false,
      channel = 0,
    } = this.props
    const { theme, isPlaying, duration } = this.state

    // Validate widthScale only when it changes, so a re-render (every
    // playback tick) does not repeat the warning.
    if (
      this.widthScaleKey !== widthScale ||
      this.resolvedWidthScale === undefined
    ) {
      this.widthScaleKey = widthScale
      this.resolvedWidthScale = resolveWidthScale('audio-player', widthScale, {
        allowAuto: false,
        fallback: 'full',
      })
    }
    const { width, flex } = getWidthScaleStyle(
      'audio-player',
      this.resolvedWidthScale,
      { allowAuto: false, fallback: 'full', theme },
    )
    const compact = this.resolvedWidthScale !== 'full'

    if (disabled || !audioUrl) {
      if (!disabled && !audioUrl) return null
      return html`
        <${PlayerContainer} padding=${theme.spacing.medium.padding} width=${width} flex=${flex || ''}>
          <${Panel} variant="glass" padding="medium">
            <${Controls} gap=${theme.spacing.small.gap}>
              <${Button}
                size="small"
                color="secondary"
                icon="play"
                disabled
                title="No audio available"
              />
              <${AudioTimeline}
                audioElement=${null}
                duration=${0}
                startOffset=${0}
                compact=${compact}
                isPlaying=${false}
              />
            </${Controls}>
          </${Panel}>
        </${PlayerContainer}>
      `
    }

    // Only pass the shared audio element when this specific instance owns playback,
    // so AudioTimeline tracks the correct position and seeking works.
    const {
      audioElement: chAudioElement,
      currentAudioUrl,
      currentInstanceId,
    } = globalAudioPlayer.getChannelState(channel)
    const audioElement =
      chAudioElement &&
      currentAudioUrl === audioUrl &&
      currentInstanceId === this._instanceId
        ? chAudioElement
        : null

    // When region props are provided, display the region duration instead of the full file duration
    const hasRegion = start != null && end != null
    const effectiveDuration = hasRegion ? end - start : duration
    const startOffset = hasRegion ? start : 0

    return html`
      <${PlayerContainer} padding=${theme.spacing.medium.padding} width=${width} flex=${flex || ''}>
        <${Panel} variant="glass" padding="medium">
          <${Controls} gap=${theme.spacing.small.gap}>
            <${Button}
              size="small"
              color="secondary"
              icon=${isPlaying ? 'stop' : 'play'}
              onClick=${this.togglePlayPause}
              title=${isPlaying ? 'Pause' : 'Play'}
            />

            <${AudioTimeline}
              audioElement=${audioElement}
              duration=${effectiveDuration}
              startOffset=${startOffset}
              compact=${compact}
              isPlaying=${isPlaying}
              onSeekRequest=${this.handleSeekRequest}
            />
          </${Controls}>
        </${Panel}>
      </${PlayerContainer}>
    `
  }
}
