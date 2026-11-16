import { describe, test, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const cpMock = vi.hoisted(() => ({
  spawn: vi.fn(() => ({ pid: 1 })),
  execSync: vi.fn(() => 'out'),
  execFile: vi.fn((_file, _args, _options, callback) => {
    callback?.(null, 'stdout-text', 'stderr-text')
    return { pid: 1 }
  }),
}))

vi.mock('child_process', () => cpMock)

const { spawn, execSync, execFile } = await import('./child-process.mjs')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('child-process wrapper', () => {
  test('spawn defaults windowsHide: true', () => {
    spawn('ffmpeg', ['-version'])
    expect(cpMock.spawn).toHaveBeenCalledWith('ffmpeg', ['-version'], {
      windowsHide: true,
    })
  })

  test('spawn with no args still forwards an args array', () => {
    spawn('tar')
    expect(cpMock.spawn).toHaveBeenCalledWith('tar', [], { windowsHide: true })
  })

  test('execSync defaults windowsHide: true', () => {
    execSync('ffprobe x')
    expect(cpMock.execSync).toHaveBeenCalledWith('ffprobe x', {
      windowsHide: true,
    })
  })

  test('execFile defaults windowsHide: true and keeps the callback', () => {
    const cb = vi.fn()
    execFile('git', ['--version'], cb)
    expect(cpMock.execFile).toHaveBeenCalledWith(
      'git',
      ['--version'],
      { windowsHide: true },
      cb,
    )
    expect(cb).toHaveBeenCalledWith(null, 'stdout-text', 'stderr-text')
  })

  test('caller options are preserved alongside windowsHide', () => {
    spawn('llama-server', ['--port', '1'], { stdio: 'pipe', cwd: '/x' })
    execSync('cmd', { stdio: 'pipe' })
    expect(cpMock.spawn.mock.calls[0][2]).toEqual({
      windowsHide: true,
      stdio: 'pipe',
      cwd: '/x',
    })
    expect(cpMock.execSync.mock.calls[0][1]).toEqual({
      windowsHide: true,
      stdio: 'pipe',
    })
  })

  test('an explicit windowsHide: false is kept', () => {
    const cb = vi.fn()
    execFile('powershell', ['-Command', 'x'], { windowsHide: false }, cb)
    spawn('x', [], { windowsHide: false })
    execSync('x', { windowsHide: false })
    expect(cpMock.execFile.mock.calls[0][2].windowsHide).toBe(false)
    expect(cpMock.spawn.mock.calls[0][2].windowsHide).toBe(false)
    expect(cpMock.execSync.mock.calls[0][1].windowsHide).toBe(false)
  })

  test('promisify(execFile) resolves to { stdout, stderr } like Node', async () => {
    // The mocked execFile has no promisify.custom of its own, so give it the
    // same one Node's real execFile carries.
    cpMock.execFile[promisify.custom] = (file, args, options) =>
      new Promise((resolve, reject) =>
        cpMock.execFile(file, args, options, (err, stdout, stderr) =>
          err ? reject(err) : resolve({ stdout, stderr }),
        ),
      )
    const result = await promisify(execFile)('ffprobe', ['-v', 'error'])
    expect(result).toEqual({ stdout: 'stdout-text', stderr: 'stderr-text' })
    expect(cpMock.execFile.mock.calls[0][2]).toEqual({ windowsHide: true })
  })
})

const SERVER_ROOT = path.join(process.cwd(), 'server')
const WRAPPER = path.join(SERVER_ROOT, 'core', 'child-process.mjs')

/** Every non-test `.mjs` under `server/`, recursively, except the wrapper. */
function listServerModules(dir = SERVER_ROOT) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listServerModules(full))
    else if (
      entry.name.endsWith('.mjs') &&
      !entry.name.endsWith('.test.mjs') &&
      full !== WRAPPER
    )
      out.push(full)
  }
  return out
}

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const FORBIDDEN = [
  /from\s+['"](node:)?child_process['"]/,
  /import\(\s*['"](node:)?child_process['"]\s*\)/,
  /require\(\s*['"](node:)?child_process['"]\s*\)/,
]

describe('child_process guard', () => {
  test('only server/core/child-process.mjs imports child_process', () => {
    const offenders = listServerModules().filter((file) => {
      const src = stripComments(fs.readFileSync(file, 'utf8'))
      return FORBIDDEN.some((re) => re.test(src))
    })
    expect(
      offenders.map((f) => path.relative(process.cwd(), f)),
      'start child processes through server/core/child-process.mjs so they default windowsHide: true',
    ).toEqual([])
  })
})
