# Custom UI Composition Guide

How to size and combine custom-ui components so a UI lines up without per-screen tweaking. This file travels with the library (`lib-sync` mirrors this whole folder), so it is written for a project that has none of the host app's call sites to learn from. `test.html` renders every **Recipe** section below next to a live demo with a size switcher.

## Start at the default size

Every control defaults to `size="medium"` (except `Pill`, which defaults to `tiny` — see [Secondary controls](#secondary-controls)), and every layout `gap` and Panel `padding` defaults to `medium`. **A UI that never sets `size` is already aligned.** Reach for `size` only to change the density of a whole segment — a compact sidebar, a dense list item, a hero call-to-action — and when you do, change it **uniformly**: every control in that segment gets the same `size`, and its spacing follows the [pairing rule](#spacing-scale). Mixing sizes side by side is the one way to break alignment.

Three rules do almost all the work:

1. **Same size beside, one size down inside.** Controls placed next to each other share a `size`; a button embedded inside a field renders one size down automatically ([nesting rule](#control-size-scale)).
2. **Spacing names match control sizes.** Controls of size S sit at `gap=S`; groups of them, and the Panel around them, step one size up ([pairing rule](#spacing-scale)).
3. **Width is separate from size.** Choose `widthScale` by how long the value is, never by `size` ([width scale](#width-scale)).

## Control size scale

Button, Input, Textarea, Select, MultiSelect, ContentEditablePillInput, and AutocompleteInput share one `size` prop (`'tiny' | 'small' | 'medium' | 'large'`, default `'medium'`) backed by `theme.controlSize`, so controls placed side by side at the same size line up at the same height. Read a step through `getControlSize(theme, size)` (`theme.mjs`), which resolves `fontSize` from `theme.typography.fontSize[fontSizeKey]` and sets `iconSize` equal to it; `CONTROL_SIZES` lists the steps in order.

| Step     | Height | Font size                           | Button icon size | Icon-only size | Field padding | Button padding | Border radius | Gap |
| -------- | ------ | ----------------------------------- | ---------------- | -------------- | ------------- | -------------- | ------------- | --- |
| `tiny`   | 24px   | `typography.fontSize.small` (12px)  | 14px             | 16px           | `2px 6px`     | `0 8px`        | 4px           | 4px |
| `small`  | 34px   | `typography.fontSize.small` (12px)  | 16px             | 22px           | `4px 6px`     | `0 8px`        | 4px           | 4px |
| `medium` | 44px   | `typography.fontSize.medium` (14px) | 24px             | 28px           | `8px 12px`    | `8px 16px`     | 8px           | 8px |
| `large`  | 54px   | `typography.fontSize.large` (16px)  | 28px             | 34px           | `12px 16px`   | `0 24px`       | 8px           | 8px |

**Icon sizes.** Icons come in three sizes per step. Outside buttons — a standalone `Icon` beside paragraph text, or a Select/MultiSelect chevron — use `iconSize`, which equals the step's font size (12 / 12 / 14 / 16px). An icon + text button or a chip uses `buttonIconSize`, a little larger than its label. An icon alone in a square icon-only button (including its loading spinner and every embedded field button) uses `iconOnlySize`, about two thirds of the button's height.

**Nesting rule.** A button embedded _inside_ a field (`buttonProps` on Input/Select/MultiSelect/ContentEditablePillInput/Textarea, `secondaryButtonProps` on ContentEditablePillInput) renders one size down from the field — `oneSizeDown(size)`: large→medium, medium→small, small→tiny, tiny→tiny. It is inset `offset = (fieldHeight − buttonHeight) / 2` from the field's top and right outer edges, so it sits centred in a one-row field (fields taller than one row — Textarea, multi-line ContentEditablePillInput — use the step height as the reference box, keeping the button in the first row). The field's right padding becomes `n × buttonHeight + (n − 1) × gap + 2 × offset` for `n` buttons in a row. `getEmbeddedButtonLayout(theme, size, count)` (`theme.mjs`) returns all of these numbers. A control placed _beside_ another (not inside it) keeps the same size. A `tiny` field's embedded button stays `tiny` and does not fit — the documented known exception.

### Secondary controls

Checkbox, ToggleSwitch, Slider, RangeSlider, DiscreteSlider, and Pill take the same `size` prop, each backed by its own token group rather than `controlSize`, so a family can be retuned without moving the core controls (and vice versa). All values are starting points open to retuning; font sizes are stored as keys into `typography.fontSize`. An invalid `size` logs a warning (source = the control's logger name) and falls back to the default.

- **Checkbox / ToggleSwitch** — `theme.toggleControlSize`, read via `getToggleControlSize(theme, size)`. Only the indicator and its inline label scale; neither control reserves the row height, so it lines up in a row through the row's vertical centring (`HorizontalLayout alignItems="center"`) and stacked lists keep their density. The label is content text (it sits inline with the box), so it scales — unlike a field label above an Input.

  | Step     | Checkbox box | Check glyph | Track   | Knob | Label |
  | -------- | ------------ | ----------- | ------- | ---- | ----- |
  | `tiny`   | 14px         | 10px        | 26×14px | 8px  | 12px  |
  | `small`  | 18px         | 13px        | 34×18px | 11px | 12px  |
  | `medium` | 22px         | 16px        | 42×22px | 14px | 14px  |
  | `large`  | 26px         | 19px        | 50×26px | 17px | 16px  |

- **Slider / RangeSlider / DiscreteSlider** — `theme.sliderSize`, read via `getSliderSize(theme, size)`. Sliders keep their stacked layout (track row, then bounds boxes or option labels) at every size, so they line up with neighbours by **width** (`widthScale`) and label, not by height. The label _above_ the track is a field label and stays at 14px; the 50px bounds boxes and 60px option labels keep their fixed widths.

  | Step     | Track row | Thumb | Track | Number box / option text | Number box radius |
  | -------- | --------- | ----- | ----- | ------------------------ | ----------------- |
  | `tiny`   | 16px      | 10px  | 2px   | 12px                     | 4px               |
  | `small`  | 22px      | 14px  | 3px   | 12px                     | 4px               |
  | `medium` | 28px      | 18px  | 4px   | 14px                     | 6px               |
  | `large`  | 34px      | 22px  | 5px   | 16px                     | 8px               |

- **Pill** — `theme.pillSize`, read via `getPillSize(theme, size)`. **Pill defaults to `tiny`**, the one exception to the medium default: pills are usually status readouts rather than row-mates. Pass the neighbours' `size` to line a pill up with them — pill height equals the control height at every step. The radius stays fully rounded and the border stays 1px. Side padding widens faster than the text so a larger pill's straight middle stays in proportion to its rounded ends, and `{{slot}}` padding grows so a slot token keeps a small, near-constant gap (2–6px) to the pill's edge.

  | Step     | Height | Text | Icon | Side padding | `{{slot}}` padding |
  | -------- | ------ | ---- | ---- | ------------ | ------------------ |
  | `tiny`   | 24px   | 12px | 14px | 8px          | `2px 6px`          |
  | `small`  | 34px   | 12px | 16px | 12px         | `5px 9px`          |
  | `medium` | 44px   | 14px | 20px | 16px         | `8px 12px`         |
  | `large`  | 54px   | 16px | 24px | 20px         | `11px 15px`        |

**Pill nesting rule.** Pills drawn _inside_ a field (ContentEditablePillInput and any editor built on it) sit **two** steps down, clamped at `tiny` — `pillSizeInField(size)`: large→small, medium→tiny, small→tiny, tiny→tiny. This is separate from the embedded-button rule because a pill one step down would nearly fill its field. The editor's vertical padding is derived from the pill row (pill height + 2px margin top and bottom). A custom `renderPill` receives the step as `renderPill(value, { pillSize, unknown })`; `unknown` marks a value not in the suggestion list, drawn by appending `createUnknownIconEl(pillSize, textColor)` without changing the pill's height. A `tiny` editor still cannot fit a 28px pill row and grows past its 24px step height to fit it — the known exception.

**Pill select panels match their source pill.** A `PillSelectPanel` (opened by a pill's `{{slot}}` token or its `selectOptions`) renders its option pills at the **source pill's size**, the size of the pill that was clicked, so the choices read as the same kind of thing as the value they replace. For a pill inside a field that is the pill nesting step, `pillSizeInField(editorSize)`, usually `tiny`. Options take the source pill's colour unless an option carries its own.

**Popover height.** A dropdown popover scrolls past `theme.popoverMaxHeight[size]`, read through `getPopoverMaxHeight(theme, size)` (`theme.mjs`; an unknown step falls back to `medium`). `Select` reads it at its own `size`, and `PillSelectPanel` at the source pill's size:

| Size     | `popoverMaxHeight` |
| -------- | ------------------ |
| `tiny`   | 152px              |
| `small`  | 216px              |
| `medium` | 280px              |
| `large`  | 344px              |

## Spacing scale

Layout `gap` (HorizontalLayout / VerticalLayout) and Panel `padding` share the control size names, so the same name means matching density: a row of `medium` controls uses `gap="medium"`. Tokens live in `theme.spacing.<size>.gap` / `.padding`; `SPACING_SIZES` lists the steps and `getSpacing(theme, source, propName, value)` (`theme.mjs`) resolves a prop, warning and falling back to `medium` on an unknown value. All three components default to `medium`; `gap="none"` renders 0.

| Step     | Gap  | Padding | Pairs with controls of height |
| -------- | ---- | ------- | ----------------------------- |
| `tiny`   | 2px  | 2px     | 24px                          |
| `small`  | 4px  | 4px     | 34px                          |
| `medium` | 8px  | 8px     | 44px (default)                |
| `large`  | 16px | 16px    | 54px                          |

**Pairing rule.** S is the `size` of the controls involved (usually `medium`).

| Context                                                     | gap / padding                            |
| ----------------------------------------------------------- | ---------------------------------------- |
| Controls side by side in a row (inputs, buttons, a toolbar) | `S`                                      |
| Stacked form fields / control rows within one group         | `S`                                      |
| Distinct groups or sections stacked within a panel or page  | one step up (`large` for medium content) |
| Panel `padding` around controls of size S                   | one step up (`large` for medium content) |
| Pill / chip clusters                                        | `tiny`                                   |

So a `size="small"` Save/Revert/Delete row uses `gap="small"`, while the sections of a page stack with `gap="large"` inside a `Panel padding="large"`. Corner radii are a separate scale, `theme.border.radius.<size>` (2 / 4 / 8 / 16px). `controlSize.*.gap` (the gap between embedded buttons inside a field) is independent of this scale.

## Width scale

Every control that takes a `widthScale` prop resolves it to the same widths, backed by `theme.controlWidth` (multiples of 80px). Widths are fixed px and do **not** change with `size`.

| Value     | Width                                       |
| --------- | ------------------------------------------- |
| `compact` | `theme.controlWidth.compact` (80px)         |
| `normal`  | `theme.controlWidth.normal` (160px)         |
| `wide`    | `theme.controlWidth.wide` (320px)           |
| `full`    | `width: 100%` + `flex: 1 0 0` (fills a row) |
| `auto`    | No width set — the control fits its content |

`auto` is only accepted by **content-bearing** controls — ones whose natural width comes from their own label or value:

| Control                  | Accepts `auto` | Default                              |
| ------------------------ | -------------- | ------------------------------------ |
| Button                   | yes            | `auto`                               |
| Pill                     | yes            | `auto`                               |
| Select                   | yes            | `normal`                             |
| MultiSelect              | yes            | `normal`                             |
| Checkbox                 | yes            | `full` when labeled, `auto` when not |
| ToggleSwitch             | yes            | `auto`                               |
| Input                    | no             | `normal`                             |
| AutocompleteInput        | no             | `normal` (forwarded to Input)        |
| Textarea                 | no             | `full`                               |
| ContentEditablePillInput | no             | `full`                               |
| Slider                   | no             | `normal`                             |
| RangeSlider              | no             | `normal`                             |
| DiscreteSlider           | no             | `normal` (grows to fit its options)  |
| AudioPlayer              | no             | `full`                               |

An invalid value (e.g. the removed `narrow` or `square`), or `auto` on a control that does not accept it, logs one warning under the control's logger source and falls back to that control's default — rendering never throws. `getWidthScaleStyle(source, widthScale, { allowAuto, fallback, theme })` in `util.mjs` returns the `{ width, flex }` style; `resolveWidthScale(source, widthScale, { allowAuto, fallback })` validates without styling, so components can memoise the check and warn once per distinct value rather than on every render.

## Removed props

The removed `heightScale` prop (and Button's legacy size-bearing `variant` values such as `large-text` or `small-icon`) log a warning naming the replacement and are ignored — rendering never throws. Migrate `heightScale="compact"` → `size="small"`; drop `heightScale="normal"`; replace a size-bearing `variant` with `size` (Button's `variant` is now `default | chip`, appearance only).

## Recipe: Title + control row

A header row with a title on the left and one or more controls on the right — section headers, list headers, card headers. Use `HorizontalEdgesLayout` with a `RowTitle` on the left and a `HorizontalLayout gap=S` of controls on the right. Give the `RowTitle` the **same `size`** as the controls so it is exactly their height. A status `Pill` beside the title goes **one size down** from the title (the row-pill rule). Use `as="h2"` to keep heading semantics.

```javascript
html`
  <${HorizontalEdgesLayout}>
    <${HorizontalLayout} gap="small" alignItems="center">
      <${RowTitle} as="h2" size="medium">Characters<//>
      <${Pill} size="small" color="success">ready<//>
    <//>
    <${HorizontalLayout} gap="medium">
      <${Button} icon="folder-open">Load<//>
      <${Button} icon="plus" color="primary">New<//>
    <//>
  <//>
`
```

## Recipe: Stacked form

A column of labelled fields. Use a `VerticalLayout gap=S` and let each field carry its own `label` prop. Pick each field's `widthScale` from how long its value is, not from `size`: `compact` for a number or short code, `normal` for a name or choice, `wide` for a sentence, `full` for free text that should fill the column.

```javascript
html`
  <${VerticalLayout} gap="medium">
    <${Input} label="Age" widthScale="compact" />
    <${Input} label="Name" widthScale="normal" />
    <${Input} label="Tagline" widthScale="wide" />
    <${Select} label="Role" options=${roles} />
    <${Textarea} label="Description" widthScale="full" />
  <//>
`
```

## Recipe: Inline field + button

Two ways to attach an action to a field. **Beside:** put the field and a `Button` in a `HorizontalLayout gap=S` at the same `size` — they are the same height. **Inside:** pass `buttonProps` to the field; the embedded button renders one size down and is inset automatically. Use _beside_ for a primary action (Search, Add) and _inside_ for a small helper on the value itself (clear, randomise, browse).

```javascript
html`
  <${HorizontalLayout} gap="medium" alignItems="flex-end">
    <${Input} label="Search" widthScale="wide" />
    <${Button} icon="search" color="primary">Search<//>
  <//>
  <${Input}
    label="Seed"
    buttonProps=${{ icon: 'refresh', title: 'Randomise', onClick: randomise }}
  />
`
```

## Recipe: Toolbar

A row of mixed controls acting on the content below. Every control in the row takes the same `size`; the row uses `gap=S` and `alignItems="center"` so the ToggleSwitch (which does not reserve row height) centres against the taller controls. Icon-only buttons stay square at every size.

```javascript
html`
  <${HorizontalLayout} gap="small" alignItems="center">
    <${Button} size="small" icon="undo" title="Undo" />
    <${Button} size="small" icon="plus">Add<//>
    <${Select} size="small" options=${sortOptions} widthScale="auto" />
    <${ToggleSwitch} size="small" label="Preview" />
  <//>
`
```

## Recipe: Form action row

> **Convention, not rule.** The order, icons, and colours below are a recommended default that a consuming app may override to match its own conventions. The alignment rules — same `size` across the row, `gap=S` — still apply.

A form's commit controls, right-aligned below its fields: **Save** (`icon="save"`, `color="primary"`) first, **Revert** (`icon="undo"`, default colour) second, **Delete** (`icon="trash"`, `color="danger"`) last. A form-wide error or status goes in a `FormStatusPanel` immediately above the row; it renders nothing when `messages` is empty, so render it unconditionally. Revert and Delete should confirm through a dialog before acting.

```javascript
html`
  <${VerticalLayout} gap="medium">
    ...fields...
    <${FormStatusPanel} messages=${formErrors} />
    <${HorizontalLayout} gap="medium" justifyContent="flex-end">
      <${Button} icon="save" color="primary" disabled=${!dirty}>Save<//>
      <${Button} icon="undo" disabled=${!dirty}>Revert<//>
      <${Button} icon="trash" color="danger">Delete<//>
    <//>
  <//>
`
```

## Recipe: Panel with sections

A panel holding several distinct groups. Inside each group, controls of size S stack at `gap=S`. The groups themselves stack **one step up**, and the Panel's padding is **one step up** too — `oneSizeUp(size)` from `theme.mjs` (it clamps at `large`). So medium content sits in `Panel padding="large"` with `gap="large"` between sections; small content in `padding="medium"` / `gap="medium"`.

```javascript
html`
  <${Panel} padding="large">
    <${VerticalLayout} gap="large">
      <${VerticalLayout} gap="medium">
        <${HorizontalEdgesLayout}>
          <${RowTitle} as="h3">Appearance<//>
          <${Button} icon="refresh">Reset<//>
        <//>
        <${Input} label="Colour" />
      <//>
      <${VerticalLayout} gap="medium">
        <${HorizontalEdgesLayout}>
          <${RowTitle} as="h3">Behaviour<//>
          <${ToggleSwitch} label="Enabled" />
        <//>
        <${Select} label="Mode" options=${modes} />
      <//>
    <//>
  <//>
`
```

## Recipe: Pill cluster

A wrapping set of pills — tags, filters, statuses. Pills sit at `gap="tiny"` regardless of their `size`, so the cluster reads as one group. Leave pills at their `tiny` default when the cluster is a readout beside text; pass the neighbouring controls' `size` when the cluster sits in a row with them. Status pills use lowercase state words and one of three colours: `danger` (broken/stopped), `success` (running/ready), `warning` (waiting/unknown).

```javascript
html`
  <${HorizontalLayout} gap="tiny" style=${{ flexWrap: 'wrap' }}>
    <${Pill} color="success">running<//>
    <${Pill} color="warning">queued<//>
    <${Pill} color="danger">failed<//>
    <${Pill}>forest<//>
    <${Pill}>night<//>
  <//>
`
```
