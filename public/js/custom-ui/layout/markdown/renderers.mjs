/**
 * renderers.mjs - Default token renderers for the `Markdown` component.
 *
 * `defaultRenderers` maps a `marked` token `type` string to a renderer factory.
 * Each factory receives ONE argument, an object containing:
 *
 *   - the token's own fields (`depth`, `lang`, `ordered`, `text`, `raw`, ...)
 *   - `children` - the already-rendered VNode array for the token's nested
 *     tokens, or `null` for a leaf token
 *   - `theme`    - the current theme object
 *   - `key`      - a stable key for the returned VNode
 *
 * ...and returns a Preact VNode (or `null` to render nothing).
 *
 * The `renderers` prop on `Markdown` is shallow-merged OVER this object, so a
 * caller overriding a single arm inherits every other arm unchanged. That is
 * the sanctioned extension point for a document-style presentation.
 *
 * SAFETY: nothing here ever produces an HTML string. No `marked.parse()`, no
 * `dangerouslySetInnerHTML`, no `innerHTML`. Token text always reaches the DOM
 * as a Preact text child, so markup inside model output stays visible text.
 */

import { html } from 'htm/preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { styled } from '../../goober-setup.mjs'
import { currentTheme } from '../../theme.mjs'
import { Button } from '../../io/button.mjs'

// =========================================================================
// Heading scale
// =========================================================================

/**
 * Font sizes for markdown heading levels 1-6, as `em` multipliers of the
 * inherited body font size.
 *
 * Why `em` rather than `theme.typography.fontSize` tokens: the theme exposes
 * only three type sizes (small/medium/large, a 12-16px range) which is not
 * enough to express six heading levels, and — more importantly — `Markdown`
 * takes a `fontSize` prop, so the heading scale has to stay RELATIVE to
 * whatever body size the caller passes rather than being pinned to a fixed
 * token. `em` inherits from the root's font size and does exactly that.
 *
 * The scale is deliberately modest. This is an EMBEDDED scale: markdown here
 * renders inside a chat bubble or a panel, not as a page. `H1` from
 * `themed-base.mjs` is 2rem and semantically the *page* title, so it is
 * intentionally not reused (see the story card's "Heading scale" note).
 */
export const HEADING_FONT_SIZES = {
  1: '1.5em',
  2: '1.3em',
  3: '1.15em',
  4: '1.05em',
  5: '1em',
  6: '0.95em',
}

// =========================================================================
// Styled Components
// =========================================================================

// Shared block rhythm: markdown blocks are separated by a themed gap. The
// first block never gets a top margin so the rendered document sits flush
// against whatever container it was dropped into.
//
// These shared chunks are FUNCTIONS, not plain template strings: goober calls
// interpolated functions at render time, which is what lets the emitted CSS
// track the live theme. A plain string would freeze (or, worse, stringify)
// the theme lookups at module load.
const headingCss = () => {
  const theme = currentTheme.value
  return `
  margin: ${theme.spacing.medium.gap} 0 ${theme.spacing.small.gap} 0;
  font-weight: ${theme.typography.fontWeight.bold};
  line-height: 1.3;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:first-child {
    margin-top: 0;
  }
`
}

/**
 * One styled component per heading level. A single dynamic-tag component is
 * not possible with goober (the tag is fixed at definition time), and the
 * level has to be a real `h1`-`h6` element for semantics and accessibility.
 */
const MarkdownHeading = {
  1: styled('h1')`
    font-size: ${HEADING_FONT_SIZES[1]};
    ${headingCss}
  `,
  2: styled('h2')`
    font-size: ${HEADING_FONT_SIZES[2]};
    ${headingCss}
  `,
  3: styled('h3')`
    font-size: ${HEADING_FONT_SIZES[3]};
    ${headingCss}
  `,
  4: styled('h4')`
    font-size: ${HEADING_FONT_SIZES[4]};
    ${headingCss}
  `,
  5: styled('h5')`
    font-size: ${HEADING_FONT_SIZES[5]};
    ${headingCss}
  `,
  6: styled('h6')`
    font-size: ${HEADING_FONT_SIZES[6]};
    ${headingCss}
  `,
}
MarkdownHeading[1].className = 'markdown-h1'
MarkdownHeading[2].className = 'markdown-h2'
MarkdownHeading[3].className = 'markdown-h3'
MarkdownHeading[4].className = 'markdown-h4'
MarkdownHeading[5].className = 'markdown-h5'
MarkdownHeading[6].className = 'markdown-h6'

