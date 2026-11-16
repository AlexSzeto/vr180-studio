/**
 * Baseline smoke tests for custom-ui components.
 *
 * Each test renders the component with minimal props and asserts:
 *   1. No console.error was called (Preact validates prop types and misuse here)
 *   2. No uncaught exception during render
 */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/preact'
import { html } from 'htm/preact'

afterEach(() => cleanup())

/** Console warns emitted under one logger source, e.g. `[input]`. */
const warnsFrom = (spy, source) =>
  spy.mock.calls.filter((args) => String(args[0]).startsWith(`[${source}]`))

// ── Simple layout / io components ─────────────────────────────────────────

import { Button } from './io/button.mjs'
import { TooltipProvider } from './overlays/tooltip.mjs'

describe('Button', () => {
  test('renders a text button without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button}>Click me</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders a small icon-only button without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} size="small" icon="check" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders disabled state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} disabled=${true}>Disabled</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders loading state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} loading=${true}>Loading</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test.each(['tiny', 'small', 'medium', 'large'])(
    'renders an icon-only button at size="%s" without errors',
    (size) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(html`<${Button} size=${size} icon="check" />`)
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test('a legacy variant logs exactly one warn naming its replacement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(html`<${Button} variant="small-text">Legacy</${Button}>`)
    const buttonWarns = warn.mock.calls.filter((args) =>
      String(args[0]).startsWith('[button]'),
    )
    expect(buttonWarns).toHaveLength(1)
    expect(buttonWarns[0][0]).toContain('size="small"')
    warn.mockRestore()
  })

  test('heightScale logs a warn and does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      render(html`<${Button} heightScale="compact">Old</${Button}>`),
    ).not.toThrow()
    const buttonWarns = warn.mock.calls.filter((args) =>
      String(args[0]).startsWith('[button]'),
    )
    expect(buttonWarns.length).toBeGreaterThan(0)
    expect(buttonWarns[0][0]).toContain('heightScale')
    warn.mockRestore()
  })

  test('icon plus children renders both the icon and the text', () => {
    const { container } = render(html`<${Button} icon="save">Save</${Button}>`)
    expect(container.querySelector('.material-symbols-outlined')).not.toBeNull()
    expect(container.textContent).toContain('Save')
  })

  test('icon without children renders an icon-only button with no text', () => {
    const { container } = render(html`<${Button} icon="check" />`)
    const button = container.querySelector('button')
    expect(button.querySelector('.material-symbols-outlined')).not.toBeNull()
    expect(button.querySelector('.text-span')).toBeNull()
  })

  test('a disabled button with a tooltip shows it on hovering its wrapper', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { container } = render(html`
        <${TooltipProvider}>
          <${Button} disabled=${true} tooltip="x">Go</${Button}>
        </${TooltipProvider}>
      `)
      const wrapper = container.querySelector('.button-tooltip-wrapper')
      expect(wrapper).not.toBeNull()
      expect(wrapper.querySelector('button').disabled).toBe(true)

      fireEvent.mouseEnter(wrapper, { clientX: 10, clientY: 10 })
      await vi.advanceTimersByTimeAsync(700)
      expect(
        document.getElementById('custom-ui-tooltip-box')?.textContent,
      ).toBe('x')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  test('an enabled button with a tooltip renders no wrapper', () => {
    const { container } = render(html`
      <${TooltipProvider}>
        <${Button} tooltip="x">Go</${Button}>
      </${TooltipProvider}>
    `)
    expect(container.querySelector('.button-tooltip-wrapper')).toBeNull()
  })
})

// ── Input ─────────────────────────────────────────────────────────────────

import { Input } from './io/input.mjs'

describe('Input', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Input} value="" onInput=${() => {}} placeholder="Type here" />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with buttonProps without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Input}
        label="With button"
        widthScale="full"
        value=""
        onInput=${() => {}}
        buttonProps=${{ icon: 'captions', title: 'Generate', onClick: () => {} }}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('widthScale="auto" logs exactly one [input] warn, even across re-renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rerender } = render(
      html`<${Input} widthScale="auto" value="" onInput=${() => {}} />`,
    )
    rerender(html`<${Input} widthScale="auto" value="x" onInput=${() => {}} />`)
    const inputWarns = warnsFrom(warn, 'input')
    expect(inputWarns).toHaveLength(1)
    expect(inputWarns[0][0]).toContain('widthScale="auto"')
    warn.mockRestore()
  })

  test('a tooltip prop outside a TooltipProvider does not throw or console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(html`
        <${Input}
          label="Temperature"
          tooltip="Higher values make output more random."
          value=""
          onInput=${() => {}}
        />
      `),
    ).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Textarea ─────────────────────────────────────────────────────────────

import { Textarea } from './io/textarea.mjs'

describe('Textarea', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Textarea}
        value=""
        onInput=${() => {}}
        placeholder="Type here"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with a two-button buttonProps array without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Textarea}
        widthScale="full"
        value=""
        onInput=${() => {}}
        buttonProps=${[
          {
            icon: 'list-plus',
            color: 'secondary',
            title: 'Queue',
            onClick: () => {},
          },
          {
            icon: 'play',
            color: 'primary',
            title: 'Send',
            onClick: () => {},
          },
        ]}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── AutocompleteInput ────────────────────────────────────────────────────

import { AutocompleteInput } from './io/autocomplete-input.mjs'

describe('AutocompleteInput', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${AutocompleteInput}
        suggestions=${['a', 'b']}
        value=""
        onValueChange=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders the browse-all button by default when suggestions exist', () => {
    const { queryAllByTitle } = render(
      html`<${AutocompleteInput}
        suggestions=${['a', 'b']}
        value=""
        onValueChange=${() => {}}
      />`,
    )
    expect(queryAllByTitle('Browse all options')).toHaveLength(1)
  })

  test('showSearch=false hides the browse-all button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { queryAllByTitle } = render(
      html`<${AutocompleteInput}
        suggestions=${['a', 'b']}
        value=""
        onValueChange=${() => {}}
        showSearch=${false}
      />`,
    )
    expect(queryAllByTitle('Browse all options')).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Checkbox ──────────────────────────────────────────────────────────────

import { Checkbox } from './io/checkbox.mjs'

describe('Checkbox', () => {
  test('renders unchecked without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Checkbox} checked=${false} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders checked without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Checkbox} checked=${true} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('widthScale="normal" renders at 160px without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${Checkbox}
        label="Loop"
        widthScale="normal"
        onChange=${() => {}}
      />`,
    )
    const row = container.querySelector('.container')
    expect(getComputedStyle(row).width).toBe('160px')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('a labeled checkbox with no widthScale still grows to fill its row', () => {
    const { container } = render(
      html`<${Checkbox} label="Loop" onChange=${() => {}} />`,
    )
    const row = container.querySelector('.container')
    expect(getComputedStyle(row).flexGrow).toBe('1')
  })

  test.each(['tiny', 'small', 'medium', 'large'])(
    'renders a labeled checkbox at size="%s" without errors',
    (size) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        html`<${Checkbox}
          size=${size}
          label="Loop"
          checked=${true}
          onChange=${() => {}}
        />`,
      )
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test('medium (the default) keeps the 22px box', () => {
    const { container } = render(
      html`<${Checkbox} label="Loop" onChange=${() => {}} />`,
    )
    const box = container.querySelector('.checkbox-visual')
    expect(getComputedStyle(box).width).toBe('22px')
    expect(getComputedStyle(box).height).toBe('22px')
  })

  test('an invalid size logs a [checkbox] warn and renders at medium', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      html`<${Checkbox} size="huge" label="Loop" onChange=${() => {}} />`,
    )
    expect(warnsFrom(warn, 'checkbox')).toHaveLength(1)
    const box = container.querySelector('.checkbox-visual')
    expect(getComputedStyle(box).width).toBe('22px')
    warn.mockRestore()
  })
})

