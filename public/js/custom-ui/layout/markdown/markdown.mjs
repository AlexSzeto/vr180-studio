/**
 * markdown.mjs - Themed markdown renderer.
 *
 * Lexes markdown with a vendored `marked` lexer and walks the resulting token
 * tree, emitting Preact VNodes directly. Drop it into any page section that
 * shows a block of text.
 *
 * ## The no-HTML invariant
 *
 * `marked.lexer()` returns a nested token array and stops - it produces no
 * HTML string. This component walks that array and renders VNodes, so at no
 * point does an HTML string exist to be injected. Consequently:
 *
 *   - NEVER call `marked.parse()`, `marked.parseInline()`, or any marked
 *     renderer API from this component or its renderers.
 *   - NEVER use `dangerouslySetInnerHTML` or `innerHTML` here.
 *
 * Any change that reaches for `marked.parse()` reintroduces the entire XSS
 * surface this design avoids, and would require a sanitizer that is otherwise
 * unnecessary.
 */

import { html } from 'htm/preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { styled } from '../../goober-setup.mjs'
import { currentTheme } from '../../theme.mjs'
import { marked } from './marked.esm.js'
import { defaultRenderers } from './renderers.mjs'

// =========================================================================
// Styled Components
// =========================================================================

const MarkdownRoot = styled('div')`
  /* Long unbroken tokens (URLs, hashes, identifiers) must wrap rather than
     force the container to scroll horizontally. Whitespace preservation lives
     on the individual text-bearing blocks in renderers.mjs, not here: a
     root-level pre-wrap would also render the newlines between block
     elements, doubling the visible gaps. */
  overflow-wrap: break-word;
  word-wrap: break-word;
  font-family: ${() => currentTheme.value.typography.fontFamily};
`
MarkdownRoot.className = 'markdown-root'

// =========================================================================
// Token walk
// =========================================================================

/**
 * Renders one token by dispatching to its arm in the merged renderer map.
 *
 * A token whose `type` has no arm falls back to its `raw` text as a plain
 * string, so an unhandled or newly-introduced token type degrades to visible
 * source rather than throwing or silently vanishing.
 */
function renderToken(token, renderers, theme, key) {
  if (token == null) return null
  if (typeof token === 'string') return token

  const factory = renderers[token.type]
  if (typeof factory !== 'function') {
    return token.raw ?? token.text ?? ''
  }

  // A `list` carries its items on `items`; every other container token uses
  // `tokens`. Either way the walker renders them into `children` so the arm
  // only has to place them.
  const nested = token.type === 'list' ? token.items : token.tokens
  const children = Array.isArray(nested)
    ? renderTokens(nested, renderers, theme)
    : null

  // A few token shapes carry nested tokens somewhere the walker cannot reach
  // generically — `table` holds them on per-cell objects under `header` and
  // `rows`, not on a single `tokens` array. Rather than growing a second
  // special case here for every such shape, every arm is handed
  // `renderChildren`: a walker bound to the current renderer map and theme, so
  // an arm can render its own sub-token arrays and still get full recursion
  // (including any caller overrides).
  const renderChildren = (nestedTokens) =>
    renderTokens(nestedTokens, renderers, theme)

  return factory({ ...token, children, renderChildren, theme, key })
}

/**
 * Renders an array of tokens into an array of VNodes.
 */
function renderTokens(tokens, renderers, theme) {
  if (!Array.isArray(tokens)) return []
  return tokens.map((token, index) =>
    renderToken(token, renderers, theme, `md-${index}`),
  )
}

// =========================================================================
// Component
// =========================================================================

/**
 * Markdown - Renders a markdown string as themed Preact VNodes.
 *
 * @param {Object} props
 * @param {string} [props.content=''] - Markdown source. Empty or whitespace
 *   content renders an empty container without error.
 * @param {string} [props.color] - Text color; defaults to
 *   `theme.colors.text.primary`.
 * @param {string} [props.fontSize] - Body font size; defaults to
 *   `theme.typography.fontSize.medium`. The heading scale is `em`-relative,
 *   so headings scale with whatever is passed here.
 * @param {Object} [props.renderers] - Per-token-type renderer overrides,
 *   shallow-merged OVER `defaultRenderers`. Supplying only a `heading` factory
 *   replaces that arm and leaves every other arm at its default. See
 *   `renderers.mjs` for the factory contract.
 * @returns {preact.VNode}
 *
 * @example
 * // Plain usage
 * <Markdown content=${message.content} />
 *
 * @example
 * // Document-scale headings, everything else default
 * <Markdown
 *   content=${doc}
 *   renderers=${{ heading: ({ children, key }) => html`<${H2} key=${key}>${children}</${H2}>` }}
 * />
 */
export function Markdown({
  content = '',
  color,
  fontSize,
  renderers,
  style: propStyle,
  ...rest
}) {
  const [theme, setTheme] = useState(currentTheme.value)

  useEffect(() => currentTheme.subscribe(setTheme), [])

  const source = typeof content === 'string' ? content : ''

  // Re-lex on every content change. `Markdown` re-renders per streaming delta,
  // so this memo is what keeps a growing message from re-lexing on unrelated
  // re-renders; no throttle or incremental-parse scheme is wanted here.
  const tokens = useMemo(() => {
    if (!source.trim()) return []
    try {
      return marked.lexer(source)
    } catch {
      // Never let malformed input take down the surrounding page: fall back to
      // showing the source verbatim.
      return [{ type: 'unknown', raw: source }]
    }
  }, [source])

  const mergedRenderers = useMemo(
    () => ({ ...defaultRenderers, ...(renderers || {}) }),
    [renderers],
  )

  const children = useMemo(
    () => renderTokens(tokens, mergedRenderers, theme),
    [tokens, mergedRenderers, theme],
  )

  const combinedStyle = {
    color: color || theme.colors.text.primary,
    fontSize: fontSize || theme.typography.fontSize.medium,
    ...propStyle,
  }

  return html`<${MarkdownRoot} style=${combinedStyle} ...${rest}
    >${children}</${MarkdownRoot}
  >`
}