const MarkdownParagraph = styled('p')`
  margin: ${() => currentTheme.value.spacing.medium.gap} 0 0 0;
  /* Preserve the author's line breaks and runs of spaces, matching the
     plain-text rendering this component replaces. */
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;

  &:first-child {
    margin-top: 0;
  }
`
MarkdownParagraph.className = 'markdown-paragraph'

const MarkdownCodeSpan = styled('code')`
  font-family: ${() => currentTheme.value.monotype.fontFamily};
  font-size: ${() => currentTheme.value.monotype.fontSize.medium};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  border-radius: ${() => currentTheme.value.border.radius.tiny};
  padding: 0 ${() => currentTheme.value.spacing.small.padding};
  overflow-wrap: break-word;
`
MarkdownCodeSpan.className = 'markdown-code-span'

const MarkdownCodeBlock = styled('div')`
  margin: ${() => currentTheme.value.spacing.medium.gap} 0 0 0;
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  border: ${() => currentTheme.value.border.width}
    ${() => currentTheme.value.border.style}
    ${() => currentTheme.value.colors.border.secondary};
  border-radius: ${() => currentTheme.value.border.radius.small};
  overflow: hidden;

  &:first-child {
    margin-top: 0;
  }
`
MarkdownCodeBlock.className = 'markdown-code-block'

// The header bar renders unconditionally, even for a bare fence with no info
// string: it is the copy button's home, so it cannot be conditional on the
// language label the way it was before the button existed. With no language the
// label side is simply empty and the button still sits at the far edge.
const MarkdownCodeLang = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  font-family: ${() => currentTheme.value.monotype.fontFamily};
  font-size: ${() => currentTheme.value.monotype.fontSize.small};
  color: ${() => currentTheme.value.colors.text.muted};
  padding: ${() => currentTheme.value.spacing.small.padding}
    ${() => currentTheme.value.spacing.medium.padding};
  border-bottom: ${() => currentTheme.value.border.width}
    ${() => currentTheme.value.border.style}
    ${() => currentTheme.value.colors.border.secondary};
`
MarkdownCodeLang.className = 'markdown-code-lang'

// Empty when the fence carries no info string, but always present so that
// `justify-content: space-between` keeps the button pinned to the far edge.
const MarkdownCodeLangLabel = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
MarkdownCodeLangLabel.className = 'markdown-code-lang-label'

const MarkdownPre = styled('pre')`
  margin: 0;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  overflow-x: auto;

  code {
    font-family: ${() => currentTheme.value.monotype.fontFamily};
    font-size: ${() => currentTheme.value.monotype.fontSize.medium};
    white-space: pre;
  }
`
MarkdownPre.className = 'markdown-pre'

const listCss = () => {
  const theme = currentTheme.value
  return `
  margin: ${theme.spacing.medium.gap} 0 0 0;
  padding-left: ${theme.spacing.large.padding};

  &:first-child {
    margin-top: 0;
  }

  /* A nested list hugs its parent item instead of opening a new block gap. */
  li > & {
    margin-top: 0;
  }
`
}

const MarkdownUnorderedList = styled('ul')`
  ${listCss}
`
MarkdownUnorderedList.className = 'markdown-ul'

const MarkdownOrderedList = styled('ol')`
  ${listCss}
`
MarkdownOrderedList.className = 'markdown-ol'

const MarkdownListItem = styled('li')`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
`
MarkdownListItem.className = 'markdown-li'

const MarkdownBlockquote = styled('blockquote')`
  margin: ${() => currentTheme.value.spacing.medium.gap} 0 0 0;
  padding-left: ${() => currentTheme.value.spacing.medium.padding};
  border-left: ${() => currentTheme.value.border.width}
    ${() => currentTheme.value.border.style}
    ${() => currentTheme.value.colors.border.primary};
  color: ${() => currentTheme.value.colors.text.secondary};

  &:first-child {
    margin-top: 0;
  }
