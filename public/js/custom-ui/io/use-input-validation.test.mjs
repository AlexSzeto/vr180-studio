import { describe, test, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/preact'

import { useInputValidation } from './use-input-validation.mjs'

afterEach(cleanup)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useInputValidation', () => {
  test('rapid changes inside the debounce window fire one run with the last value', async () => {
    const validate = vi.fn(async () => ({ status: 'valid', message: 'ok' }))
    const { result } = renderHook(() =>
      useInputValidation({ validate, debounceMs: 50 }),
    )

    act(() => {
      result.current.onValueChange('a')
      result.current.onValueChange('ab')
      result.current.onValueChange('abc')
    })
    await wait(120)

    expect(validate).toHaveBeenCalledTimes(1)
    expect(validate).toHaveBeenCalledWith('abc')
  })

  test('a slow earlier run never overwrites a newer result', async () => {
    const resolvers = []
    const validate = vi.fn(
      () => new Promise((resolve) => resolvers.push(resolve)),
    )
    const { result } = renderHook(() => useInputValidation({ validate }))

    let first
    let second
    act(() => {
      first = result.current.validate('first')
      second = result.current.validate('second')
    })

    // The later run settles first, then the earlier one arrives late
    resolvers[1]({ status: 'valid', message: 'second' })
    await second
    resolvers[0]({ status: 'invalid', message: 'first' })
    await first

    await waitFor(() => {
      expect(result.current.status).toBe('valid')
      expect(result.current.message).toBe('second')
    })
  })

  test('a validator that throws settles to idle rather than surfacing the error', async () => {
    const validate = vi.fn(async () => {
      throw new Error('network down')
    })
    const { result } = renderHook(() => useInputValidation({ validate }))

    await act(async () => {
      await result.current.validate('x')
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.message).toBe('')
  })

  test('a validator returning undefined settles to idle', async () => {
    const validate = vi.fn(async () => undefined)
    const { result } = renderHook(() => useInputValidation({ validate }))

    await act(async () => {
      await result.current.validate('x')
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.message).toBe('')
  })

  test('reset returns to idle and clears the message', async () => {
    const validate = vi.fn(async () => ({
      status: 'invalid',
      message: 'nope',
    }))
    const { result } = renderHook(() => useInputValidation({ validate }))

    await act(async () => {
      await result.current.validate('x')
    })
    expect(result.current.status).toBe('invalid')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.message).toBe('')
  })

  test('imperative validate runs immediately and resolves to the result object', async () => {
    const validate = vi.fn(async () => ({ status: 'warning', message: 'hm' }))
    const { result } = renderHook(() =>
      useInputValidation({ validate, debounceMs: 10000 }),
    )

    let outcome
    await act(async () => {
      outcome = await result.current.validate('x')
    })

    expect(validate).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ status: 'warning', message: 'hm' })
    expect(result.current.status).toBe('warning')
  })

  test('unmounting with a pending debounce never invokes validate', async () => {
    const validate = vi.fn(async () => ({ status: 'valid', message: '' }))
    const { result, unmount } = renderHook(() =>
      useInputValidation({ validate, debounceMs: 50 }),
    )

    act(() => {
      result.current.onValueChange('a')
    })
    unmount()
    await wait(120)

    expect(validate).not.toHaveBeenCalled()
  })

  test('reports the validating message while a run is in flight', async () => {
    let release
    const validate = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const { result } = renderHook(() =>
      useInputValidation({ validate, validatingMessage: 'Checking…' }),
    )

    let pending
    act(() => {
      pending = result.current.validate('x')
    })

    await waitFor(() => {
      expect(result.current.status).toBe('validating')
      expect(result.current.message).toBe('Checking…')
    })

    release({ status: 'valid', message: '' })
    await pending
  })
})
