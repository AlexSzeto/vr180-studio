/**
 * use-input-validation.mjs – Single-field validation lifecycle hook.
 *
 * Owns the debounce timer, the in-flight `validating` state, and stale-result
 * discarding for one input field. The caller's `validate` returns exactly what
 * gets displayed — the hook does no mapping of its own.
 *
 * @module custom-ui/io/use-input-validation
 */
import { useState, useRef, useEffect, useCallback } from 'preact/hooks'

/** Resting state: nothing has run, or the result was cleared. Renders nothing. */
const IDLE = Object.freeze({ status: 'idle', message: '' })

/**
 * @param {Object}   options
 * @param {Function} options.validate
 *   async (value) => { status, message } | null | undefined.
 *   Returning null/undefined — or throwing — settles the field back to idle.
 * @param {number}   [options.debounceMs=600]  – Quiet period before a debounced run fires
 * @param {string}   [options.validatingMessage='Validating…'] – Message shown while in flight
 *
 * @returns {{
 *   status: 'idle'|'validating'|'valid'|'warning'|'invalid',
 *   message: string,
 *   validation: { status: string, message: string },
 *   onValueChange: (value: *) => void,
 *   validate: (value: *) => Promise<{ status: string, message: string }>,
 *   reset: () => void,
 * }}
 */
export function useInputValidation({
  validate,
  debounceMs = 600,
  validatingMessage = 'Validating…',
} = {}) {
  const [result, setResult] = useState(IDLE)

  // Always-current inner refs so the stable callbacks below never read stale props
  const validateRef = useRef(validate)
  validateRef.current = validate

  const debounceMsRef = useRef(debounceMs)
  debounceMsRef.current = debounceMs

  const validatingMessageRef = useRef(validatingMessage)
  validatingMessageRef.current = validatingMessage

  const timerRef = useRef(null)
  // Monotonic run counter — a resolved run only commits if it is still the latest
  const seqRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const commit = useCallback((seq, next) => {
    // A slow earlier call must never overwrite a newer result
    if (!mountedRef.current || seq !== seqRef.current) return
    setResult(next)
  }, [])

  const run = useCallback(
    async (value) => {
      const seq = (seqRef.current += 1)
      const fn = validateRef.current
      if (typeof fn !== 'function') {
        commit(seq, IDLE)
        return IDLE
      }

      commit(seq, {
        status: 'validating',
        message: validatingMessageRef.current,
      })

      let outcome
      try {
        outcome = await fn(value)
      } catch {
        // A thrown validator is a failed check, not an invalid value — stay quiet
        outcome = null
      }

      const settled =
        outcome && outcome.status
          ? { status: outcome.status, message: outcome.message ?? '' }
          : IDLE
      commit(seq, settled)
      return settled
    },
    [commit],
  )

  const onValueChange = useCallback(
    (value) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        run(value)
      }, debounceMsRef.current)
    },
    [run],
  )

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Bump the counter so any in-flight run is discarded when it resolves
    seqRef.current += 1
    if (mountedRef.current) setResult(IDLE)
  }, [])

  return {
    status: result.status,
    message: result.message,
    validation: result,
    onValueChange,
    validate: run,
    reset,
  }
}