`
MarkdownBlockquote.className = 'markdown-blockquote'

const MarkdownHr = styled('hr')`
  margin: ${() => currentTheme.value.spacing.medium.gap} 0 0 0;
  border: none;
  border-top: ${() => currentTheme.value.border.width}
    ${() => currentTheme.value.border.style}
    ${() => currentTheme.value.colors.border.secondary};
`
MarkdownHr.className = 'markdown-hr'

// A markdown table can be arbitrarily wide, and per `.claude/rules/client.md`
// wide content must scroll inside its own container rather than making the
// page body scroll horizontally. This wrapper is required, not decorative.
const MarkdownTableWrapper = styled('div')`
  margin: ${() => currentTheme.value.spacing.medium.gap} 0 0 0;
  overflow-x: auto;

  &:first-child {
    margin-top: 0;
  }
`
MarkdownTableWrapper.className = 'markdown-table-wrapper'

const MarkdownTable = styled('table')`
  border-collapse: collapse;
  /* auto rather than 100%: a wide table should overflow the wrapper (and
     scroll inside it) instead of being crushed to fit. */
  width: auto;
  max-width: 100%;
`
MarkdownTable.className = 'markdown-table'

const tableCellCss = () => {
  const theme = currentTheme.value
  return `
  padding: ${theme.spacing.small.padding} ${theme.spacing.medium.padding};
  border: ${theme.border.width} ${theme.border.style}
    ${theme.colors.border.secondary};
  text-align: left;
  overflow-wrap: break-word;
`
}

const MarkdownTh = styled('th')`
  ${tableCellCss}
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
`
MarkdownTh.className = 'markdown-th'

const MarkdownTd = styled('td')`
  ${tableCellCss}
`
MarkdownTd.className = 'markdown-td'

// A GFM task item drops the list marker in favour of its checkbox, matching
// the convention every markdown renderer uses for these.
const MarkdownTaskListItem = styled('li')`
  margin: 0;
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: ${() => currentTheme.value.spacing.small.gap};
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
`
MarkdownTaskListItem.className = 'markdown-task-li'

const MarkdownTaskCheckbox = styled('input')`
  margin: 0;
  /* Nudge the box onto the first line's baseline without hardcoding a size. */
  margin-top: ${() => currentTheme.value.spacing.tiny.gap};
  flex-shrink: 0;
`
MarkdownTaskCheckbox.className = 'markdown-task-checkbox'

const MarkdownLink = styled('a')`
  color: ${() => currentTheme.value.colors.primary.background};
  text-decoration: underline;
  overflow-wrap: break-word;
  word-break: break-word;

  &:hover {
    color: ${() => currentTheme.value.colors.primary.hover};
  }
`
MarkdownLink.className = 'markdown-link'

// Raw HTML from model-authored text is shown, never interpreted. The span
// exists only to carry whitespace preservation so the source reads as written.
const MarkdownRawHtml = styled('span')`
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
`
MarkdownRawHtml.className = 'markdown-raw-html'

// =========================================================================
// Link scheme hardening
// =========================================================================

/**
 * Schemes an `href` may carry and still reach a real anchor element.
 */
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto'])

/**
 * True when `href` is safe to place on an anchor: either relative (no scheme
 * at all — `/path`, `./path`, `path`, `#anchor`, or a scheme-relative
 * `//host/path`) or carrying one of `SAFE_SCHEMES`.
 *
 * This is the ONLY untrusted value that reaches a DOM attribute anywhere in
 * this component (see the no-HTML invariant in `markdown.mjs`), so the check
 * is written defensively against the standard bypasses:
 *
 *   - **Leading/trailing whitespace and embedded control characters.** Browsers
 *     strip ASCII whitespace and C0 controls out of a URL before resolving it,
 *     so ` javascript:x`, `java\nscript:x`, and `java\tscript:x` all navigate.
 *     Every character at or below U+0020, plus U+007F, is removed before the
 *     scheme is read — not merely trimmed from the ends.
 *   - **Mixed case.** `JaVaScRiPt:` is the same scheme; the comparison is
 *     lowercased.
 *   - **HTML entities.** `&#106;avascript:x` is rejected because the text
 *     before the colon is compared against the allowlist as a whole rather
 *     than pattern-matched, so anything that is not exactly one of the three
 *     permitted schemes fails. (Entities are never decoded on the way to the
 *     DOM either: Preact sets the attribute from the literal string.)
 *   - **A colon that is not a scheme separator.** `/a:b`, `./a:b`, and
 *     `#a:b` are relative references — a colon appearing after the first
 *     `/`, `?`, or `#` does not introduce a scheme, so those stay permitted.
 *
 * @param {unknown} href
 * @returns {boolean}
 */