// ── Panel ─────────────────────────────────────────────────────────────────

import { Panel } from './layout/panel.mjs'

describe('Panel', () => {
  test('renders default variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Panel}>Content</${Panel}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders elevated variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Panel} variant="elevated">Content</${Panel}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('padding="tiny" renders 2px of padding', () => {
    const { container } = render(
      html`<${Panel} padding="tiny">Content</${Panel}>`,
    )
    expect(getComputedStyle(container.firstElementChild).padding).toBe('2px')
  })

  test('an unknown padding warns and falls back to medium (8px)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      html`<${Panel} padding="bogus">Content</${Panel}>`,
    )
    expect(warnsFrom(warn, 'panel').length).toBeGreaterThan(0)
    expect(getComputedStyle(container.firstElementChild).padding).toBe('8px')
    warn.mockRestore()
  })
})

// ── Markdown ──────────────────────────────────────────────────────────────

import { Markdown } from './layout/markdown/markdown.mjs'

describe('Markdown', () => {
  test('renders a plain paragraph without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Markdown} content="Hello **world**" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders empty content without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Markdown} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Icon ──────────────────────────────────────────────────────────────────

import { Icon } from './layout/icon.mjs'

describe('Icon', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Icon} name="check" size="24px" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('standard mapped Material Symbols continue rendering their text glyph', () => {
    const { container } = render(html`<${Icon} name="check" />`)
    const span = container.querySelector('.material-symbols-outlined')
    expect(span).not.toBeNull()
    expect(span.textContent).toBe('check')
    expect(container.querySelector('box-icon')).toBeNull()
  })

  test('an unmapped name renders the empty placeholder', () => {
    const { container } = render(
      html`<${Icon} name="unmapped-name-for-testing" size="18px" />`,
    )
    expect(container.querySelector('box-icon')).toBeNull()
    expect(container.querySelector('.material-symbols-outlined')).toBeNull()
    const placeholder = container.querySelector('span')
    expect(placeholder).not.toBeNull()
    expect(placeholder.textContent).toBe('')
    expect(placeholder.getAttribute('aria-label')).toBe(
      'unmapped-name-for-testing',
    )
    expect(placeholder.style.display).toBe('inline-block')
    expect(placeholder.style.width).toBe('18px')
    expect(placeholder.style.height).toBe('18px')
  })
})

// ── Themed base layout helpers ────────────────────────────────────────────

import { HorizontalLayout, VerticalLayout, RowTitle } from './themed-base.mjs'
import { CONTROL_SIZES, getControlSize, getRowTitleSize } from './theme.mjs'

describe('Layout helpers', () => {
  test('HorizontalLayout renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${HorizontalLayout}><span>A</span><span>B</span></${HorizontalLayout}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('VerticalLayout renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${VerticalLayout}><span>A</span></${VerticalLayout}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('HorizontalLayout gap="tiny" renders a 2px gap', () => {
    const { container } = render(
      html`<${HorizontalLayout} gap="tiny"><span>A</span><span>B</span></${HorizontalLayout}>`,
    )
    expect(getComputedStyle(container.firstElementChild).gap).toBe('2px')
  })

  test('HorizontalLayout with an unknown gap warns and falls back to medium (8px)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      html`<${HorizontalLayout} gap="bogus"><span>A</span><span>B</span></${HorizontalLayout}>`,
    )
    expect(warnsFrom(warn, 'horizontal-layout').length).toBeGreaterThan(0)
    expect(getComputedStyle(container.firstElementChild).gap).toBe('8px')
    warn.mockRestore()
  })

  test('HorizontalLayout renders with gap="none" without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${HorizontalLayout} gap="none"><span>A</span><span>B</span></${HorizontalLayout}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('VerticalLayout renders with gap="none" without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${VerticalLayout} gap="none"><span>A</span></${VerticalLayout}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('VerticalLayout renders with justifyContent="flex-end" without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${VerticalLayout} justifyContent="flex-end"><span>A</span></${VerticalLayout}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('HorizontalLayout renders with fitContent without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${HorizontalLayout} fitContent><span>A</span><span>B</span></${HorizontalLayout}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('RowTitle', () => {
  test.each(['title', 'text'])(
    'variant="%s" renders without errors',
    (variant) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        html`<${RowTitle} size="small" variant=${variant}>Parts</${RowTitle}>`,
      )
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test('height matches the control height at every size', () => {
    const theme = currentTheme.value
    for (const size of CONTROL_SIZES) {
      expect(getRowTitleSize(theme, size).height).toBe(
        getControlSize(theme, size).height,
      )
    }
  })

  test('an unknown size falls back to medium', () => {
    const theme = currentTheme.value
    expect(getRowTitleSize(theme, 'bogus')).toEqual(
      getRowTitleSize(theme, 'medium'),
    )
  })
})

// ── Slider ────────────────────────────────────────────────────────────────

import { Slider } from './io/slider.mjs'

describe('Slider', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Slider} min=${0} max=${100} value=${50} onChange=${() => {}} />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  test('medium (the default) keeps the 28px track row', () => {
    const { container } = render(
      html`<${Slider} value=${50} onChange=${() => {}} />`,
    )
    const row = container.querySelector('.slider-track-container')
    expect(getComputedStyle(row).height).toBe('28px')
  })
})

// ── Slider family sizes ───────────────────────────────────────────────────
// RangeSlider and DiscreteSlider are imported with the validation tests below;
// ES module imports are hoisted, so they are available here.

describe.each([
  ['Slider', 'slider', () => Slider, {}],
  ['RangeSlider', 'range-slider', () => RangeSlider, {}],
  [
    'DiscreteSlider',
    'discrete-slider',
    () => DiscreteSlider,
    { options: ['a', 'b', 'c'], value: 'b' },
  ],
])('%s size', (_name, source, getComponent, extra) => {
  test.each(['tiny', 'small', 'medium', 'large'])(
    'renders at size="%s" without errors',
    (size) => {
      const C = getComponent()
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        html`<${C}
          size=${size}
          label="Level"
          onChange=${() => {}}
          ...${extra}
        />`,
      )
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test(`an invalid size logs a [${source}] warn and falls back to medium`, () => {
    const C = getComponent()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(html`<${C} size="huge" onChange=${() => {}} ...${extra} />`)
    expect(warnsFrom(warn, source)).toHaveLength(1)
    warn.mockRestore()
  })
})

// ── ToggleSwitch ──────────────────────────────────────────────────────────

import { ToggleSwitch } from './io/toggle-switch.mjs'

describe('ToggleSwitch', () => {
  test('renders off state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${ToggleSwitch} checked=${false} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('widthScale="normal" renders at 160px without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${ToggleSwitch}
        label="Loop"
        widthScale="normal"
        onChange=${() => {}}
      />`,
    )
    const row = container.querySelector('.toggle-switch-label')
    expect(getComputedStyle(row).width).toBe('160px')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test.each(['tiny', 'small', 'medium', 'large'])(
    'renders a labeled switch at size="%s" without errors',
    (size) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        html`<${ToggleSwitch}
          size=${size}
          label="Loop"
          checked=${true}
          onChange=${() => {}}
        />`,
      )
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test('medium (the default) keeps the 42x22 track and knob positions', () => {
    const { container, rerender } = render(
      html`<${ToggleSwitch} checked=${false} onChange=${() => {}} />`,
    )
    const track = container.querySelector('.toggle-switch-track')
    expect(getComputedStyle(track).width).toBe('42px')
    expect(getComputedStyle(track).height).toBe('22px')
    expect(getComputedStyle(track).borderRadius).toBe('12px')
    const knob = container.querySelector('.toggle-switch-knob')
    expect(getComputedStyle(knob).top).toBe('2px')
    expect(getComputedStyle(knob).left).toBe('2px')
    rerender(html`<${ToggleSwitch} checked=${true} onChange=${() => {}} />`)
    expect(
      getComputedStyle(container.querySelector('.toggle-switch-knob')).left,
    ).toBe('22px')
  })

  test('an invalid size logs a [toggle-switch] warn and renders at medium', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      html`<${ToggleSwitch} size="huge" onChange=${() => {}} />`,
    )
    expect(warnsFrom(warn, 'toggle-switch')).toHaveLength(1)
    const track = container.querySelector('.toggle-switch-track')
    expect(getComputedStyle(track).width).toBe('42px')
    warn.mockRestore()
  })
})

// ── AudioPlayer demo usages (mirrors test.html) ───────────────────────────

import { AudioPlayer } from './media/audio-player.mjs'

describe('AudioPlayer (test.html usages)', () => {
  test('renders as overlay on album art without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <div style="position: relative; width: 300px; height: 150px;">
        <img
          src="/js/custom-ui/demo/sample-album-cover-1.jpg"
          style="width: 100%; height: 100%; object-fit: cover;"
        />
        <div
          style="position: absolute; bottom: 0; left: 0; right: 0; padding: 8px;"
        >
          <${AudioPlayer}
            audioUrl="/js/custom-ui/demo/sample-music-track-1.mp3"
          />
        </div>
      </div>
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders standalone full-width without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${AudioPlayer}
        audioUrl="/js/custom-ui/demo/sample-music-track-3.mp3"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders normal widthScale without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${AudioPlayer}
        widthScale="normal"
        audioUrl="/js/custom-ui/demo/sample-music-track-4.mp3"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with loop without errors, and play passes loop to the shared player', async () => {
    const { globalAudioPlayer } = await import('./global-audio-player.mjs')
    const toggle = vi
      .spyOn(globalAudioPlayer, 'toggle')
      .mockImplementation(() => {})
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${AudioPlayer}
        loop=${true}
        audioUrl="/js/custom-ui/demo/sample-music-track-1.mp3"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('button'))
    expect(toggle).toHaveBeenCalledWith(
      '/js/custom-ui/demo/sample-music-track-1.mp3',
      null,
      expect.anything(),
      0,
      { loop: true },
    )
    spy.mockRestore()
    toggle.mockRestore()
  })
})

// ── Select ────────────────────────────────────────────────────────────────

import { Select } from './io/select.mjs'

describe('Select', () => {
  const opts = [
    { label: 'One', value: '1' },
    { label: 'Two', value: '2' },
  ]

  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Select} options=${opts} value="1" onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('widthScale="auto" renders with no warn and no console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      html`<${Select}
        widthScale="auto"
        options=${opts}
        value="1"
        onChange=${() => {}}
      />`,
    )
    expect(warnsFrom(warn, 'select')).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
    warn.mockRestore()
    spy.mockRestore()
  })

  test('renders with label and validation without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Select}
        label="Type"
        options=${opts}
        validation=${{ status: 'invalid', message: 'Required' }}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with buttonProps without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Select}
        label="With button"
        options=${opts}
        value="1"
        onChange=${() => {}}
        buttonProps=${{ icon: 'info', title: 'View', onClick: () => {} }}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders options with tooltip without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Select}
        options=${[
          { label: 'One', value: '1', tooltip: 'The first option' },
          { label: 'Two', value: '2', tooltip: 'The second option' },
        ]}
        value="1"
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with a disabled option without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Select}
        options=${[
          { label: 'One', value: '1' },
          { label: 'Two', value: '2', disabled: true },
        ]}
        value="1"
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── MultiSelect ────────────────────────────────────────────────────────────

import { MultiSelect } from './io/multi-select.mjs'

describe('MultiSelect', () => {
  test('widthScale="compact" renders at 80px', () => {
    const { container } = render(
      html`<${MultiSelect}
        widthScale="compact"
        options=${[{ label: 'A', value: 'A' }]}
        value=${[]}
        onChange=${() => {}}
      />`,
    )
    const wrapper = container.querySelector('.multi-select-wrapper')
    expect(getComputedStyle(wrapper).width).toBe('80px')
  })

  test('renders with empty selection without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${MultiSelect}
        options=${[
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ]}
        value=${[]}
        onChange=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with pre-selected values and label without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        label="Keys"
        options=${[
          { label: 'C major', value: 'C major' },
          { label: 'A minor', value: 'A minor' },
          { label: 'G major', value: 'G major' },
        ]}
        value=${['C major', 'G major']}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with object options without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        label="Time Signatures"
        options=${[
          { label: '2/4', value: '2' },
          { label: '3/4', value: '3' },
          { label: '4/4', value: '4' },
          { label: '6/8', value: '6' },
        ]}
        value=${['4', '3']}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with buttonProps without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        options=${[
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ]}
        value=${[]}
        onChange=${() => {}}
        buttonProps=${{ icon: 'info', title: 'Info', onClick: () => {} }}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders options with tooltip without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        options=${[
          {
            label: 'Classical',
            value: 'classical',
            tooltip: 'Orchestral music from the 17th–19th century',
          },
          {
            label: 'Jazz',
            value: 'jazz',
            tooltip: 'Improvisational style originating in New Orleans',
          },
        ]}
        value=${[]}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── CollapsiblePanel ──────────────────────────────────────────────────────

import { CollapsiblePanel } from './layout/collapsible-panel.mjs'

describe('CollapsiblePanel', () => {
  test('renders collapsed without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${CollapsiblePanel}
        header=${html`<span>Section</span>`}
        content=${html`<p>Content</p>`}
        expanded=${false}
        onExpand=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders expanded without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${CollapsiblePanel}
        header=${html`<span>Section</span>`}
        content=${html`<p>Content</p>`}
        expanded=${true}
        onExpand=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── BgmPlayerDemo — Panel glass + controls (mirrors test.html) ────────────

import { globalBgmPlayer } from './global-audio-player.mjs'

function makeMockBgmGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
}
function makeMockBgmContext() {
  return {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn().mockImplementation(makeMockBgmGainNode),
    createMediaElementSource: vi
      .fn()
      .mockImplementation(() => ({ connect: vi.fn() })),
  }
}
class MockBgmAudio {
  constructor() {
    this.src = ''
    this.currentTime = 0
    this.duration = 30
    this.crossOrigin = null
    this.preload = 'auto'
    this.play = vi.fn().mockResolvedValue(undefined)
    this.pause = vi.fn()
    this.addEventListener = vi.fn()
    this.removeEventListener = vi.fn()
  }
}

describe('BgmPlayerDemo (test.html usages)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.AudioContext = function MockBgmAudioContext() {
      return makeMockBgmContext()
    }
    window.Audio = MockBgmAudio
    globalBgmPlayer.stop()
    globalBgmPlayer._context = null
    globalBgmPlayer._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ]
    globalBgmPlayer._activeSlot = 0
    globalBgmPlayer._playId = 0
  })

  afterEach(() => {
    globalBgmPlayer.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('Panel glass variant with style object renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Panel} variant="glass" padding="medium" style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <${Button} size="small" icon="play" />
        <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
          <span>0:00</span>
          <div style="flex: 1; height: 6px; border-radius: 3px; background: #333;"><div style="height: 100%; width: 0%;"></div></div>
          <span>0:00</span>
        </div>
      </${Panel}>
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── TransitionViewer ──────────────────────────────────────────────────────

import { TransitionViewer } from './media/transition-viewer.mjs'

describe('TransitionViewer', () => {
  test('renders empty without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${TransitionViewer}
        style=${{ width: '100px', height: '100px' }}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('transitionTo shows initial element without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ref = { current: null }
    render(
      html`<${TransitionViewer}
        ref=${ref}
        style=${{ width: '100px', height: '100px' }}
      />`,
    )
    if (ref.current) ref.current.transitionTo(html`<div>Content</div>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Pill ──────────────────────────────────────────────────────────────────────

import { Pill } from './io/pill.mjs'

describe('Pill', () => {
  test.each(['tiny', 'small', 'medium', 'large'])(
    'renders at size="%s" (with dismiss and a slot) without errors',
    (size) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        html`<${Pill} size=${size} onDismiss=${() => {}} options=${['a', 'b']}>x {{a}}</${Pill}>`,
      )
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    },
  )

  test('defaults to tiny (24px); size="small" is 34px', () => {
    const { container } = render(
      html`<div>
        <${Pill} color="primary">a</${Pill}>
        <${Pill} color="primary" size="small">b</${Pill}>
      </div>`,
    )
    const [tiny, small] = container.querySelectorAll('.pill-container')
    expect(getComputedStyle(tiny).minHeight).toBe('24px')
    expect(getComputedStyle(small).minHeight).toBe('34px')
  })

  test('an invalid size logs a [pill] warn and falls back to tiny', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(html`<${Pill} size="huge">a</${Pill}>`)
    expect(warnsFrom(warn, 'pill')).toHaveLength(1)
    expect(
      getComputedStyle(container.querySelector('.pill-container')).minHeight,
    ).toBe('24px')
    warn.mockRestore()
  })

  test('renders static variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Pill} color="primary">Hello</${Pill}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('a pill with a tooltip shows it on hover', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { getByText } = render(html`
        <${TooltipProvider}>
          <${Pill} color="primary" tooltip="Made by Match">generated</${Pill}>
        </${TooltipProvider}>
      `)
      // mouseenter does not bubble: hover the pill container, not its text.
      fireEvent.mouseEnter(getByText('generated').parentElement, {
        clientX: 10,
        clientY: 10,
      })
      await vi.advanceTimersByTimeAsync(700)
      expect(
        document.getElementById('custom-ui-tooltip-box')?.textContent,
      ).toBe('Made by Match')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  test('renders a pill with a tooltip outside a TooltipProvider without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Pill} tooltip="hint">generated</${Pill}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders dismiss variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Pill} color="secondary" onDismiss=${() => {}}>Tag</${Pill}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders interactive icon variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Pill} color="success" icon="play" onIconClick=${() => {}}>Playing</${Pill}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders a whole-pill selector (selectOptions) and opens it without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(html`
      <${Pill}
        color="secondary"
        selectOptions=${['and', { value: 'or', color: 'warning' }]}
        onSelect=${() => {}}
      >and</${Pill}>
    `)
    fireEvent.click(container.querySelector('.pill-container'))
    expect(document.querySelector('[data-pill-select-panel]')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders template choice variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Pill}
        color="warning"
        options=${['a', 'b', 'c']}
        onTemplateChange=${() => {}}
      >{'{{a}}'}</${Pill}>
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders disabled state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Pill} color="danger" disabled=${true} onDismiss=${() => {}}>Tag</${Pill}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders all color themes without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const color of [
      'primary',
      'secondary',
      'warning',
      'success',
      'danger',
    ]) {
      render(html`<${Pill} color=${color}>Label</${Pill}>`)
    }
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders clickable variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${Pill} color="primary" onClick=${() => {}}>clickable</${Pill}>`,
    )
    render(
      html`<${Pill} color="secondary" value="explicit" onClick=${() => {}}>with value</${Pill}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('accepts a raw color-token object and renders with its background', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${Pill}
        color=${{ text: '#fff', background: '#d1242f', border: '#f5b3b8' }}
      >x</${Pill}>`,
    )
    const pillEl = container.querySelector('.pill-container')
    expect(getComputedStyle(pillEl).backgroundColor).toBe('#d1242f')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── PillSelectPanel ──────────────────────────────────────────────────────────

import { PillSelectPanel } from './io/pill-select-panel.mjs'

describe('PillSelectPanel', () => {
  test('renders open with minimal props without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${PillSelectPanel}
        anchorRect=${{ top: 0, bottom: 20, left: 0, width: 40 }}
        options=${['a', 'b']}
        onSelect=${() => {}}
        onClose=${() => {}}
      />`,
    )
    expect(
      document.querySelectorAll(
        '[data-pill-select-panel] [data-pill-select-option]',
      ),
    ).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── ContentEditablePillInput ──────────────────────────────────────────────────

import { useState } from 'preact/hooks'
import { ContentEditablePillInput } from './io/content-editable-pill-input.mjs'

describe('ContentEditablePillInput', () => {
  test('pills follow the pill nesting rule (large editor -> 34px, default -> 24px)', () => {
    const { container } = render(html`
      <div>
        <div class="large">
          <${ContentEditablePillInput}
            size="large"
            values=${['a']}
            onValuesChange=${() => {}}
          />
        </div>
        <div class="default">
          <${ContentEditablePillInput}
            values=${['a']}
            onValuesChange=${() => {}}
          />
        </div>
      </div>
    `)
    const large = container.querySelector('.large [data-pill]')
    const medium = container.querySelector('.default [data-pill]')
    expect(large.style.minHeight).toBe('34px')
    expect(medium.style.minHeight).toBe('24px')
  })

  test('a custom renderPill receives the pill size step', () => {
    const renderPill = vi.fn(() => null)
    render(html`
      <${ContentEditablePillInput}
        size="large"
        values=${['a']}
        onValuesChange=${() => {}}
        renderPill=${renderPill}
      />
    `)
    expect(renderPill).toHaveBeenCalledWith('a', {
      pillSize: 'small',
      unknown: false,
    })
  })

  test('widthScale="auto" logs exactly one [pill-input] warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        widthScale="auto"
        values=${[]}
        onValuesChange=${() => {}}
      />
    `)
    const pillInputWarns = warnsFrom(warn, 'pill-input')
    expect(pillInputWarns).toHaveLength(1)
    expect(pillInputWarns[0][0]).toContain('widthScale="auto"')
    warn.mockRestore()
  })

  test('renders with no values without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${[]}
        onValuesChange=${() => {}}
        suggestions=${['tag1', 'tag2']}
        placeholder="Type here..."
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with pre-populated values without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        label="Tags"
        values=${['apple', 'banana']}
        onValuesChange=${() => {}}
        suggestions=${['apple', 'banana', 'cherry']}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders an unknown value, flagged and with flagUnknown=false, without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(html`
      <div>
        <div class="flagged">
          <${ContentEditablePillInput}
            values=${['red', 'teal']}
            onValuesChange=${() => {}}
            suggestions=${['red', 'green', 'blue']}
          />
        </div>
        <div class="unflagged">
          <${ContentEditablePillInput}
            values=${['red', 'teal']}
            onValuesChange=${() => {}}
            suggestions=${['red', 'green', 'blue']}
            flagUnknown=${false}
          />
        </div>
      </div>
    `)
    expect(
      container.querySelectorAll('.flagged [data-pill-unknown]').length,
    ).toBe(1)
    expect(
      container.querySelectorAll('.unflagged [data-pill-unknown]').length,
    ).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders disabled state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${['tag1']}
        onValuesChange=${() => {}}
        disabled=${true}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with fixedHeight without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${[]}
        onValuesChange=${() => {}}
        fixedHeight=${120}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with buttonProps overlay without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${['tag1']}
        onValuesChange=${() => {}}
        onPillClick=${() => {}}
        buttonProps=${{ icon: 'search', title: 'Browse', onClick: () => {} }}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with both buttonProps and secondaryButtonProps without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${['tag1']}
        onValuesChange=${() => {}}
        buttonProps=${{ icon: 'price-tag', title: 'Browse', onClick: () => {} }}
        secondaryButtonProps=${{ icon: 'capitalize', title: 'Switch mode', onClick: () => {} }}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with getPillTooltip callback without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ContentEditablePillInput}
        values=${['blue_eyes', 'long hair']}
        onValuesChange=${() => {}}
        getPillTooltip=${(v) => (v === 'blue_eyes' ? 'Character has blue-coloured irises' : null)}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('redraws DOM after a focused deletion is reverted to the original values', () => {
    const ORIGINAL = ['apple', 'banana']
    const Harness = () => {
      const [values, setValues] = useState(ORIGINAL)
      return html`
        <div>
          <${ContentEditablePillInput}
            values=${values}
            onValuesChange=${setValues}
          />
          <button data-testid="revert" onClick=${() => setValues(ORIGINAL)}>
            Revert
          </button>
        </div>
      `
    }
    const { container } = render(html`<${Harness} />`)
    const editable = container.querySelector('[contenteditable]')

    // Focus the field, then delete a pill via the dismiss button — mirrors the
    // real dismiss handler, which intentionally keeps focus in the editor so
    // the user can keep deleting pills without losing their place.
    fireEvent.focus(editable)
    const dismissBtn = editable.querySelector('[data-pill-dismiss]')
    fireEvent.mouseDown(dismissBtn)
    expect(editable.querySelectorAll('[data-pill]').length).toBe(1)

    // Focus moves to the Revert button (blur fires), then the parent restores
    // the original values — same shape as clicking Revert after editing a
    // plot page's Page Tags in tag mode.
    fireEvent.blur(editable)
    fireEvent.click(container.querySelector('[data-testid="revert"]'))

    expect(editable.querySelectorAll('[data-pill]').length).toBe(2)
  })
})

// ── SeekBar ───────────────────────────────────────────────────────────────

import { SeekBar } from './media/seek-bar.mjs'

describe('SeekBar', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${SeekBar} progress=${0.5} onSeek=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── VideoPlayer ───────────────────────────────────────────────────────────

import { VideoPlayer } from './media/video-player.mjs'

describe('VideoPlayer', () => {
  test('renders with videoRef and videoUrl without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const videoRef = { current: null }
    render(
      html`<${VideoPlayer}
        videoRef=${videoRef}
        videoUrl="/demo/sample-video.mp4"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  // A stand-in for the caller-owned <video>: a real EventTarget so the
  // component's play/pause listeners attach, with play()/pause() spies that
  // dispatch the matching events like the browser would.
  const makeVideoStub = () => {
    const video = new EventTarget()
    video.paused = true
    video.ended = false
    video.loop = false
    video.readyState = 0
    video.currentTime = 0
    video.play = vi.fn(() => {
      video.paused = false
      video.dispatchEvent(new Event('play'))
    })
    video.pause = vi.fn(() => {
      video.paused = true
      video.dispatchEvent(new Event('pause'))
    })
    return video
  }

  const renderPlayer = (videoRef, showLoop) =>
    render(
      html`<${VideoPlayer}
        videoRef=${videoRef}
        videoUrl="/demo/sample-video.mp4"
        showLoop=${showLoop}
      />`,
    )

  test('renders the loop button before play by default, and none when showLoop is false', () => {
    const videoRef = { current: makeVideoStub() }
    const { container, unmount } = renderPlayer(videoRef, undefined)
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    // The loop button is first: clicking it starts looped playback.
    fireEvent.click(buttons[0])
    expect(videoRef.current.loop).toBe(true)
    unmount()

    const hidden = renderPlayer({ current: makeVideoStub() }, false)
    expect(hidden.container.querySelectorAll('button')).toHaveLength(1)
  })

  test('loop starts looped playback; play starts a single playthrough', () => {
    const videoRef = { current: makeVideoStub() }
    const { container } = renderPlayer(videoRef, true)
    const [loopBtn, playBtn] = container.querySelectorAll('button')

    fireEvent.click(loopBtn)
    expect(videoRef.current.loop).toBe(true)
    expect(videoRef.current.play).toHaveBeenCalledTimes(1)

    // Stop, then start with play: loop is decided by the starting button.
    fireEvent.click(playBtn)
    expect(videoRef.current.pause).toHaveBeenCalledTimes(1)
    fireEvent.click(playBtn)
    expect(videoRef.current.loop).toBe(false)
    expect(videoRef.current.play).toHaveBeenCalledTimes(2)
  })

  test('loop button is disabled while playing', () => {
    const videoRef = { current: makeVideoStub() }
    const { container } = renderPlayer(videoRef, true)
    const loopBtn = container.querySelectorAll('button')[0]
    expect(loopBtn.disabled).toBe(false)
    fireEvent(videoRef.current, new Event('play'))
    expect(container.querySelectorAll('button')[0].disabled).toBe(true)
  })

  test('with showLoop false, play leaves the caller-owned loop flag alone', () => {
    const video = makeVideoStub()
    video.loop = true
    const { container } = renderPlayer({ current: video }, false)
    fireEvent.click(container.querySelector('button'))
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(video.loop).toBe(true)
  })
})

// ── AutocompleteDropdown ──────────────────────────────────────────────────

import { AutocompleteDropdown } from './io/autocomplete-dropdown.mjs'

describe('AutocompleteDropdown', () => {
  test('renders nothing when not visible without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = {
      visible: false,
      items: [],
      index: -1,
      left: 0,
      top: 0,
      query: '',
    }
    render(
      html`<${AutocompleteDropdown}
        dropdownState=${state}
        onItemClick=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders visible dropdown with items without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = {
      visible: true,
      items: ['foo', 'bar'],
      index: 0,
      left: 0,
      top: 0,
      query: 'f',
    }
    render(
      html`<${AutocompleteDropdown}
        dropdownState=${state}
        onItemClick=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders visible dropdown with no matches without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = {
      visible: true,
      items: [],
      index: -1,
      left: 0,
      top: 0,
      query: 'xyz',
    }
    render(
      html`<${AutocompleteDropdown}
        dropdownState=${state}
        onItemClick=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

import { ToastProvider } from './msg/toast.mjs'

// ── DynamicList ───────────────────────────────────────────────────────────

import { DynamicList } from './layout/dynamic-list.mjs'

const makeItems = () => [
  { id: 1, label: 'Alpha' },
  { id: 2, label: 'Beta' },
]

describe('DynamicList', () => {
  test('renders with string getTitle without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${DynamicList}
        items=${makeItems()}
        renderItem=${(item) => html`<span>${item.label}</span>`}
        getTitle=${(item) => item.label}
        createItem=${() => ({ id: Date.now(), label: '' })}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with getHeaderContent (VNode header) without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${DynamicList}
        items=${makeItems()}
        renderItem=${(item) => html`<span>${item.label}</span>`}
        getTitle=${(item) => item.label}
        getHeaderContent=${(item) => html`<span><strong>${item.label}</strong><em> pill</em></span>`}
        createItem=${() => ({ id: Date.now(), label: '' })}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with getHeaderContent and no getTitle without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${DynamicList}
        items=${makeItems()}
        renderItem=${(item) => html`<span>${item.label}</span>`}
        getHeaderContent=${(item) => html`<strong>${item.label}</strong>`}
        createItem=${() => ({ id: Date.now(), label: '' })}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders condensed mode without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${DynamicList}
        condensed=${true}
        items=${makeItems()}
        renderItem=${(item) => html`<span>${item.label}</span>`}
        createItem=${() => ({ id: Date.now(), label: '' })}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── ListSelectModal ───────────────────────────────────────────────────────

import ListSelectModal from './overlays/list-select.mjs'

describe('ListSelectModal', () => {
  test('renders searchable with one item without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${ListSelectModal}
        isOpen=${true}
        title="Pick One"
        items=${[{ id: 'a', label: 'Alpha' }]}
        searchable=${true}
        onReorder=${() => {}}
        onClose=${() => {}}
      />
    `)
    expect(document.body.textContent).toContain('Alpha')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── SearchSelectModal ─────────────────────────────────────────────────────

import { SearchSelectModal } from './overlays/search-select.mjs'

describe('SearchSelectModal', () => {
  test('renders single mode with items without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${SearchSelectModal}
        isOpen=${true}
        title="Pick One"
        items=${['Alpha', 'Beta']}
        mode="single"
        onSelect=${() => {}}
        onClose=${() => {}}
      />
    `)
    // Modal renders via createPortal into document.body
    expect(document.body.textContent).toContain('Alpha')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('sortByLabel={false} keeps the caller order instead of sorting alphabetically', () => {
    const textOrder = (items, sortByLabel) => {
      const { unmount } = render(html`
        <${SearchSelectModal}
          isOpen=${true}
          title="Order"
          items=${items}
          mode="single"
          sortByLabel=${sortByLabel}
          onSelect=${() => {}}
          onClose=${() => {}}
        />
      `)
      const text = document.body.textContent
      unmount()
      return items
        .map((label) => [label, text.indexOf(label)])
        .sort((a, b) => a[1] - b[1])
        .map(([label]) => label)
    }
    expect(textOrder(['Zulu', 'Alpha', 'Mike'], false)).toEqual([
      'Zulu',
      'Alpha',
      'Mike',
    ])
    expect(textOrder(['Zulu', 'Alpha', 'Mike'], true)).toEqual([
      'Alpha',
      'Mike',
      'Zulu',
    ])
  })

  test('single mode: itemAction click fires onClick with the normalised item, not onSelect', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const actionSpy = vi.fn()
    render(html`
      <${SearchSelectModal}
        isOpen=${true}
        title="Pick One"
        items=${['Alpha']}
        mode="single"
        itemActions=${[
          {
            icon: 'copy',
            title: 'Clone',
            onClick: actionSpy,
            closeAfter: true,
          },
        ]}
        onSelect=${onSelect}
        onClose=${onClose}
      />
    `)
    const actionButton = document.body.querySelector('button[title="Clone"]')
    expect(actionButton).not.toBeNull()
    fireEvent.click(actionButton)
    expect(actionSpy).toHaveBeenCalledWith({
      label: 'Alpha',
      value: 'Alpha',
      subtitle: '',
    })
    expect(onSelect).not.toHaveBeenCalled()
    // closeAfter: true → modal is closed after the action runs
    expect(onClose).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('multi mode: itemAction click does not toggle the row', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onSelect = vi.fn()
    const actionSpy = vi.fn()
    render(html`
      <${SearchSelectModal}
        isOpen=${true}
        title="Pick Many"
        items=${[{ label: 'Red', value: 'red' }]}
        mode="multi"
        itemActions=${[{ icon: 'copy', title: 'Clone', onClick: actionSpy }]}
        onSelect=${onSelect}
        onClose=${() => {}}
      />
    `)
    const actionButton = document.body.querySelector('button[title="Clone"]')
    expect(actionButton).not.toBeNull()
    fireEvent.click(actionButton)
    expect(actionSpy).toHaveBeenCalledWith({
      label: 'Red',
      value: 'red',
      subtitle: '',
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Validation prop (all ten io components) ───────────────────────────────

import { Textarea } from './io/textarea.mjs'
import { RangeSlider } from './io/range-slider.mjs'
import { DiscreteSlider } from './io/discrete-slider.mjs'
import { ValidationMessage } from './io/validation-message.mjs'

const INVALID = { status: 'invalid', message: 'Bad' }

describe('ValidationMessage', () => {
  test('renders a message without console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${ValidationMessage} status="invalid" message="Bad" />`,
    )
    expect(container.textContent).toContain('Bad')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders nothing when idle or message-less', () => {
    const { container } = render(
      html`<div>
        <${ValidationMessage} status="idle" message="ignored" />
        <${ValidationMessage} status="valid" message="" />
      </div>`,
    )
    expect(container.querySelectorAll('.validation-message')).toHaveLength(0)
  })
})

import { FormStatusPanel } from './msg/form-status-panel.mjs'

describe('FormStatusPanel', () => {
  test('renders a single message without console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${FormStatusPanel} messages=${['Name is required']} />`,
    )
    expect(container.textContent).toContain('Name is required')
    expect(container.querySelector('.form-status-panel-list')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders one list item per message when given two or more', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      html`<${FormStatusPanel}
        messages=${['Name is required', 'Port must be a number']}
      />`,
    )
    expect(
      container.querySelectorAll('.form-status-panel-list li'),
    ).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders nothing when messages is empty or status is idle', () => {
    const { container } = render(
      html`<div>
        <${FormStatusPanel} messages=${[]} />
        <${FormStatusPanel} status="idle" messages=${['ignored']} />
      </div>`,
    )
    expect(container.querySelector('.styled-panel')).toBeNull()
    expect(container.textContent).toBe('')
  })

  test('renders non-error statuses without console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const status of ['valid', 'warning', 'validating']) {
      render(html`<${FormStatusPanel} status=${status} messages=${['OK']} />`)
    }
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('validation prop', () => {
  const cases = [
    ['Input', (v) => html`<${Input} label="A" validation=${v} />`],
    ['Textarea', (v) => html`<${Textarea} label="A" validation=${v} />`],
    [
      'Select',
      (v) =>
        html`<${Select}
          label="A"
          options=${[{ label: 'x', value: 'x' }]}
          validation=${v}
        />`,
    ],
    [
      'MultiSelect',
      (v) =>
        html`<${MultiSelect}
          label="A"
          options=${[{ label: 'x', value: 'x' }]}
          value=${[]}
          onChange=${() => {}}
          validation=${v}
        />`,
    ],
    ['Slider', (v) => html`<${Slider} label="A" validation=${v} />`],
    ['RangeSlider', (v) => html`<${RangeSlider} label="A" validation=${v} />`],
    [
      'DiscreteSlider',
      (v) =>
        html`<${DiscreteSlider}
          label="A"
          options=${['low', 'high']}
          value="low"
          validation=${v}
        />`,
    ],
    [
      'ContentEditablePillInput',
      (v) =>
        html`<${ContentEditablePillInput}
          label="A"
          values=${[]}
          onValuesChange=${() => {}}
          validation=${v}
        />`,
    ],
    ['Checkbox', (v) => html`<${Checkbox} label="A" validation=${v} />`],
    [
      'ToggleSwitch',
      (v) => html`<${ToggleSwitch} label="A" validation=${v} />`,
    ],
  ]

  for (const [name, build] of cases) {
    test(`${name} renders an invalid validation without console.error`, () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { container } = render(build(INVALID))
      expect(container.textContent).toContain('Bad')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  }

  // The two row controls conditionally wrap; without `validation` the wrapper
  // must not appear at all, or every existing call site's layout would shift.
  test('Checkbox introduces no wrapper element when validation is absent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(html`<${Checkbox} label="A" />`)
    expect(container.querySelector('.checkbox-validation-column')).toBeNull()
    expect(container.firstElementChild?.className).toContain('container')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('ToggleSwitch introduces no wrapper element when validation is absent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(html`<${ToggleSwitch} label="A" />`)
    expect(
      container.querySelector('.toggle-switch-validation-column'),
    ).toBeNull()
    expect(container.firstElementChild?.className).toContain(
      'toggle-switch-label',
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── LogView ───────────────────────────────────────────────────────────────

import { LogView } from './msg/log-view.mjs'

describe('LogView', () => {
  test('renders empty state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${LogView}
        lines=${[]}
        followTail=${true}
        onFollowTailChange=${() => {}}
        onCopy=${() => {}}
        emptyMessage="No output yet"
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders stdout/stderr/meta lines without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${LogView}
        lines=${[
          { ts: 1, stream: 'stdout', text: 'Server started' },
          { ts: 2, stream: 'stderr', text: 'Warning: low memory' },
          { ts: 3, stream: 'meta', text: '--- process exited ---' },
        ]}
        followTail=${true}
        onFollowTailChange=${() => {}}
        onCopy=${() => {}}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()))

  // jsdom performs no layout, so the scroll container reports zero for every
  // box metric. Stub them to place the viewport well above the bottom, and let
  // the mount-time pin-to-bottom frames settle so its guard is no longer armed.
  const renderScrolledLogView = async (onFollowTailChange) => {
    const { container } = render(
      html`<${LogView}
        lines=${[{ ts: 1, stream: 'stdout', text: 'line' }]}
        followTail=${true}
        onFollowTailChange=${onFollowTailChange}
        onCopy=${() => {}}
      />`,
    )
    const scroller = container.querySelector('div[style*="overflow-y"]')
    Object.defineProperty(scroller, 'scrollHeight', { value: 1000 })
    Object.defineProperty(scroller, 'clientHeight', { value: 100 })
    await nextFrame()
    await nextFrame()
    await nextFrame()
    Object.defineProperty(scroller, 'scrollTop', { value: 0, writable: true })
    return scroller
  }

  test('a scroll with no user gesture does not disable follow tail', async () => {
    const onFollowTailChange = vi.fn()
    const scroller = await renderScrolledLogView(onFollowTailChange)

    fireEvent.scroll(scroller)

    expect(onFollowTailChange).not.toHaveBeenCalled()
  })

  test('a scroll following a wheel gesture disables follow tail', async () => {
    const onFollowTailChange = vi.fn()
    const scroller = await renderScrolledLogView(onFollowTailChange)

    fireEvent.wheel(scroller)
    fireEvent.scroll(scroller)

    expect(onFollowTailChange).toHaveBeenCalledTimes(1)
    expect(onFollowTailChange).toHaveBeenCalledWith(false)
  })
})

// ── Field control size scale ─────────────────────────────────────────────

import {
  currentTheme,
  oneSizeDown,
  oneSizeUp,
  getEmbeddedButtonLayout,
} from './theme.mjs'

describe('Spacing scale tokens', () => {
  test('spacing steps carry only gap and padding', () => {
    const medium = currentTheme.value.spacing.medium
    expect(medium).not.toHaveProperty('borderRadius')
    expect(medium).not.toHaveProperty('margin')
    expect(medium).not.toHaveProperty('buttonPadding')
  })

  test('border radius is a size scale', () => {
    expect(currentTheme.value.border.radius.medium).toBe('8px')
  })
})

describe('Control size scale helpers', () => {
  test('oneSizeDown steps each size down once and keeps tiny at tiny', () => {
    expect(oneSizeDown('large')).toBe('medium')
    expect(oneSizeDown('medium')).toBe('small')
    expect(oneSizeDown('small')).toBe('tiny')
    expect(oneSizeDown('tiny')).toBe('tiny')
  })

  test('oneSizeUp steps each size up once and keeps large at large', () => {
    expect(oneSizeUp('tiny')).toBe('small')
    expect(oneSizeUp('small')).toBe('medium')
    expect(oneSizeUp('medium')).toBe('large')
    expect(oneSizeUp('large')).toBe('large')
  })

  test('getEmbeddedButtonLayout centres one size down and derives right padding', () => {
    const theme = currentTheme.value
    const medium = getEmbeddedButtonLayout(theme, 'medium')
    expect(medium.buttonSize).toBe('small')
    expect(medium.offset).toBe(5) // (44 - 34) / 2
    expect(medium.paddingRight).toBe(44) // 34 + 2 * 5
    const twoLarge = getEmbeddedButtonLayout(theme, 'large', 2)
    // 2 * 44 + 1 * 8 gap + 2 * 5 offset
    expect(twoLarge.paddingRight).toBe(106)
    const tiny = getEmbeddedButtonLayout(theme, 'tiny')
    expect(tiny.buttonSize).toBe('tiny')
    expect(tiny.offset).toBe(0)
  })
})

const SIZE_TEST_BUTTON = { icon: 'search', title: 'Search', onClick: () => {} }
const SIZE_TEST_OPTIONS = [
  { label: 'One', value: '1' },
  { label: 'Two', value: '2' },
]

// Each field renders at a given size (with an embedded button) and, for the
// legacy check, with heightScale="compact". `source` is the logger source the
// field warns under.
const SIZED_FIELDS = [
  {
    name: 'Input',
    source: 'input',
    render: (props) =>
      html`<${Input} value="" onInput=${() => {}} ...${props} />`,
  },
  {
    name: 'Select',
    source: 'select',
    render: (props) =>
      html`<${Select}
        value="1"
        options=${SIZE_TEST_OPTIONS}
        onChange=${() => {}}
        ...${props}
      />`,
  },
  {
    name: 'MultiSelect',
    source: 'multi-select',
    render: (props) =>
      html`<${MultiSelect}
        value=${['1']}
        options=${SIZE_TEST_OPTIONS}
        onChange=${() => {}}
        ...${props}
      />`,
  },
  {
    name: 'Textarea',
    source: 'textarea',
    render: (props) =>
      html`<${Textarea} value="" onInput=${() => {}} ...${props} />`,
  },
  {
    name: 'AutocompleteInput',
    source: 'autocomplete-input',
    // AutocompleteInput builds its own embedded browse button from suggestions.
    render: ({ buttonProps: _unused, ...props }) =>
      html`<${AutocompleteInput}
        suggestions=${['a', 'b']}
        value=""
        onValueChange=${() => {}}
        ...${props}
      />`,
  },
]

describe.each(SIZED_FIELDS)(
  '$name size prop',
  ({ source, render: renderField }) => {
    test.each(['small', 'large'])(
      'renders at size="%s" with an embedded button without errors',
      (size) => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(renderField({ size, buttonProps: SIZE_TEST_BUTTON }))
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      },
    )

    test('heightScale="compact" logs a warn and does not throw', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() =>
        render(renderField({ heightScale: 'compact' })),
      ).not.toThrow()
      const fieldWarns = warn.mock.calls.filter((args) =>
        String(args[0]).startsWith(`[${source}]`),
      )
      expect(fieldWarns).toHaveLength(1)
      expect(fieldWarns[0][0]).toContain('heightScale')
      warn.mockRestore()
    })
  },
)

// ── COMPOSITION.md drift guard ───────────────────────────────────────────
// test.html's CompositionGuide maps each `## Recipe: ` heading to a live demo
// by exact heading text, so a renamed or added recipe must fail here.

import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('COMPOSITION.md', () => {
  test('recipe headings match the demo map in test.html', () => {
    const text = readFileSync(
      // Resolved from the repo root: in the client (jsdom) project
      // import.meta.url is not a file: URL.
      path.join(process.cwd(), 'public', 'js', 'custom-ui', 'COMPOSITION.md'),
      'utf-8',
    )
    const names = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('## Recipe: '))
      .map((line) => line.slice('## Recipe: '.length).trim())
    expect(names).toEqual([
      'Title + control row',
      'Stacked form',
      'Inline field + button',
      'Toolbar',
      'Form action row',
      'Panel with sections',
      'Pill cluster',
    ])
  })
})

// ── StackedMeter ──────────────────────────────────────────────────────────

import { StackedMeter } from './msg/stacked-meter.mjs'

describe('StackedMeter', () => {
  test('renders segments and a peak tick without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${TooltipProvider}>
        <${StackedMeter}
          max=${8192}
          segments=${[
            { value: 6074, color: 'primary', label: 'ComfyUI 5.9 GB' },
            { value: 1326, color: '#17a2b8', label: 'llama.cpp 1.3 GB' },
          ]}
          marker=${{ value: 7900, tooltip: 'Peak 7.7 GB' }}
        />
      </${TooltipProvider}>`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders an over-max fill without a tooltip provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      html`<${StackedMeter}
        max=${100}
        segments=${[{ value: 150, color: 'primary', label: 'over' }]}
      />`,
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── ProgressBanner ─────────────────────────────────────────────────────────

import { ProgressBanner } from './msg/progress-banner.mjs'

describe('ProgressBanner', () => {
  test('renders a progress event with remainingSeconds as time left', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let handlers = null
    const sseManager = {
      subscribe: (taskId, callbacks) => {
        handlers = callbacks
        return true
      },
      unsubscribe: () => {},
    }
    const { container } = render(
      html`<${ToastProvider}>
        <${ProgressBanner}
          taskId="task-1"
          sseManager=${sseManager}
          suppressTitle=${true}
          onDismiss=${() => {}}
        />
      </${ToastProvider}>`,
    )
    act(() => {
      handlers.onProgress({
        progress: { percentage: 40, currentStep: 'Sampling' },
        remainingSeconds: 134,
      })
    })
    expect(container.textContent).toContain('40% · 2m14s left')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('shows the percentage alone when no remainingSeconds arrives', () => {
    let handlers = null
    const sseManager = {
      subscribe: (taskId, callbacks) => {
        handlers = callbacks
        return true
      },
      unsubscribe: () => {},
    }
    const { container } = render(
      html`<${ToastProvider}>
        <${ProgressBanner}
          taskId="task-2"
          sseManager=${sseManager}
          suppressTitle=${true}
          onDismiss=${() => {}}
        />
      </${ToastProvider}>`,
    )
    act(() => {
      handlers.onProgress({
        progress: { percentage: 40, currentStep: 'Sampling' },
      })
    })
    expect(container.textContent).toContain('40%')
    expect(container.textContent).not.toContain('left')
  })
})
