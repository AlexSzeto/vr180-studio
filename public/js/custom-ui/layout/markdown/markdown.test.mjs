/**
 * Tests for the Markdown component's default renderer arms.
 *
 * Each case asserts that a snippet of markdown source reaches the DOM as the
 * expected element with the expected text — the contract callers rely on when
 * they drop `Markdown` into a chat bubble or a panel.
 */
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact'
import { html } from 'htm/preact'
import { Markdown } from './markdown.mjs'

afterEach(() => cleanup())

const renderMarkdown = (content, props = {}) =>
  render(html`<${Markdown} content=${content} ...${props} />`)

describe('Markdown default renderers', () => {
  test('renders a heading', () => {
    const { container } = renderMarkdown('## Title')
    const heading = container.querySelector('h2')
    expect(heading).not.toBeNull()
    expect(heading.textContent).toContain('Title')
  })

  test('renders strong emphasis', () => {
    const { container } = renderMarkdown('**b**')
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong.textContent).toBe('b')
  })

  test('renders italic emphasis', () => {
    const { container } = renderMarkdown('*i*')
    const em = container.querySelector('em')
    expect(em).not.toBeNull()
    expect(em.textContent).toBe('i')
  })

  test('renders strikethrough', () => {
    const { container } = renderMarkdown('~~s~~')
    const del = container.querySelector('del')
    expect(del).not.toBeNull()
    expect(del.textContent).toBe('s')
  })

  test('renders an inline code span', () => {
    const { container } = renderMarkdown('`c`')
    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code.textContent).toBe('c')
  })

  test('renders a fenced code block with its language label', () => {
    const { container, getByText } = renderMarkdown('```js\nconst a = 1\n```')
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    const code = pre.querySelector('code')
    expect(code).not.toBeNull()
    expect(code.textContent).toBe('const a = 1')
    // The info string is surfaced as a visible label outside the <pre>.
    const label = getByText('js')
    expect(label).not.toBeNull()
    expect(pre.contains(label)).toBe(false)
  })

  test('renders a bullet list with one li per item', () => {
    const { container } = renderMarkdown('- one\n- two')
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toContain('one')
    expect(items[1].textContent).toContain('two')
  })

  test('renders a nested list inside its parent list item', () => {
    const { container } = renderMarkdown('- one\n  - nested')
    const nested = container.querySelector('li ul')
    expect(nested).not.toBeNull()
    expect(nested.textContent).toContain('nested')
  })

  test('renders an ordered list as an ol', () => {
    const { container } = renderMarkdown('1. a\n2. b')
    expect(container.querySelector('ol')).not.toBeNull()
    expect(container.querySelectorAll('ol > li').length).toBe(2)
  })

  test('renders a blockquote', () => {
    const { container } = renderMarkdown('> quoted')
    const quote = container.querySelector('blockquote')
    expect(quote).not.toBeNull()
    expect(quote.textContent).toContain('quoted')
  })

  test('renders a thematic break as an hr', () => {
    const { container } = renderMarkdown('a\n\n---\n\nb')
    expect(container.querySelector('hr')).not.toBeNull()
  })

  test('renders a paragraph', () => {
    const { container } = renderMarkdown('just text')
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    expect(p.textContent).toBe('just text')
  })

  test('renders empty content without error', () => {
    const { container } = renderMarkdown('   ')
    expect(container.querySelector('.markdown-root, div')).not.toBeNull()
    expect(container.textContent.trim()).toBe('')
  })
})

/**
 * Reads a declared CSS property for an element, preferring the computed style
 * and falling back to a scan of the injected goober rules for the element's
 * own classes. jsdom's cascade support for injected stylesheets is partial,
 * so the fallback keeps the assertion about real emitted CSS rather than
 * about an inline style the component does not use.
 */
const declaredStyle = (el, property) => {
  const computed = getComputedStyle(el).getPropertyValue(property)
  if (computed) return computed.trim()

  const classes = Array.from(el.classList)
  for (const sheet of Array.from(document.styleSheets)) {
    let rules
    try {
      rules = Array.from(sheet.cssRules || [])
    } catch {
      continue
    }
    for (const rule of rules) {
      if (!rule.selectorText || !rule.style) continue
      const matches = classes.some((cls) =>
        rule.selectorText.split(',').some((sel) => sel.trim() === `.${cls}`),
      )
      if (!matches) continue
      const value = rule.style.getPropertyValue(property)
      if (value) return value.trim()
    }
  }
  return ''
}

