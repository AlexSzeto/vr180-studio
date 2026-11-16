/**
 * use-listbox-keyboard.mjs – keyboard model for a button-triggered dropdown list.
 *
 * Shared by `Select` and `MultiSelect`. Focus stays on the trigger button the
 * whole time; the open list is driven through a "highlighted" index that the
 * component paints and exposes as `aria-activedescendant`.
 *
 * Follows the browser's own `<select>` keyboard model with one deliberate
 * difference: a key on the CLOSED field never changes the value. Letters,
 * arrows, Home/End, Space, Enter, Alt+↓ and F4 all open the list (letters
 * highlighting their type-ahead match), so a caller's `onChange` fires once per
 * real pick rather than once per keystroke.
 */
import { useState, useRef, useEffect, useCallback } from 'preact/hooks'

/** Type-ahead buffer reset delay, matching Chromium's native select. */
export const TYPEAHEAD_RESET_MS = 1000

/** Rows a PageUp/PageDown press moves the highlight by. */
const PAGE_STEP = 10

const isEnabled = (options, i) =>
  i >= 0 && i < options.length && !options[i]?.disabled

function firstEnabled(options) {
  return options.findIndex((o) => !o?.disabled)
}

function lastEnabled(options) {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i]?.disabled) return i
  }
  return -1
}

/** `index` when it is enabled, else the first enabled option. */
const startIndex = (options, index) =>
  isEnabled(options, index) ? index : firstEnabled(options)

/** Next enabled index `steps` away from `from` in `dir` (±1), clamped at the ends. */
function stepEnabled(options, from, dir, steps = 1) {
  let current = from
  let i = from
  let moved = 0
  while (moved < steps) {
    i += dir
    if (i < 0 || i >= options.length) break
    if (!options[i]?.disabled) {
      current = i
      moved++
    }
  }
  if (current < 0) return dir > 0 ? firstEnabled(options) : lastEnabled(options)
  return current
}

/**
 * Index of the option a type-ahead `buffer` selects, starting from `current`.
 *
 * - Case-insensitive prefix match on `label`, skipping disabled options.
 * - A single character, or one character repeated (`"bbb"`), cycles: the
 *   search starts AFTER `current` and wraps.
 * - A longer buffer starts AT `current`, so extending `"n"` to `"ne"` stays on
 *   the row while it still matches.
 *
 * @param {Array<{label: string, disabled?: boolean}>} options
 * @param {string} buffer
 * @param {number} current - highlighted index, or -1
 * @returns {number} matching index, or -1 when nothing matches
 */
export function findTypeaheadMatch(options, buffer, current) {
  const n = options.length
  if (!n || !buffer) return -1
  const lower = buffer.toLowerCase()
  const repeated = [...lower].every((c) => c === lower[0])
  const needle = repeated ? lower[0] : lower
  const start = current < 0 ? 0 : repeated ? current + 1 : current
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    const opt = options[i]
    if (opt?.disabled) continue
    if (
      String(opt?.label ?? '')
        .toLowerCase()
        .startsWith(needle)
    )
      return i
  }
  return -1
}

const isPrintable = (e) =>
  typeof e.key === 'string' &&
  e.key.length === 1 &&
  !e.ctrlKey &&
  !e.metaKey &&
  !e.altKey

/**
 * @param {Object} params
 * @param {Array<{label: string, disabled?: boolean}>} params.options
 * @param {boolean} params.open - owned by the component
 * @param {number} params.initialIndex - index highlighted when the list opens
 *   (Select: the current value; MultiSelect: the first checked row); falls back
 *   to the first enabled option when -1 or disabled
 * @param {'single'|'multi'} [params.mode='single'] - `single` commits and closes;
 *   `multi` toggles and stays open
 * @param {boolean} [params.disabled=false] - whole control disabled: keys ignored
 * @param {(triggerEl: HTMLElement) => void} params.onOpen - computes the anchor and opens
 * @param {() => void} params.onClose
 * @param {(index: number) => void} params.onCommit - single: select; multi: toggle
 * @param {(index: number) => (HTMLElement|null)} [params.getRowEl] - row DOM node,
 *   scrolled into view as the highlight moves
 * @returns {{ highlightedIndex: number, setHighlightedIndex: (i: number) => void,
 *   onKeyDown: (e: KeyboardEvent) => void, onKeyUp: (e: KeyboardEvent) => void }}
 *
 * @example
 * const kb = useListboxKeyboard({ options, open, initialIndex, onOpen, onClose, onCommit })
 * <button onKeyDown=${kb.onKeyDown} onKeyUp=${kb.onKeyUp} … />
 */