export const isSafeHref = (href) => {
  if (typeof href !== 'string') return false

  // The class is U+0000-U+0020 plus U+007F: every ASCII whitespace and
  // control character a browser would silently drop while resolving the URL.
  const stripped = href.replace(/[\u0000-\u0020\u007f]/g, '')
  if (!stripped) return false

  const colon = stripped.indexOf(':')
  if (colon === -1) return true // no scheme at all — relative

  // A colon only introduces a scheme when it precedes the first path,
  // query, or fragment delimiter.
  const delimiter = stripped.search(/[/?#]/)
  if (delimiter !== -1 && delimiter < colon) return true

  return SAFE_SCHEMES.has(stripped.slice(0, colon).toLowerCase())
}

/**
 * True when a (already scheme-checked) href leaves this site, and so should
 * open in a new tab with `rel="noopener noreferrer"`.
 */
const isExternalHref = (href) => {
  const stripped = href.replace(/[\u0000-\u0020\u007f]/g, '')
  if (stripped.startsWith('//')) return true
  const colon = stripped.indexOf(':')
  if (colon === -1) return false
  const delimiter = stripped.search(/[/?#]/)
  if (delimiter !== -1 && delimiter < colon) return false
  return true
}

/**
 * Renders an anchor for a safe href, or the label as bare text for an unsafe
 * one — no anchor element at all, so there is nothing to click.
 */
const renderAnchor = (href, label, key) => {
  if (!isSafeHref(href)) {
    return html`<${MarkdownRawHtml} key=${key}>${label}</${MarkdownRawHtml}>`
  }
  const target = isExternalHref(href) ? '_blank' : undefined
  const rel = target ? 'noopener noreferrer' : undefined
  return html`<${MarkdownLink}
    key=${key}
    href=${href.trim()}
    target=${target}
    rel=${rel}
    >${label}</${MarkdownLink}
  >`
}

// =========================================================================
// Code block
// =========================================================================

/** How long the copy button shows its confirmation tick, in ms. */
const COPY_FEEDBACK_MS = 1500

/**
 * A fenced code block with a copy-to-clipboard button.
 *
 * This is a component rather than a bare factory return because the copy
 * confirmation needs state. The `code` arm delegates to it, so a caller
 * supplying `renderers.code` still replaces the whole thing — button included.
 *
 * @param {Object} props
 * @param {string} props.text - The code body. This, and only this, is what the
 *   copy button puts on the clipboard: never the language label or any
 *   surrounding prose.
 * @param {string} [props.lang] - The fence's info string. marked leaves it
 *   undefined for a bare fence and for indented code blocks.
 */
function MarkdownCodeBlockView({ text, lang }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  // Without this, copying and then unmounting (a chat log being cleared, a
  // streamed message being replaced) leaves a timer that setStates a dead
  // component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const handleCopy = useCallback(async () => {
    // `navigator.clipboard` is undefined in non-secure contexts, and
    // `writeText` rejects when the document lacks focus or permission. A copy
    // that cannot happen must leave the button usable rather than throwing
    // into the render tree or sticking in the confirmed state.
    try {
      if (!navigator?.clipboard?.writeText) return
      await navigator.clipboard.writeText(text ?? '')
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      setCopied(false)
    }
  }, [text])

  const label = typeof lang === 'string' ? lang.trim() : ''

  return html`<${MarkdownCodeBlock}>
    <${MarkdownCodeLang}>
      <${MarkdownCodeLangLabel}>${label}</${MarkdownCodeLangLabel}>
      <${Button}
        size="small"
        color="secondary"
        icon=${copied ? 'check' : 'copy'}
        title=${copied ? 'Copied' : 'Copy code'}
        onClick=${handleCopy}
      />
    </${MarkdownCodeLang}>
    <${MarkdownPre}><code>${text ?? ''}</code></${MarkdownPre}>
  </${MarkdownCodeBlock}>`
}

// =========================================================================
// Default renderers
// =========================================================================

/**
 * Renders a token's inline content: the walker-rendered `children` when the
 * token had nested tokens, otherwise its plain `text` string.
 */
const inlineContent = (children, text) =>
  children && children.length ? children : (text ?? '')

/**
 * @type {Record<string, (args: Object) => import('preact').VNode|null>}
 */
export const defaultRenderers = {
  heading: ({ depth, children, text, key }) => {
    const level = Math.min(Math.max(Number(depth) || 1, 1), 6)
    const Tag = MarkdownHeading[level]
    return html`<${Tag} key=${key}>${inlineContent(children, text)}</${Tag}>`
  },

  paragraph: ({ children, text, key }) =>
    html`<${MarkdownParagraph} key=${key}
      >${inlineContent(children, text)}</${MarkdownParagraph}
    >`,

  // A `text` token can itself carry nested tokens (list-item content does),
  // so it renders its children when it has them.
  text: ({ children, text, key }) =>
    children && children.length
      ? html`<span key=${key}>${children}</span>`
      : (text ?? ''),

  strong: ({ children, text, key }) =>
    html`<strong key=${key}>${inlineContent(children, text)}</strong>`,

  em: ({ children, text, key }) =>
    html`<em key=${key}>${inlineContent(children, text)}</em>`,

  del: ({ children, text, key }) =>
    html`<del key=${key}>${inlineContent(children, text)}</del>`,

  codespan: ({ text, key }) =>
    html`<${MarkdownCodeSpan} key=${key}>${text ?? ''}</${MarkdownCodeSpan}>`,

  code: ({ text, lang, key }) =>
    html`<${MarkdownCodeBlockView}
      key=${key}
      text=${text ?? ''}
      lang=${lang}
    />`,

  list: ({ ordered, start, children, key }) => {
    if (ordered) {
      // marked reports `start` as a number for ordered lists; only emit the
      // attribute when it actually shifts the numbering.
      const startAttr =
        typeof start === 'number' && start !== 1 ? start : undefined
      return html`<${MarkdownOrderedList} key=${key} start=${startAttr}
        >${children}</${MarkdownOrderedList}
      >`
    }
    return html`<${MarkdownUnorderedList} key=${key}
      >${children}</${MarkdownUnorderedList}
    >`
  },

  // Nested lists arrive as part of the item's own `tokens`, so rendering
  // `children` is all that is needed to recurse.
  //
  // A GFM task item (`- [x] done`) additionally carries `task: true` and
  // `checked`. It renders a disabled checkbox ahead of its content: the
  // markdown source is the state, so the box is a readout, never an input.
  // marked v18 also emits a separate `checkbox` token for the `[x] ` marker:
  // first in the item's `tokens` for a tight list, or first in its first
  // paragraph's `tokens` for a loose one. The `checkbox` arm below renders
  // that token as nothing, so this arm stays the only owner of the box.
  list_item: ({ children, text, task, checked, key }) => {
    const content = inlineContent(children, text)
    if (task) {
      return html`<${MarkdownTaskListItem} key=${key}>
        <${MarkdownTaskCheckbox}
          type="checkbox"
          checked=${checked === true}
          disabled
        />
        <span>${content}</span>
      </${MarkdownTaskListItem}>`
    }
    return html`<${MarkdownListItem} key=${key}
      >${content}</${MarkdownListItem}
    >`
  },

  // `list_item` owns the task checkbox (drawn from the item's `checked`), so
  // the token must render nothing. Without this arm the walker's raw fallback
  // prints a literal `[x] ` beside the box. Drawing the box here instead would
  // put it inside a `<p>` in a loose list and break the item's flex layout.
  checkbox: () => null,

  table: ({ header, rows, align, key, renderChildren }) => {
    // `table` is the one token whose nested tokens do not live on `tokens`:
    // each cell is its own `{ text, tokens }` object under `header` / `rows`.
    // `renderChildren` (supplied by the walker) recurses through them.
    const renderCell = (cell) => {
      if (!cell) return ''
      const kids =
        typeof renderChildren === 'function' && Array.isArray(cell.tokens)
          ? renderChildren(cell.tokens)
          : null
      return kids && kids.length ? kids : (cell.text ?? '')
    }

    // `align` is a per-column array of 'left' | 'center' | 'right' | null.
    // It applies to that column's header cell and every body cell alike.
    const alignments = Array.isArray(align) ? align : []
    const cellStyle = (column) =>
      alignments[column] ? { textAlign: alignments[column] } : undefined

    const headerCells = (Array.isArray(header) ? header : []).map(
      (cell, column) =>
        html`<${MarkdownTh} key=${`th-${column}`} style=${cellStyle(column)}
          >${renderCell(cell)}</${MarkdownTh}
        >`,
    )

    const bodyRows = (Array.isArray(rows) ? rows : []).map((row, rowIndex) => {
      const cells = (Array.isArray(row) ? row : []).map(
        (cell, column) =>
          html`<${MarkdownTd} key=${`td-${column}`} style=${cellStyle(column)}
            >${renderCell(cell)}</${MarkdownTd}
          >`,
      )
      return html`<tr key=${`tr-${rowIndex}`}>
        ${cells}
      </tr>`
    })

    return html`<${MarkdownTableWrapper} key=${key}>
      <${MarkdownTable}>
        <thead>
          <tr>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </${MarkdownTable}>
    </${MarkdownTableWrapper}>`
  },

  // THE load-bearing safety arm. Raw HTML in the source — whether an inline
  // `<b>` or a whole `<script>alert(1)</script>` block — is shown as literal
  // visible text and is NEVER interpreted as markup. The token's text reaches
  // the DOM as a Preact text child, which Preact escapes on the way in; there
  // is no `dangerouslySetInnerHTML` and no escape-then-inject step to get
  // wrong. Do not "improve" this arm into rendering the markup.
  html: ({ text, raw, key }) =>
    html`<${MarkdownRawHtml} key=${key}>${text ?? raw ?? ''}</${MarkdownRawHtml}
    >`,

  link: ({ href, children, text, key }) =>
    renderAnchor(href, inlineContent(children, text), key),

  // DELIBERATE SEAM — images render as LINKS, not `<img>` elements.
  //
  // An `<img>` whose `src` comes from model-authored text fires a remote HTTP
  // request the moment it renders, leaking the page visit plus the viewer's IP
  // and user agent to a host the user never chose to contact. So the image is
  // surfaced as a link the user can choose to follow instead.
  //
  // This decision is EXPECTED TO BE REVISITED, and is confined entirely to
  // this one arm on purpose: switching to inline image rendering is an edit to
  // these few lines, or a caller-supplied `renderers.image` override — never a
  // refactor. Keep it that way; do not let image policy leak into the walker,
  // the component, or any other arm.
  image: ({ href, text, key }) => {
    const label = typeof text === 'string' && text.trim() ? text : (href ?? '')
    return renderAnchor(href, label, key)
  },

  blockquote: ({ children, text, key }) =>
    html`<${MarkdownBlockquote} key=${key}
      >${inlineContent(children, text)}</${MarkdownBlockquote}
    >`,

  hr: ({ key }) => html`<${MarkdownHr} key=${key} />`,

  br: ({ key }) => html`<br key=${key} />`,

  // Block separation is handled by block margins, so the separator token
  // itself renders nothing.
  space: () => null,
}