describe('Markdown tables', () => {
  test('renders a pipe table with the right cell text', () => {
    const { container } = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')
    const table = container.querySelector('table')
    expect(table).not.toBeNull()

    const headers = table.querySelectorAll('thead th')
    expect(Array.from(headers).map((th) => th.textContent.trim())).toEqual([
      'a',
      'b',
    ])

    const cells = table.querySelectorAll('tbody td')
    expect(Array.from(cells).map((td) => td.textContent.trim())).toEqual([
      '1',
      '2',
    ])
  })

  test('wraps the table in an overflow-x: auto container', () => {
    const { container } = renderMarkdown('| a |\n| --- |\n| 1 |')
    const table = container.querySelector('table')
    const wrapper = table.parentElement
    expect(wrapper).not.toBeNull()
    expect(declaredStyle(wrapper, 'overflow-x')).toBe('auto')
  })

  test('applies the alignment row to the matching columns', () => {
    const { container } = renderMarkdown(
      '| l | c | r |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |',
    )
    const headers = container.querySelectorAll('thead th')
    expect(Array.from(headers).map((th) => th.style.textAlign)).toEqual([
      'left',
      'center',
      'right',
    ])
    const cells = container.querySelectorAll('tbody td')
    expect(Array.from(cells).map((td) => td.style.textAlign)).toEqual([
      'left',
      'center',
      'right',
    ])
  })
})

describe('Markdown task lists', () => {
  test('renders a checked task item as a checked disabled checkbox', () => {
    const { container } = renderMarkdown('- [x] done')
    const box = container.querySelector('input[type="checkbox"]')
    expect(box).not.toBeNull()
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
    const li = container.querySelector('li')
    expect(li.textContent).toContain('done')
    expect(li.textContent).not.toContain('[x]')
    expect(li.textContent).not.toContain('[ ]')
    expect(li.querySelectorAll('input[type="checkbox"]').length).toBe(1)
  })

  test('renders an unchecked task item as an unchecked disabled checkbox', () => {
    const { container } = renderMarkdown('- [ ] todo')
    const box = container.querySelector('input[type="checkbox"]')
    expect(box).not.toBeNull()
    expect(box.checked).toBe(false)
    expect(box.disabled).toBe(true)
    const li = container.querySelector('li')
    expect(li.textContent).toContain('todo')
    expect(li.textContent).not.toContain('[x]')
    expect(li.textContent).not.toContain('[ ]')
    expect(li.querySelectorAll('input[type="checkbox"]').length).toBe(1)
  })

  test('renders loose-list task items with one checkbox each and no marker text', () => {
    const { container } = renderMarkdown('- [x] one\n\n- [ ] two')
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(2)
    const expected = [true, false]
    items.forEach((li, i) => {
      const boxes = li.querySelectorAll('input[type="checkbox"]')
      expect(boxes.length).toBe(1)
      expect(boxes[0].checked).toBe(expected[i])
      expect(li.textContent).not.toContain('[x]')
      expect(li.textContent).not.toContain('[ ]')
    })
  })

  test('leaves a non-task list item without a checkbox', () => {
    const { container } = renderMarkdown('- plain')
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('li').textContent).toContain('plain')
  })
})

describe('Markdown safety', () => {
  test('renders a script tag as visible text and creates no script element', () => {
    const { container } = renderMarkdown('<script>alert(1)</script>')
    // Visible as literal source...
    expect(container.textContent).toContain('<script>alert(1)</script>')
    // ...and nothing was interpreted as markup.
    expect(container.querySelector('script')).toBeNull()
  })

  test('renders an image as an anchor and never an img element', () => {
    const { container } = renderMarkdown('![alt](https://x.com/a.png)')
    expect(container.querySelector('img')).toBeNull()
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor.getAttribute('href')).toBe('https://x.com/a.png')
    expect(anchor.textContent.trim()).toBe('alt')
  })

  test('an image with empty alt text falls back to showing its href', () => {
    const { container } = renderMarkdown('![](https://x.com/a.png)')
    expect(container.querySelector('img')).toBeNull()
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor.textContent.trim()).toBe('https://x.com/a.png')
  })

  test('a javascript: href renders its text with no anchor element', () => {
    const { container } = renderMarkdown('[x](javascript:alert(1))')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('x')
  })

  test('a mixed-case JaVaScRiPt: href renders no anchor element', () => {
    const { container } = renderMarkdown('[x](JaVaScRiPt:alert(1))')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('x')
  })

  test('a javascript: href with leading whitespace renders no anchor element', () => {
    const { container } = renderMarkdown('[x](<  javascript:alert(1)>)')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('x')
  })

  test('a data: href renders no anchor element', () => {
    const { container } = renderMarkdown('[x](data:text/html,<b>hi</b>)')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('x')
  })

  test('an https: href renders an anchor that opens safely in a new tab', () => {
    const { container } = renderMarkdown('[x](https://x.com)')
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor.getAttribute('href')).toBe('https://x.com')
    expect(anchor.getAttribute('target')).toBe('_blank')
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('a relative href renders an anchor', () => {
    const { container } = renderMarkdown('[x](/foo)')
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor.getAttribute('href')).toBe('/foo')
    expect(anchor.getAttribute('target')).toBeNull()
  })

  test('a mailto: href renders an anchor', () => {
    const { container } = renderMarkdown('[x](mailto:a@b.com)')
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor.getAttribute('href')).toBe('mailto:a@b.com')
  })
})