export function useListboxKeyboard({
  options,
  open,
  initialIndex,
  mode = 'single',
  disabled = false,
  onOpen,
  onClose,
  onCommit,
  getRowEl,
}) {
  const [highlightedIndex, setHighlightState] = useState(-1)
  // The ref is the source of truth so keys pressed before a re-render still
  // read the latest highlight; the state only drives painting.
  const highlightRef = useRef(-1)
  const bufferRef = useRef('')
  const timerRef = useRef(null)
  // Set when a key opened the list: that handler already placed the highlight
  // synchronously, so the open effect must not reset it. Effects run after
  // paint, so a second key typed before then would otherwise read no highlight
  // and the late effect would overwrite what it chose.
  const keyOpenedRef = useRef(false)
  const openRef = useRef(open)
  openRef.current = open
  const latest = useRef({})
  latest.current = { options, initialIndex, getRowEl }

  const setHighlightedIndex = useCallback((i) => {
    highlightRef.current = i
    setHighlightState(i)
  }, [])

  const clearBuffer = useCallback(() => {
    bufferRef.current = ''
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const pushBuffer = useCallback((ch) => {
    bufferRef.current += ch
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      bufferRef.current = ''
      timerRef.current = null
    }, TYPEAHEAD_RESET_MS)
    return bufferRef.current
  }, [])

  useEffect(() => clearBuffer, [clearBuffer])

  useEffect(() => {
    if (open) {
      if (keyOpenedRef.current) {
        keyOpenedRef.current = false
        return
      }
      const { options: opts, initialIndex: init } = latest.current
      setHighlightedIndex(startIndex(opts, init))
    } else if (!openRef.current) {
      // Skipped when a key already reopened the list before this ran.
      keyOpenedRef.current = false
      setHighlightedIndex(-1)
      clearBuffer()
    }
  }, [open, setHighlightedIndex, clearBuffer])

  useEffect(() => {
    if (!open || highlightedIndex < 0) return
    const el = latest.current.getRowEl?.(highlightedIndex)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [open, highlightedIndex])

  const commit = useCallback(
    (close) => {
      const i = highlightRef.current
      if (isEnabled(options, i)) onCommit?.(i)
      if (close) onClose?.()
    },
    [options, onCommit, onClose],
  )

  const onKeyDown = useCallback(
    (e) => {
      if (disabled) return
      const { key } = e
      const alt = e.altKey

      if (!open) {
        const openWith = (index) => {
          e.preventDefault()
          setHighlightedIndex(
            index != null && isEnabled(options, index)
              ? index
              : startIndex(options, initialIndex),
          )
          keyOpenedRef.current = true
          onOpen?.(e.currentTarget)
        }
        if (key === ' ' && !bufferRef.current) return openWith(null)
        if (isPrintable(e)) {
          const buffer = pushBuffer(key)
          const match = findTypeaheadMatch(options, buffer, initialIndex)
          return openWith(match >= 0 ? match : null)
        }
        switch (key) {
          case 'ArrowDown':
          case 'ArrowUp':
          case 'F4':
          case 'Enter':
            return openWith(null)
          case 'Home':
            return openWith(firstEnabled(options))
          case 'End':
            return openWith(lastEnabled(options))
        }
        return
      }

      const current = highlightRef.current
      const move = (index) => {
        e.preventDefault()
        if (index >= 0) setHighlightedIndex(index)
      }

      if ((key === 'ArrowDown' || key === 'ArrowUp') && alt) {
        e.preventDefault()
        return mode === 'single' ? commit(true) : onClose?.()
      }
      switch (key) {
        case 'ArrowDown':
          return move(stepEnabled(options, current, 1))
        case 'ArrowUp':
          return move(stepEnabled(options, current, -1))
        case 'PageDown':
          return move(stepEnabled(options, current, 1, PAGE_STEP))
        case 'PageUp':
          return move(stepEnabled(options, current, -1, PAGE_STEP))
        case 'Home':
          return move(firstEnabled(options))
        case 'End':
          return move(lastEnabled(options))
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          return onClose?.()
        case 'Tab':
          // No preventDefault: focus moves on to the next field.
          return mode === 'single' ? commit(true) : onClose?.()
        case 'F4':
          e.preventDefault()
          return mode === 'single' ? commit(true) : onClose?.()
        case 'Enter':
          e.preventDefault()
          return commit(mode === 'single')
      }
      if (key === ' ' && !bufferRef.current) {
        e.preventDefault()
        return commit(mode === 'single')
      }
      if (isPrintable(e)) {
        e.preventDefault()
        const buffer = pushBuffer(key)
        const match = findTypeaheadMatch(options, buffer, current)
        if (match >= 0) setHighlightedIndex(match)
      }
    },
    [
      disabled,
      open,
      options,
      initialIndex,
      mode,
      onOpen,
      onClose,
      commit,
      pushBuffer,
      setHighlightedIndex,
    ],
  )

  // A native button activates on Space's keyup; the keydown above already
  // opened or committed, so cancel that click so it does not toggle again.
  const onKeyUp = useCallback(
    (e) => {
      if (disabled) return
      if (e.key === ' ') e.preventDefault()
    },
    [disabled],
  )

  return { highlightedIndex, setHighlightedIndex, onKeyDown, onKeyUp }
}
