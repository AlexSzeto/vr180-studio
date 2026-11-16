/**
 * The only module in `server/` that may import `child_process` (enforced by
 * the guard test in `child-process.test.mjs`).
 *
 * Every wrapper defaults `windowsHide: true`. On Windows a console program
 * (ffmpeg, llama-server, cmd.exe, taskkill, …) shares its parent's console
 * when there is one — but a server started without a console (under PM2, whose
 * daemon has none) gives every such child a brand-new console window, which
 * flashes in the foreground or, for long-lived children, sits there empty
 * because their output is piped back to us. `windowsHide` suppresses that
 * window; Node ignores it on other platforms, so it is applied unconditionally.
 * A caller that genuinely needs a visible window passes `windowsHide: false`.
 */
import * as cp from 'child_process'
import { promisify } from 'util'

const withHide = (options) => ({ windowsHide: true, ...options })

/**
 * Split the optional `[args], [options], [callback]` tail shared by `spawn`
 * and `execFile`, so every call form Node accepts keeps working.
 */
function splitArgs(rest) {
  const args = rest.find((a) => Array.isArray(a)) ?? []
  const options = rest.find(
    (a) => a && typeof a === 'object' && !Array.isArray(a),
  )
  const callback = rest.find((a) => typeof a === 'function')
  return { args, options, callback }
}

/** `child_process.spawn` with `windowsHide: true` by default. */
export function spawn(command, ...rest) {
  const { args, options } = splitArgs(rest)
  return cp.spawn(command, args, withHide(options))
}

/** `child_process.execSync` with `windowsHide: true` by default. */
export function execSync(command, options) {
  return cp.execSync(command, withHide(options))
}

/** `child_process.execFile` with `windowsHide: true` by default. */
export function execFile(file, ...rest) {
  const { args, options, callback } = splitArgs(rest)
  return cp.execFile(file, args, withHide(options), callback)
}

// Node's own execFile carries a promisify.custom that resolves to
// `{ stdout, stderr }`. Without one, `promisify(execFile)` would resolve to the
// bare stdout string and every `const { stdout } = await …` caller would
// silently read undefined.
execFile[promisify.custom] = (file, ...rest) => {
  const { args, options } = splitArgs(rest)
  return promisify(cp.execFile)(file, args, withHide(options))
}