describe('Markdown renderer overrides', () => {
  test('a heading-only override replaces that arm and leaves paragraph default', () => {
    const calls = []
    const renderers = {
      heading: ({ depth, children, key }) => {
        calls.push(depth)
        return html`<div data-testid="custom-heading" key=${key}>
          ${children}
        </div>`
      },
    }

    const { container, getByTestId } = renderMarkdown('## Title\n\nBody text', {
      renderers,
    })

    // The override ran instead of the default heading arm.
    expect(calls).toEqual([2])
    expect(getByTestId('custom-heading').textContent).toContain('Title')
    expect(container.querySelector('h2')).toBeNull()

    // The un-overridden paragraph arm is untouched.
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    expect(p.textContent).toBe('Body text')
  })
})

describe('Markdown code block copy button', () => {
  const CODE = 'const a = 1\nconst b = 2'

  /** Installs a stub clipboard and returns the writeText spy. */
  const stubClipboard = (impl) => {
    const writeText = vi.fn(impl ?? (() => Promise.resolve()))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    return writeText
  }

  const copyButton = (container) =>
    container.querySelector('.markdown-code-lang button')

  afterEach(() => {
    delete navigator.clipboard
  })

  test('renders the copy button alongside the language label', () => {
    const { container, getByText } = renderMarkdown('```js\n' + CODE + '\n```')
    expect(getByText('js')).not.toBeNull()
    expect(copyButton(container)).not.toBeNull()
  })

  test('renders the copy button for a bare fence with no language', () => {
    const { container } = renderMarkdown('```\n' + CODE + '\n```')
    // The header bar must exist even with no info string, or the button has
    // nowhere to live.
    expect(container.querySelector('.markdown-code-lang')).not.toBeNull()
    expect(copyButton(container)).not.toBeNull()
    expect(
      container.querySelector('.markdown-code-lang-label').textContent,
    ).toBe('')
  })

  test('copies exactly the code body, without the language label', async () => {
    const writeText = stubClipboard()
    const { container } = renderMarkdown('```js\n' + CODE + '\n```')
    fireEvent.click(copyButton(container))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith(CODE)
    // Belt and braces: the label must not have leaked into the payload.
    expect(writeText.mock.calls[0][0]).not.toContain('js')
  })

  test('shows a confirmation state after a successful copy', async () => {
    stubClipboard()
    const { container } = renderMarkdown('```js\n' + CODE + '\n```')
    const before = copyButton(container).getAttribute('title')
    expect(before).toBe('Copy code')
    fireEvent.click(copyButton(container))
    await waitFor(() =>
      expect(copyButton(container).getAttribute('title')).toBe('Copied'),
    )
  })

  test('a rejected clipboard write does not throw and leaves the button usable', async () => {
    const writeText = stubClipboard(() => Promise.reject(new Error('denied')))
    const { container } = renderMarkdown('```js\n' + CODE + '\n```')
    fireEvent.click(copyButton(container))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    // Never enters the confirmed state, and the button is still clickable.
    expect(copyButton(container).getAttribute('title')).toBe('Copy code')
    expect(copyButton(container).disabled).toBe(false)
  })

  test('a missing clipboard API is a no-op rather than an error', () => {
    delete navigator.clipboard
    const { container } = renderMarkdown('```js\n' + CODE + '\n```')
    expect(() => fireEvent.click(copyButton(container))).not.toThrow()
    expect(copyButton(container).getAttribute('title')).toBe('Copy code')
  })
})
