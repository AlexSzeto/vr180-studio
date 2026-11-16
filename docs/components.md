# Custom UI Component Library

The `public/js/custom-ui/` directory contains a reusable, themeable UI component library built with **Preact**, **htm**, and **goober** (CSS-in-JS). These components form a portable design system that can be shared across projects via [lib-sync](lib-sync.md).

## Table of Contents

- [Architecture](#architecture)
- [Theme System](#theme-system)
- [IO Components](#io-components)
  - [Sizing and composition](#sizing-and-composition)
- [Layout Components](#layout-components)
  - [Markdown](#markdown-layoutmarkdownmarkdownmjs)
- [Navigation Components](#navigation-components)
- [Overlay Components](#overlay-components)
- [Message & Feedback Components](#message--feedback-components)
- [Media Components](#media-components)
- [Themed Base Elements](#themed-base-elements)
- [Utilities](#utilities)
- [Component Showcase](#component-showcase)

## Architecture

### Technology Stack

| Layer       | Technology     | Purpose                                      |
| ----------- | -------------- | -------------------------------------------- |
| Virtual DOM | Preact         | Lightweight React alternative (3KB)          |
| Templating  | htm/preact     | Tagged template literals for JSX-free markup |
| CSS-in-JS   | goober         | 1KB styled-components alternative            |
| Theming     | Custom signals | Global theme state with cookie persistence   |

### Import Pattern

All components use ES module imports with bare specifiers resolved via an importmap:

```javascript
import { html } from '/lib/htm/preact.js'
import { useState, useEffect } from '/lib/preact/hooks.js'
import { styled } from '/js/custom-ui/goober-setup.mjs'
import { currentTheme } from '/js/custom-ui/theme.mjs'
```

### Component Conventions

- **Functional components** are preferred for most UI elements (hooks: `useState`, `useEffect`, `useCallback`).
- **Class components** (using `Component` from Preact) are used for complex stateful logic or when lifecycle methods offer cleaner abstraction.
- Props are destructured with defaults in the function signature.
- DOM-compatible props are forwarded via `...rest`.
- Public props are documented with JSDoc.

### Styling Conventions

- Import `styled` from `goober-setup.mjs`, **never** directly from `goober`.
- Use PascalCase for styled components (e.g., `StyledButton`).
- Attach a readable class name for debugging: `StyledButton.className = 'styled-button';`.
- **Never hardcode** colors, spacing, borders, or typography — use theme tokens.
- Keep styles local to the component file.

### Ref Restrictions

Attaching a `ref` to a `styled()` component yields the Preact component instance, not the DOM node. To access the DOM:

- Prefer event-driven alternatives (e.g., `e.currentTarget.getBoundingClientRect()`).
- When a raw DOM ref is necessary, attach it to a plain HTML element (`<div>`, `<canvas>`, `<input>`) rather than a styled wrapper.

---

## Theme System

**File**: `theme.mjs`

The theme system provides a centralized, reactive theme state with light and dark modes. Theme preference is persisted in cookies.

### API

```javascript
import { currentTheme } from '/js/custom-ui/theme.mjs'

// Subscribe to theme changes
currentTheme.subscribe((theme) => {
  // theme.colors, theme.spacing, theme.typography, etc.
})

// Toggle theme
currentTheme.value = currentTheme.value.name === 'dark' ? lightTheme : darkTheme
```

### Theme Token Categories

| Category        | Example Tokens                                                                                                                                                          | Usage                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Colors**      | `theme.colors.primary.background`, `theme.colors.text.secondary`, `theme.colors.danger`                                                                                 | All color values         |
| **Spacing**     | `theme.spacing.<size>.gap`, `theme.spacing.<size>.padding` (`tiny`/`small`/`medium`/`large` — see [Spacing scale](../public/js/custom-ui/COMPOSITION.md#spacing-scale)) | Margins, paddings, gaps  |
| **Borders**     | `theme.border.radius.<size>` (2 / 4 / 8 / 16px), `theme.border.width`, `theme.border.style`                                                                             | Border styling           |
| **Typography**  | `theme.typography.fontSize`, `theme.typography.fontFamily`                                                                                                              | Text styling             |
| **Shadows**     | `theme.shadows.small`, `theme.shadows.medium`                                                                                                                           | Box shadows              |
| **Transitions** | `theme.transitions.fast` (150ms), `theme.transitions.normal` (250ms), `theme.transitions.slow` (400ms), `theme.transitions.verySlow` (600ms)                            | CSS transition durations |

### Adding New Tokens

If a needed token is missing, add it to `theme.mjs` rather than hardcoding values. This ensures consistency across all components and both theme modes.

---

## IO Components

**Directory**: `io/`

Form inputs and interactive controls with full theme integration.

### Field validation — the `validation` prop

All ten io components (`Input`, `Textarea`, `Select`, `MultiSelect`, `Slider`, `RangeSlider`, `DiscreteSlider`, `ContentEditablePillInput`, `Checkbox`, `ToggleSwitch`) accept a single `validation` prop so a field-level result looks and behaves identically everywhere.

```javascript
validation = { status, message }
```

| Status       | Renders                                  | Border                        |
| ------------ | ---------------------------------------- | ----------------------------- |
| `idle`       | nothing (the resting state)              | `theme.colors.border.primary` |
| `validating` | message in `theme.colors.text.secondary` | neutral — unchanged           |
| `valid`      | message in `theme.colors.success.border` | `theme.colors.success.border` |
| `warning`    | message in `theme.colors.warning.border` | `theme.colors.warning.border` |
| `invalid`    | message in `theme.colors.danger.border`  | `theme.colors.danger.border`  |

Two behaviours are deliberate: `validating` keeps the neutral border because an in-flight check is not a judgment yet, and a `valid` result with an empty `message` renders nothing — positive confirmation is opt-in, so most fields should stay silent on success. Sliders have no border to colour and show the message only. `Checkbox` and `ToggleSwitch` are horizontal rows, so they wrap themselves in a column **only** when `validation` is present; without it their markup is unchanged.

This replaces the old `error` prop, which is gone from `Input`, `Textarea`, and `Select`. Migrate `error="msg"` to `validation=${{ status: 'invalid', message: 'msg' }}`.

### useInputValidation (`io/use-input-validation.mjs`)

Hook that owns one field's validation lifecycle: the debounce timer, the in-flight `validating` state, and stale-result discarding. The caller's `validate` returns exactly what gets displayed — the hook does no mapping.

```javascript
const v = useInputValidation({ validate, debounceMs?, validatingMessage? })
```

| Option              | Type     | Default         | Description                                                                                           |
| ------------------- | -------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `validate`          | function | —               | `async (value) => { status, message } \| null \| undefined`. Throwing, or returning nullish, → `idle` |
| `debounceMs`        | number   | `600`           | Quiet period before a debounced run fires                                                             |
| `validatingMessage` | string   | `'Validating…'` | Message shown while a run is in flight                                                                |

| Returns         | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `status`        | `'idle'｜'validating'｜'valid'｜'warning'｜'invalid'`                    |
| `message`       | Current message string                                                   |
| `validation`    | `{ status, message }` — pass straight to a component's `validation` prop |
| `onValueChange` | `(value) => void`; schedules a debounced run                             |
| `validate`      | `async (value) => result`; runs immediately, skipping the debounce       |
| `reset`         | Cancels any pending run and returns to `idle`                            |

Runs are sequence-numbered, so a slow earlier call can never overwrite a newer result, and a pending debounce is cancelled on unmount.

```javascript
const v = useInputValidation({
  validate: async (path) => {
    const r = await (
      await fetch('/api/setup/validate-comfyui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
    ).json()
    if (!r.valid) return { status: 'invalid', message: r.error }
    if (r.warnings?.length) return { status: 'warning', message: r.warnings[0] }
    return { status: 'valid', message: 'Path verified' }
  },
})

html`<${Input}
  value=${path}
  onInput=${(e) => {
    setPath(e.target.value)
    v.onValueChange(e.target.value)
  }}
  validation=${v.validation}
/>`
```

> `app-ui/app-setup/install-path-field.mjs` predates this hook and keeps its own debounce and `Pill`-based status row. It is the setup flow's only path input and was left unmigrated deliberately; its shape is what the hook's four-state design was derived from.

### SetupStepper grouped mode (`app-ui/app-setup/setup-stepper.mjs`)

Beyond its flat `steps`/`currentStep` mode, `SetupStepper` accepts `groups` — an array of `{ label, subSteps? }` — plus `activeGroupIndex` and `activeSubStepKey` to render a two-tier stepper: the usual top-level row, and a subordinate row of sub-steps (each `{ key, label, disabled? }`) beneath whichever group is currently active and defines `subSteps`. Used by the setup wizard's ComfyUI group, whose sub-flow (`disclosure → decision → auto-install | launcher → api → confirm`) is deeper than the other two groups. `disclosure` also offers a direct "Install it for me" bypass straight to `auto-install`, skipping `decision` entirely, for a user who already knows they want AnyTale to install ComfyUI.

The `launcher` sub-step (`StepLauncherSetup`, `app-ui/app-setup/steps/launcher-setup-step.mjs`) carries a Python Environment section — a `ToggleSwitch` for "Use Virtual Environment" plus a venv path `Input` (Auto-Detect button, `validation` wired to `POST /api/setup/validate-comfyui-venv`) — shown only when `GET /api/setup/disclosure`'s `platform` field is not `'win32'`. When the wizard reaches this step via the auto-install branch (`autoInstalled` prop, derived from the parent's `branch === 'auto'`), it swaps its editable form for a read-only summary of the folder/venv/launcher values ComfyUI's install already produced, since there is nothing left for the user to configure.

### ValidationMessage (`io/validation-message.mjs`)

Shared renderer behind every component's `validation` prop. Rarely used directly — reach for it when building a new control that needs the same status line.

| Export                                 | Description                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ValidationMessage`                    | Component, props `{ status, message }`. Renders `null` when the message is empty or the status is `idle`    |
| `validationBorderColor(status, theme)` | Border colour for a status; neutral for `idle` and `validating`                                             |
| `validationFocusColor(status, theme)`  | Focus-ring colour; keeps the normal primary ring for `idle`/`validating`, hands the ring to a judged status |
| `validationPanelColor(status)`         | `Panel` `color` prop _name_ for a status (not a resolved colour); `undefined` for `idle`/`validating`       |

### Sizing and composition

Every control takes one shared `size` prop (`tiny | small | medium | large`, default `medium`; `Pill` defaults to `tiny`), so controls placed beside each other at the same size line up, and a button embedded inside a field renders one size down. Layout `gap` and Panel `padding` use the same names — controls of size S sit at `gap=S`, with groups and panel padding one step up. Width is chosen separately through `widthScale` (`compact | normal | wide | full | auto`) and never changes with `size`.

The full scales (heights, fonts, icon sizes, secondary-control tokens, spacing and width tables), the nesting and pairing rules, and recipes for common combinations live in [`public/js/custom-ui/COMPOSITION.md`](../public/js/custom-ui/COMPOSITION.md), which travels with the library via `lib-sync`.

### Button (`io/button.mjs`)

Themed button on the [control size scale](../public/js/custom-ui/COMPOSITION.md#control-size-scale). **Class component**. Content is inferred: `icon` (or `loading`) with no children renders icon-only and square (width = height = the step height); children with no icon render text; both render icon + text.

| Prop         | Type     | Default       | Description                                                                                                                                                                                                                                       |
| ------------ | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`       | string   | `'medium'`    | `'tiny'`, `'small'`, `'medium'`, `'large'` — all dimensions come from `theme.controlSize[size]`                                                                                                                                                   |
| `variant`    | string   | `'default'`   | Appearance only: `'default'` or `'chip'` (fully rounded at the given size). Legacy values (`small-text`, …) warn and render default                                                                                                               |
| `color`      | string   | `'secondary'` | `'primary'`, `'secondary'`, `'success'`, `'danger'`, `'transparent'`                                                                                                                                                                              |
| `icon`       | string   | —             | ICON_MAP key from `layout/icon.mjs` (translated to a Material Symbol name internally) — not a raw Material Symbol name                                                                                                                            |
| `loading`    | boolean  | `false`       | Show loading spinner                                                                                                                                                                                                                              |
| `disabled`   | boolean  | `false`       | Disable interaction                                                                                                                                                                                                                               |
| `tooltip`    | string   | —             | Tooltip via `TooltipContext` on hover. Also works while `disabled`/`loading`: the hover handlers then move to a wrapper span that takes over the button's width/flex (and any positioning `style`), since a disabled button fires no mouse events |
| `widthScale` | string   | `'auto'`      | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`. An icon-only button at `auto` stays square                                                                                         |
| `onClick`    | function | —             | Click handler                                                                                                                                                                                                                                     |

Text buttons at `medium` keep a 120px min-width; other sizes size to content.

```javascript
html`<${Button}>Save<//>` // medium text
html`<${Button} icon="save" color="primary">Save<//>` // medium icon + text
html`<${Button} size="small" icon="trash" color="danger" />` // small icon-only, 34×34
html`<${Button} variant="chip" size="tiny">tag<//>` // tiny rounded chip
```

### Input (`io/input.mjs`)

Text/number/email/password input with prefix/suffix icon support and validation state.

| Prop          | Type     | Default    | Description                                                                                                                                                                                                                                                                                                                               |
| ------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`        | string   | `'text'`   | HTML input type                                                                                                                                                                                                                                                                                                                           |
| `value`       | string   | —          | Controlled value                                                                                                                                                                                                                                                                                                                          |
| `placeholder` | string   | —          | Placeholder text                                                                                                                                                                                                                                                                                                                          |
| `onChange`    | function | —          | Change handler                                                                                                                                                                                                                                                                                                                            |
| `validation`  | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                                                                                                                                   |
| `prefix`      | string   | —          | Prefix ICON_MAP key from `layout/icon.mjs` (translated to a Material Symbol name internally) — not a raw Material Symbol name                                                                                                                                                                                                             |
| `suffix`      | string   | —          | Suffix ICON_MAP key from `layout/icon.mjs` (translated to a Material Symbol name internally) — not a raw Material Symbol name                                                                                                                                                                                                             |
| `size`        | string   | `'medium'` | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale): `'tiny'`, `'small'`, `'medium'`, `'large'` — sets height, font size, padding, and border radius                                                                                                                                                                 |
| `widthScale`  | string   | `'normal'` | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default)                                                                                                                                                                          |
| `buttonProps` | object   | —          | Optional icon action button absolutely positioned inside the input; `{ icon, color?, disabled?, onClick, title?, tooltip?, loading? }` (`tooltip` routes through `TooltipContext` and shows even while disabled). Component's own `disabled` is OR-ed with `buttonProps.disabled`. Renders one size down, centred (see the nesting rule). |

### Textarea (`io/textarea.mjs`)

Multi-line text input with auto-adjusting height.

| Prop          | Type               | Default    | Description                                                                                                                                                                                                             |
| ------------- | ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`       | string             | —          | Controlled value                                                                                                                                                                                                        |
| `placeholder` | string             | —          | Placeholder text                                                                                                                                                                                                        |
| `onChange`    | function           | —          | Change handler                                                                                                                                                                                                          |
| `validation`  | object             | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                 |
| `size`        | string             | `'medium'` | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale); sets font size, padding, border radius, and embedded button size only — height is not controlled by `size` (80px min-height, vertical resize) |
| `widthScale`  | string             | `'full'`   | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default)                                                        |
| `buttonProps` | object \| object[] | —          | One icon button or a horizontal row of them pinned top-right inside the textarea; each renders one size down, `controlSize[size].gap` apart (see the nesting rule)                                                      |

### Checkbox (`io/checkbox.mjs`)

Styled checkbox with label support.

| Prop         | Type     | Default         | Description                                                                                                                                                                                              |
| ------------ | -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked`    | boolean  | `false`         | Checked state                                                                                                                                                                                            |
| `onChange`   | function | —               | Change handler                                                                                                                                                                                           |
| `label`      | string   | —               | Label text                                                                                                                                                                                               |
| `size`       | string   | `'medium'`      | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): box, check glyph, and label text                                                                                                  |
| `widthScale` | string   | label-dependent | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`. Default `full` when labeled, `auto` (min-content) when not; labeled `auto` fits the label |
| `validation` | object   | —               | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                  |

### Toggle Switch (`io/toggle-switch.mjs`)

On/off toggle control.

| Prop         | Type     | Default    | Description                                                                                                                                                                           |
| ------------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked`    | boolean  | `false`    | Toggle state                                                                                                                                                                          |
| `onChange`   | function | —          | Change handler, called with the native change `Event` — read `e.target.checked`, not the argument itself                                                                              |
| `size`       | string   | `'medium'` | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): track, knob, and label text                                                                                    |
| `widthScale` | string   | `'auto'`   | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`. A fixed width applies to the whole switch; the label absorbs the slack |
| `validation` | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                               |

`onChange` receives the event, not a boolean. Treating the argument as the checked state stores an `Event` in form state, which then fails `JSON.stringify` on save (see `app-ui/config/services-config-tab.mjs`, where six toggles did exactly this).

### Slider (`io/slider.mjs`)

Linear slider with label and value display.

| Prop         | Type     | Default    | Description                                                                                                                                                      |
| ------------ | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`        | number   | `0`        | Minimum value                                                                                                                                                    |
| `max`        | number   | `100`      | Maximum value                                                                                                                                                    |
| `value`      | number   | —          | Current value                                                                                                                                                    |
| `onChange`   | function | —          | Change handler                                                                                                                                                   |
| `label`      | string   | —          | Display label                                                                                                                                                    |
| `size`       | string   | `'medium'` | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): track row, thumb, track, value box (the label above stays 14px)                           |
| `widthScale` | string   | `'normal'` | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default) |
| `validation` | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                          |

### Range Slider (`io/range-slider.mjs`)

Dual-handle range selector for selecting a value range. **Class component** (uncontrolled after mount — does not re-sync to `min`/`max` prop changes; use a `key` prop to force remount when a saved value needs to reload).

| Prop         | Type     | Default    | Description                                                                                                                                                      |
| ------------ | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minAllowed` | number   | `0`        | Lower bound of the slider track                                                                                                                                  |
| `maxAllowed` | number   | `100`      | Upper bound of the slider track                                                                                                                                  |
| `min`        | number   | —          | Initial left-handle value (defaults to `minAllowed`)                                                                                                             |
| `max`        | number   | —          | Initial right-handle value (defaults to `maxAllowed`)                                                                                                            |
| `snap`       | number   | `1`        | Step increment                                                                                                                                                   |
| `size`       | string   | `'medium'` | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): track row, thumbs, track, bounds boxes (the label above stays 14px)                       |
| `widthScale` | string   | `'normal'` | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default) |
| `onChange`   | function | —          | `({ min, max }) => void`                                                                                                                                         |
| `validation` | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                          |

### MultiSelect (`io/multi-select.mjs`)

Button that opens a portal-rendered popover checklist below (or above, if near viewport bottom). Selection is tracked as an array of string values. Closes on outside click or Escape. Keyboard-operable through [`useListboxKeyboard`](#uselistboxkeyboard-iouse-listbox-keyboardmjs): Enter or Space ticks or unticks the highlighted row and keeps the list open; Escape, Tab, and Alt+↑ close it.

| Prop          | Type                                                   | Default     | Description                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`     | `{ label: string, value: string, tooltip?: string }[]` | `[]`        | Available options as `{ label, value }` objects; optional `tooltip` string shown on hover                                                                                                                                                                                                                                            |
| `value`       | string[]                                               | `[]`        | Currently selected values                                                                                                                                                                                                                                                                                                            |
| `onChange`    | function                                               | —           | `(values: string[]) => void`                                                                                                                                                                                                                                                                                                         |
| `label`       | string                                                 | —           | Label displayed above the button                                                                                                                                                                                                                                                                                                     |
| `placeholder` | string                                                 | `'Select…'` | Shown when nothing is selected                                                                                                                                                                                                                                                                                                       |
| `widthScale`  | string                                                 | `'normal'`  | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`. `auto` hugs the selected labels                                                                                                                                                                                       |
| `size`        | string                                                 | `'medium'`  | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale): `'tiny'`, `'small'`, `'medium'`, `'large'` — sets trigger height, font size, and border radius                                                                                                                                                             |
| `buttonProps` | object                                                 | —           | Optional icon action button rendered left of the value text inside the trigger; `{ icon, color?, disabled?, onClick, title?, tooltip?, loading? }` (`tooltip` routes through `TooltipContext` and shows even while disabled). `e.stopPropagation()` prevents dropdown toggle. Renders one size down, centred (see the nesting rule). |
| `validation`  | object                                                 | —           | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                                                                                                                              |

```javascript
html`
  <${MultiSelect}
    label="Keys"
    options=${[
      { label: 'C major', value: 'C major' },
      { label: 'A minor', value: 'A minor' },
    ]}
    value=${genre.keys}
    onChange=${(keys) => setField('keys', keys)}
    widthScale="full"
  />
`
// With tooltip on each option
html`
  <${MultiSelect}
    label="Time Signatures"
    options=${[
      { label: '2/4', value: '2' },
      { label: '3/4', value: '3' },
      { label: '4/4', value: '4' },
      { label: '6/8', value: '6' },
    ]}
    value=${genre.timeSignatures}
    onChange=${(sigs) => setField('timeSignatures', sigs)}
    widthScale="full"
  />
`
```

### Pill (`io/pill.mjs`)

Pill-shaped tag/chip element with five color themes (`primary`, `secondary`, `warning`, `success`, `danger`) and two variants (`filled`, `outlined`). Supports these usage patterns, which are composable:

| Pattern           | Props used                            | Behaviour                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static            | —                                     | Text only                                                                                                                                                                                                                                                                                                                    |
| Dismiss           | `onDismiss`                           | × button on the left; fires `onDismiss()`                                                                                                                                                                                                                                                                                    |
| Interactive icon  | `icon`, `iconSide`, `onIconClick`     | Separately clickable icon (left or right)                                                                                                                                                                                                                                                                                    |
| Template toggle   | `options`, `onTemplateChange`         | Clicking a `{{slot}}` token in children opens a [PillSelectPanel](#pillselectpanel-iopill-select-panelmjs) of `options` anchored under that token; a pick rewrites the slot and fires `onTemplateChange`. With **no** `options` the token renders as a static translucent inner bubble (no pointer cursor, no click handler) |
| Whole-pill select | `selectOptions`, `onSelect`, `value?` | Clicking the pill body opens a PillSelectPanel of `selectOptions` anchored under the pill; a pick fires `onSelect(value)`. Takes precedence over `onClick` (both passed logs a warning)                                                                                                                                      |
| Clickable body    | `onClick`, `value?`                   | Whole pill body is a click target; hover brightens (filled) or tints bg (outlined)                                                                                                                                                                                                                                           |

| Prop               | Type           | Default     | Description                                                                                                                                                             |
| ------------------ | -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`            | string\|object | `'primary'` | Color theme name, or a raw `{ text, background, border }` token object (e.g. `theme.colors.tagOrigin.expanded`); ignored for `outlined` shell (still tints slot tokens) |
| `variant`          | string         | `'filled'`  | `'filled'` (solid color bg) or `'outlined'` (transparent bg + neutral border + text.primary)                                                                            |
| `disabled`         | boolean        | `false`     | Mutes all interaction                                                                                                                                                   |
| `onDismiss`        | function       | —           | Enables × button                                                                                                                                                        |
| `icon`             | string         | —           | ICON_MAP key from `layout/icon.mjs` (translated to a Material Symbol name internally) — not a raw Material Symbol name                                                  |
| `iconSide`         | string         | `'left'`    | `'left'` or `'right'`                                                                                                                                                   |
| `onIconClick`      | function       | —           | Makes the icon button clickable                                                                                                                                         |
| `iconColor`        | string         | —           | Override icon color (defaults to pill text color)                                                                                                                       |
| `options`          | string[]       | —           | Choices for `{{slot}}` tokens, listed in the token's PillSelectPanel                                                                                                    |
| `onTemplateChange` | function       | —           | `(newChildren: string) => void`                                                                                                                                         |
| `onClick`          | function       | —           | `(value: string) => void`; makes the pill body clickable                                                                                                                |
| `selectOptions`    | array          | —           | Whole-pill choices: strings or `{ value, label?, color? }`; a body click opens a PillSelectPanel of them. An option's own `color` overrides the pill's                  |
| `onSelect`         | function       | —           | `(value) => void`; fired when a `selectOptions` pick differs from the current value                                                                                     |
| `tooltip`          | string         | —           | Text shown through `TooltipContext` while the pill is hovered, as `Button` does; ignored outside a `TooltipProvider`                                                    |
| `value`            | string         | —           | Value passed to `onClick`, and the current value a `selectOptions` panel outlines; falls back to `children` if it is a plain string                                     |
| `size`             | string         | `'tiny'`    | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): height, text, icons, padding. Defaults to `tiny` — the one control whose default is not `medium` |
| `widthScale`       | string         | `'auto'`    | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`                                                           |

```javascript
// Static
html`<${Pill} color="primary">hello<//>`

// Dismiss
html`<${Pill} color="primary" onDismiss=${remove}>hello<//>`

// Clickable body — browse on click
html`<${Pill} color="secondary" onClick=${(v) => openDef(v)}>long hair<//>`

// Outlined + template toggle (a token click opens a panel of `types`)
html`<${Pill}
  variant="outlined"
  color="primary"
  options=${types}
  onTemplateChange=${setVal}
  >${val}<//
>`

// Whole-pill select — the label shows, the value is what onSelect receives
html`<${Pill}
  color="secondary"
  value=${op}
  selectOptions=${[
    { value: 'is', label: 'exactly', color: 'success' },
    { value: 'not', label: 'not', color: 'danger' },
  ]}
  onSelect=${setOp}
  >${opLabel}<//
>`
```

### PillSelectPanel (`io/pill-select-panel.mjs`)

Anchored popup that lists a pill's choices as a vertical column of option rows: `Select`'s popover rows scaled to the panel's control size (`getControlSize(theme, size)` — 24px rows at the default `tiny`), neutral until hovered or pressed, when they take their option's colour. `Pill` renders it for both its slot tokens and `selectOptions`, so most callers never use it directly; it is exported for hosts that build pills outside Preact (TagInput's DOM-built template pills open it from a vanilla click handler through a `useState` setter).

It is **stateless**: the host owns the open state and passes the opener's rect as `anchorRect`, or `null` for closed. The panel portals to `document.body` (root `[data-pill-select-panel]`) at `z-index: 20000` — above modal overlays (`BaseOverlay`, 10000), level with `AutocompleteDropdown`, below tooltips (30000). It sits under the anchor and flips above it when there is no room below. It scrolls past `getPopoverMaxHeight(theme, size)` (see [COMPOSITION.md](../public/js/custom-ui/COMPOSITION.md#secondary-controls)), and scrolls the current option into view on open.

Option rows render at the panel's `size` (the source pill's size). At rest they are neutral, like `Select`'s rows; on hover a row fills with its colour's `hover` token and when pressed its `active` token — the panel's `color`, unless an option carries its own. Every row looks the same — the current `value` gets no highlight of its own (an A-B experiment against the earlier column of `Pill`s, with the current one `outlined`). A pick other than the current value fires `onSelect`; any pick, Escape, or a mousedown outside the panel fires `onClose`. There is no arrow-key or type-ahead navigation, which matches `Select`.

| Prop         | Type           | Default     | Description                                                                                           |
| ------------ | -------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `anchorRect` | object\|null   | —           | `{ top, bottom, left, width }` of the opener (e.g. `getBoundingClientRect()`); `null` renders nothing |
| `options`    | array          | `[]`        | Strings or `{ value, label?, color? }`                                                                |
| `value`      | any            | —           | Current value; scrolled into view on open, drawn like every other row                                 |
| `size`       | string         | `'tiny'`    | The source pill's size: sets the option rows' size and the scroll threshold                           |
| `color`      | string\|object | `'primary'` | The source pill's colour (theme name or `{ text, background, border }`)                               |
| `onSelect`   | function       | —           | `(value) => void`; a pick other than the current value                                                |
| `onClose`    | function       | —           | `() => void`; after any pick, on Escape, and on an outside mousedown                                  |

```javascript
const [anchor, setAnchor] = useState(null)
html`<${PillSelectPanel}
  anchorRect=${anchor}
  options=${['and', 'or']}
  value=${current}
  size="tiny"
  color="secondary"
  onSelect=${setCurrent}
  onClose=${() => setAnchor(null)}
/>`
```

### ContentEditablePillInput (`io/content-editable-pill-input.mjs`)

`contenteditable` div where confirmed entries become dismissible pill spans. Features an autocomplete dropdown while typing, comma/tab/blur auto-confirm, and optional multiline mode.

| Prop                   | Type     | Default    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `values`               | string[] | `[]`       | Controlled pill array; `'\n'` encodes a line break                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `onValuesChange`       | function | —          | `(values: string[]) => void`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `suggestions`          | string[] | `[]`       | Autocomplete candidates, and the known list for `flagUnknown`. Values already present as pills are never offered in the dropdown (matched trimmed, case-insensitive, spaces ≡ underscores)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `flagUnknown`          | boolean  | `true`     | Mark an **unknown** pill — one whose value is not in `suggestions` (same matching as above) — with an `alert-triangle` icon after its text, in the pill's text colour, without changing its height; the pill also carries `data-pill-unknown`. A "double-check this is intended" nudge, not a rejection. Nothing is flagged while `suggestions` is empty; flags refresh in place (focus and caret kept) whenever the list changes. See [Unknown pills](#unknown-pills)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `label`                | string   | —          | Label above the editor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `placeholder`          | string   | `''`       | Hint when editor is empty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `disabled`             | boolean  | `false`    | Disable editing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `multiline`            | boolean  | `false`    | Enter inserts a line break                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `fixedHeight`          | number   | —          | Fixed height in px; enables scroll overflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `renderPill`           | function | —          | `(value: string, { pillSize, unknown }) => HTMLElement \| null`; custom pill renderer. `pillSize` is the [pill nesting](../public/js/custom-ui/COMPOSITION.md#secondary-controls) step for this editor (`pillSizeInField(size)`) so the renderer can size its pill; `unknown` is `true` for an unknown pill, and the renderer draws the warning itself by appending `createUnknownIconEl(pillSize, textColor)` (exported from the same module). The editor sets `data-pill-unknown` on the returned element and re-calls `renderPill` to replace it when the flag changes. Single-argument renderers keep working                                                                                                                                                                                                                                                                                                                                          |
| `onContainerReady`     | function | —          | `(el: HTMLElement) => void`; fired after mount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `onPillClick`          | function | —          | `(value: string) => void`; fires when a pill body is clicked (not dismiss/slot). Ctrl+click is reserved for multi-select and never fires `onPillClick`. Pills gain `cursor: pointer` + hover brightness when this is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `getPillTooltip`       | function | —          | `(value: string) => string \| null`; returns tooltip text shown on pill hover. Returning `null` **dismisses** any visible tooltip rather than doing nothing — `mouseleave` is bound to the container and does not bubble, so a no-op would leave the previous pill's text on screen when the cursor moves pill→pill. Hovering the gap between pills dismisses for the same reason. `TagInput` uses this to skip template pills (`{{` prefix) and to show `No definition` for a known tag with no entry; when its `slotContextParts` prop (parts list, default `[]`) is non-empty, a `{{type}}` template with no definition of its own is first resolved against those parts (first fulfilling part's `referenceTag`) and shown as `<substituted tag>: <definition>`. On an unknown pill the fixed line `not in suggestion list` is appended to the returned text, or shown alone when `getPillTooltip` is absent or returns `null`; it is not overridable. |
| `size`                 | string   | `'medium'` | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale); sets the editor's min-height, font size, and border radius, and the pill step via the [pill nesting rule](../public/js/custom-ui/COMPOSITION.md#secondary-controls). The editor still grows as pills and lines wrap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `widthScale`           | string   | `'full'`   | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `buttonProps`          | object   | —          | Primary icon button inside the editor's top-right corner; `{ icon, color?, disabled?, onClick, title?, tooltip?, loading? }` (`tooltip` routes through `TooltipContext` and shows even while disabled). Renders one size down, inset `(stepHeight − buttonHeight) / 2` from the top and right (see the nesting rule). Input gains right-padding automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `secondaryButtonProps` | object   | —          | Secondary icon button stacked one `buttonHeight + controlSize[size].gap` below the primary; same shape as `buttonProps`. Both buttons share one column, so the right padding is the same as for one button; the editor's min-height grows to fit both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `validation`           | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### Unknown pills

The editor owns the decision (known set, matching, the empty-list gate, `data-pill-unknown`, in-place refresh, the tooltip line); renderers own the drawing — plain pills get the icon from the editor, a custom `renderPill` draws it from its `unknown` argument. Both wrappers take `flagUnknown` (default `true`) and forward it: `ChipAutocompleteInput` passes it straight through, and `TagInput` holds it off until its suggestion list is known — immediately when a `suggestions` prop is supplied, otherwise once `loadTags()` settles (resolved or failed), since `getTags()` may hold only registered extras before `/tags` resolves. Without a `suggestions` prop it also subscribes to the tag store (`subscribeTags` in `app-ui/tags/tags.mjs`) and re-reads `getTags()` whenever extras are registered or `/tags` loads, so late extras update its suggestions and its unknown flags in place. `TagInput` checks template (`{{type}}`) and expression (`{{id}} expression`) pills exactly like plain tags. Pass `flagUnknown=${false}` on a field that authors new values rather than picking known ones.

### useAutocomplete (`io/use-autocomplete.mjs`)

Hook that manages autocomplete dropdown state and exposes stable function refs safe to call from inside `useEffect([])` closures. Composed by `ContentEditablePillInput` and available for any input type.

```js
const { dropdownState, showDropdownRef, closeDropdownRef, handleDropdownKeyDownRef, handleDropdownClick } =
  useAutocomplete({ suggestions, getAnchorRect, onConfirm, maxResults?, showEmptyOnNoResults? });
```

| Option                 | Type                 | Default | Description                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suggestions`          | string[] \| function | —       | Full candidate list; filtered internally. May be a `() => string[]` getter instead, called each time the dropdown opens, so a caller can derive the list from live state at show time (`ContentEditablePillInput` uses this to drop values already present as pills)                                                                                                                      |
| `getAnchorRect`        | function             | —       | `() => DOMRect \| null`; positions the dropdown. For plain `<textarea>` elements, use `getTextareaCaretRect(textarea)` (`custom-ui/util.mjs`) instead of the element's own `getBoundingClientRect()` so the dropdown anchors to the caret rather than the textarea's bounds; contenteditable elements should use selection-based rects (see `ContentEditablePillInput`'s `getCaretRect`). |
| `onConfirm`            | function             | —       | `(item: string) => void`; called on confirm                                                                                                                                                                                                                                                                                                                                               |
| `maxResults`           | number               | `20`    | Cap on filtered results shown                                                                                                                                                                                                                                                                                                                                                             |
| `showEmptyOnNoResults` | boolean              | `true`  | When `false`, zero matches closes the dropdown instead of showing "No matches"                                                                                                                                                                                                                                                                                                            |

All returned function refs are stable (`useRef`-initialized). `handleDropdownKeyDownRef.current(e)` handles ArrowDown/Up, Escape, Tab, Enter and returns `true` when it consumed the event.

### AutocompleteDropdown (`io/autocomplete-dropdown.mjs`)

Stateless component that renders the autocomplete dropdown list. Pair with `useAutocomplete`.

| Prop            | Type     | Default | Description                                    |
| --------------- | -------- | ------- | ---------------------------------------------- |
| `dropdownState` | object   | —       | State object from `useAutocomplete`            |
| `onItemClick`   | function | —       | `(item: string) => void`; fired on `mousedown` |

Renders nothing when `dropdownState.visible` is `false`. Each item renders with a stable `id="ac-dropdown-item-${i}"`; an internal effect keyed on `dropdownState.index` scrolls the active item into view (`scrollIntoView({ block: 'nearest' })`) via `document.getElementById`, keeping keyboard navigation visible when the list exceeds the dropdown's `max-height`.

### AutocompleteInput (`io/autocomplete-input.mjs`)

Themed `Input` composed with `useAutocomplete` + `AutocompleteDropdown` into a single drop-in field. Unlike `ChipAutocompleteInput`/`TagInput`, it never converts the confirmed value into a pill — it stays an ordinary controlled free-text field, so it's the right choice for a single scalar string value (e.g. a "Section" field) that should suggest from known values while still accepting arbitrary free text.

| Prop            | Type                             | Default            | Description                                                                                                                                                                                                           |
| --------------- | -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`         | string                           | —                  | Label above the input                                                                                                                                                                                                 |
| `placeholder`   | string                           | —                  | Placeholder text                                                                                                                                                                                                      |
| `suggestions`   | string[]                         | `[]`               | Autocomplete candidates                                                                                                                                                                                               |
| `value`         | string                           | —                  | Current field value (controlled)                                                                                                                                                                                      |
| `onValueChange` | function                         | —                  | `(newValue: string) => void`; called for both typed input and confirmed suggestions                                                                                                                                   |
| `disabled`      | boolean                          | `false`            | Disable interaction                                                                                                                                                                                                   |
| `widthScale`    | string                           | `'normal'`         | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default). Validated here, then forwarded to the inner `Input` |
| `size`          | string                           | `'medium'`         | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale), forwarded to the inner `Input`                                                                                                              |
| `searchItems`   | `Array<string \| {label,value}>` | `suggestions`      | Optional override for the browse-all modal's item list                                                                                                                                                                |
| `searchTitle`   | string                           | `"Select {label}"` | Modal title                                                                                                                                                                                                           |
| `showSearch`    | boolean                          | `true`             | When `false`, never render the browse-all button or its modal, even with non-empty suggestions; the typing dropdown still works                                                                                       |

When `suggestions`/`searchItems` is non-empty (and `showSearch` is not `false`), a search icon button is rendered on the input that opens a single-select `SearchSelectModal` for browsing the full candidate list.

### Discrete Slider (`io/discrete-slider.mjs`)

Stepped slider for selecting from fixed values.

| Prop         | Type     | Default    | Description                                                                                                                                                                                                                            |
| ------------ | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`      | number   | —          | Current step                                                                                                                                                                                                                           |
| `steps`      | number   | —          | Number of discrete steps                                                                                                                                                                                                               |
| `onChange`   | function | —          | Change handler                                                                                                                                                                                                                         |
| `size`       | string   | `'medium'` | [Size step](../public/js/custom-ui/COMPOSITION.md#secondary-controls): track row, thumb, track, option-label text (the label above stays 14px)                                                                                         |
| `widthScale` | string   | `'normal'` | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`; `auto` not accepted (warns and falls back to the default). A px width grows to fit the options (`options.length × label width`) |
| `validation` | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                                |

### Select (`io/select.mjs`)

Fully custom single-select dropdown with a styled trigger button and a portal-rendered options list. Flips above the trigger when there is insufficient space below. Fires `onChange({ target: { value } })` — a synthetic event — so existing callers using `(e) => e.target.value` need no changes.

Keyboard-operable through [`useListboxKeyboard`](#uselistboxkeyboard-iouse-listbox-keyboardmjs): Enter, Space, Tab, or Alt+↑ picks the highlighted option and closes (Tab also moves focus on); Escape closes without a pick.

| Prop          | Type     | Default    | Description                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`     | array    | —          | `[{ label, value }]`                                                                                                                                                                                                                                                                                                                 |
| `value`       | any      | —          | Selected value                                                                                                                                                                                                                                                                                                                       |
| `onChange`    | function | —          | `(e) => void` where `e.target.value` is the selected value                                                                                                                                                                                                                                                                           |
| `placeholder` | string   | —          | Shown when nothing is selected                                                                                                                                                                                                                                                                                                       |
| `label`       | string   | —          | Label above the trigger                                                                                                                                                                                                                                                                                                              |
| `disabled`    | boolean  | `false`    | Disable interaction                                                                                                                                                                                                                                                                                                                  |
| `validation`  | object   | —          | Validation result `{ status, message }`; see [Field validation](#field-validation--the-validation-prop)                                                                                                                                                                                                                              |
| `widthScale`  | string   | `'normal'` | [Width scale](../public/js/custom-ui/COMPOSITION.md#width-scale): `compact`, `normal`, `wide`, `full`, `auto`. `auto` hugs the selected label; the dropdown menu stays at least as wide as the trigger                                                                                                                               |
| `size`        | string   | `'medium'` | [Control size](../public/js/custom-ui/COMPOSITION.md#control-size-scale): `'tiny'`, `'small'`, `'medium'`, `'large'` — sets trigger height, font size, padding, and border radius; the chevron uses the step's `iconSize` (equal to its font size)                                                                                   |
| `buttonProps` | object   | —          | Optional icon action button rendered left of the value text inside the trigger; `{ icon, color?, disabled?, onClick, title?, tooltip?, loading? }` (`tooltip` routes through `TooltipContext` and shows even while disabled). `e.stopPropagation()` prevents dropdown toggle. Renders one size down, centred (see the nesting rule). |

### useListboxKeyboard (`io/use-listbox-keyboard.mjs`)

Keyboard model shared by `Select` and `MultiSelect`, for a dropdown list opened from a trigger `<button>`. Focus stays on the trigger the whole time. The open list is driven by a **highlighted** row, which the component paints and exposes as `aria-activedescendant`. Moving the highlight never fires `onChange`. A new list-style dropdown reuses this hook rather than hand-rolling its keys.

It follows the browser's own `<select>` with one deliberate difference: a key on the **closed** field never changes the value. Instead, every handled key opens the list, so a caller's `onChange` fires once per real pick.

| State  | Key                                          | Effect                                                                               |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Closed | letter                                       | opens the list with the type-ahead match highlighted                                 |
| Closed | ↑ / ↓ / Alt+↓ / F4 / Space / Enter           | opens the list at `initialIndex`                                                     |
| Closed | Home / End                                   | opens the list with the first / last enabled option highlighted                      |
| Open   | ↑ / ↓ / Home / End / PgUp / PgDn (10 rows)   | moves the highlight, skipping disabled options, without wrapping                     |
| Open   | letter                                       | type-ahead                                                                           |
| Open   | Enter, or Space while no letters are pending | `single`: picks and closes. `multi`: toggles and keeps the list open                 |
| Open   | Tab                                          | `single`: picks and closes; focus moves on (not `preventDefault`ed). `multi`: closes |
| Open   | Alt+↑ / Alt+↓ / F4                           | `single`: picks and closes. `multi`: closes                                          |
| Open   | Escape                                       | closes without a pick; `stopPropagation`ed so a surrounding modal stays open         |

**Type-ahead:**

- **Matching.** Case-insensitive, against the start of each option's `label`; disabled options are skipped.
- **Cycling.** Pressing one letter repeatedly moves through every option that starts with it, wrapping at the end.
- **Longer buffers.** Letters typed in quick succession match together ("ne" → New York). The buffer resets after `TYPEAHEAD_RESET_MS` (1000 ms) without a key.
- **Space.** While letters are still being typed, Space joins the search ("New York") rather than picking.

The pure matcher is exported as `findTypeaheadMatch(options, buffer, current)`.

```javascript
const kb = useListboxKeyboard({
  options, // [{ label, disabled? }]
  open,
  initialIndex, // highlighted on open: Select's value, MultiSelect's first checked row
  mode: 'single', // or 'multi'
  disabled,
  onOpen: (triggerEl) => openAt(triggerEl),
  onClose: () => setOpen(false),
  onCommit: (index) => pick(options[index]),
  getRowEl: (index) => document.getElementById(rowId(index)), // scrolled into view
})
// <button onKeyDown=${kb.onKeyDown} onKeyUp=${kb.onKeyUp} …>; paint kb.highlightedIndex;
// row onMouseEnter → kb.setHighlightedIndex(i). The popover's onMouseDown should
// preventDefault so a mouse pick leaves focus on the trigger.
```

---

## Layout Components

**Directory**: `layout/`

### Page (`layout/page.mjs`)

Root application container that initializes the theme system, applies global styles, and supports dark/light mode switching. Every page must use this component as its outermost wrapper.

```javascript
html`<${Page}><${App} /><//>`
```

### Panel (`layout/panel.mjs`)

Themed container with multiple visual variants. **Class component**.

| Prop      | Type   | Default     | Description                                                                                                                                                                               |
| --------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant` | string | `'default'` | `'default'`, `'elevated'`, `'outlined'`, `'glass'`                                                                                                                                        |
| `padding` | string | `'medium'`  | `'tiny'`, `'small'`, `'medium'`, `'large'` (2 / 4 / 8 / 16px — see [Spacing scale](../public/js/custom-ui/COMPOSITION.md#spacing-scale)); unknown values warn and fall back to `'medium'` |

### Icon (`layout/icon.mjs`)

Renders Material Symbol icons or custom SVGs.

| Prop   | Type   | Default | Description                                                                                                            |
| ------ | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `name` | string | —       | ICON_MAP key from `layout/icon.mjs` (translated to a Material Symbol name internally) — not a raw Material Symbol name |
| `size` | string | —       | Icon size override                                                                                                     |

A name absent from `ICON_MAP` renders an empty placeholder (matching `size`) rather than erroring, so new icons must be added to the map before use — e.g. `paperclip` → `attach_file`, added for the LLM Playground's attach-image button. Entries mapped to `null` in `ICON_MAP` explicitly fall back to the Boxicon icon set (wrapped in a sizing span).

### Dynamic List (`layout/dynamic-list.mjs`)

Renders a list of items with add/remove controls and optional drag-to-reorder, suitable for dynamic form arrays (e.g., model registry entries, node class-type lists).

Key props:

- `items` / `onChange(items)` — controlled array + change callback
- `renderItem(item, index)` — returns the collapsible panel body VNode
- `getTitle(item, index)` — `(item, index) => string` — plain-string header label; also used as the drag-ghost label
- `getHeaderContent(item, index)` — `(item, index) => VNode` — optional richer header content (overrides `getTitle` display; `getTitle` still drives the drag ghost)
- `headerActions` — `[{ icon, title, onClick(item, index), getDisabled?(item, index) => boolean }]`; renders small icon buttons in the item header row
- `addLabel` / `hideAddItem` — label for or hide the add button
- `condensed` — render items inline without a panel container or collapse toggle (suited for compact string lists)
- `showDragButton` / `showMoveUpDownButtons` — controls for drag or arrow-key reordering
- `onDelete(item, index)` — when provided, called instead of built-in removal (caller updates `items` via `onChange`)
- `canDrop(fromIndex, toIndex)` — predicate that cancels drag/move-up when it returns `false`

Expansion is owned by the list and needs no props. At most one unpinned item is open at a time; the header's pin button keeps an item open outside that limit, and unpinning (or a header click on a pinned item) collapses it. A row filled by the add button, or a single unsaved row (`_localId`, no `uid`) appearing in `items`, opens and scrolls into view. Condensed lists have no expansion.

### Markdown (`layout/markdown/markdown.mjs`)

Renders a markdown string as themed Preact VNodes. Drop it into any page section that shows a block of text — chat bubbles, description panels, help copy. It subscribes to `currentTheme` itself, so nothing at the call site needs to pass theme values through.

```javascript
html`<${Markdown} content=${message.content} color=${textColor} />`
```

| Prop        | Type   | Default                            | Description                                                                                              |
| ----------- | ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `content`   | string | `''`                               | Markdown source. Empty, whitespace-only, or non-string content renders an empty container without error. |
| `color`     | string | `theme.colors.text.primary`        | Text color for the rendered block.                                                                       |
| `fontSize`  | string | `theme.typography.fontSize.medium` | Body font size. The heading scale is `em`-relative, so headings scale with whatever is passed here.      |
| `renderers` | object | `{}`                               | Per-token-type renderer overrides, shallow-merged **over** `defaultRenderers`. See below.                |

Any remaining props (`style`, `className`, event handlers, …) are forwarded to the root element via `...rest`; a supplied `style` is merged after the `color`/`fontSize` defaults, so it wins.

**Whitespace is owned by the component.** The text-bearing blocks (paragraphs, list items, raw-HTML spans, headings) carry `white-space: pre-wrap` internally, so a call site must not reproduce it — a `pre-wrap` on the root would also render the newlines _between_ block elements and double every visible gap.

#### Renderer-override contract

`defaultRenderers` (exported from `layout/markdown/renderers.mjs`) maps a `marked` token `type` string to a renderer **factory**. Each factory takes one argument and returns a Preact VNode (or `null` to render nothing):

```javascript
;({
  ...token, // the token's own fields: depth, lang, href, ordered, align, text, raw, …
  children, // already-rendered VNode array for nested tokens, or null for a leaf
  renderChildren, // (tokens) => VNode[] — walker bound to the current renderer map + theme
  theme, // current theme object
  key, // stable key for the returned VNode
}) => VNode
```

The `renderers` prop is shallow-merged over `defaultRenderers`, so supplying only a `heading` factory replaces that one arm and inherits every other arm unchanged. That is the sanctioned extension point — e.g. a document-scale presentation mapping `heading` onto `H1`/`H2`/`H3` from `themed-base.mjs`. No document preset ships; only the mechanism.

`renderChildren` exists for tokens whose nested tokens do not live on a single `tokens` array — `table` keeps them on per-cell objects under `header`/`rows`. An arm that walks its own sub-token arrays should call `renderChildren` rather than recursing by hand, so caller overrides still apply inside it.

#### Supported token set

Rendered: `heading` (h1–h6 at an embedded `em` scale, not the page-scale `H1`/`H2`/`H3`), `paragraph`, `text`, `strong`, `em`, `del`, `codespan`, `code` (fenced block with a language label and a copy button — see below), `list` / `list_item` (including nested lists and GFM task items, which render a disabled checkbox), `checkbox` (the task marker token, absorbed by `list_item` — it renders nothing on its own), `blockquote`, `hr`, `br`, `space`, `table` (wrapped in an `overflow-x: auto` container so a wide table scrolls inside itself), `link`, `image`, `html`.

Two arms behave deliberately unlike a normal renderer:

- **`image` renders a link, not an `<img>`.** An image element sourced from model-authored text fires a remote request the moment it renders, leaking the page visit plus the viewer's IP and user agent to a host the user never chose to contact. This is a seam expected to be revisited; it is confined to the single `image` arm so switching to inline rendering is an edit there or a caller-supplied `renderers.image` override.
- **`html` renders literal visible text.** Raw HTML in the source — an inline `<b>` or a whole `<script>` block alike — is shown as written and never interpreted as markup.

**Fenced code blocks carry a copy button.** Every code block renders a header bar with the language label at the start and a copy-to-clipboard button at the far end. The button copies **only that block's code body** — never the language label or any surrounding prose.

The header bar renders unconditionally, including for a bare fence with no info string: it is the button's home, so it cannot be conditional on the label the way it was before the button existed. With no language the label side is simply empty and the button stays pinned to the far edge.

Because the copy confirmation (an icon swap to a tick for ~1.5s) needs state, the code block is a small component rather than a bare factory return. The `code` arm delegates to it, so a caller supplying `renderers.code` still replaces the whole thing, button included. The clipboard call is feature-checked and wrapped — `navigator.clipboard` is undefined in non-secure contexts and `writeText` rejects without focus or permission — so a copy that cannot happen leaves the button usable instead of throwing or sticking in the confirmed state.

A token type with no arm falls back to its `raw` text, so an unhandled or newly-introduced type degrades to visible source rather than throwing. `def` (link reference definitions) and `escape` take that path.

#### Safety rules

- **Only `marked.lexer()` is ever called.** `marked.parse()`, `marked.parseInline()`, and every marked renderer API are forbidden here. `lexer()` returns a nested token array and stops, producing no HTML string — so at no point does an HTML string exist to be injected, and no sanitizer (DOMPurify or otherwise) is needed. Any change that reaches for `parse()` reintroduces the entire XSS surface this design avoids.
- **No `dangerouslySetInnerHTML` and no `innerHTML`, anywhere in the component or its renderers.** Token text reaches the DOM as a Preact text child, which Preact escapes on the way in.
- **`href` is the only untrusted value that reaches a DOM attribute**, and both the `link` and `image` arms pass it through `isSafeHref`. An anchor is emitted only for `http:`, `https:`, `mailto:`, or a relative reference; anything else (`javascript:`, `data:`, `vbscript:`, `file:`) renders the label as plain text with no anchor at all. The check strips ASCII whitespace and C0/DEL control characters before reading the scheme (browsers do the same, so ` javascript:x` and `java\nscript:x` would otherwise navigate), lowercases the comparison, and treats a colon appearing after the first `/`, `?`, or `#` as part of a relative path rather than a scheme. External links get `target="_blank"` and `rel="noopener noreferrer"`.

#### Re-vendoring `marked.esm.js`

`layout/markdown/marked.esm.js` is a **vendored third-party file** — `marked` v18.0.11's `lib/marked.esm.js`, byte-identical to upstream apart from a prepended provenance header. It is not in `package.json`, needs no importmap entry on any page, and travels through [lib-sync](lib-sync.md) with the component. It is listed in `.prettierignore` and must stay byte-identical to upstream — do not hand-edit or reformat it.

To pick up a newer version (the same steps are recorded in the file's own header):

```bash
npm pack marked@<version>
tar -xzf marked-<version>.tgz
cp package/lib/marked.esm.js public/js/custom-ui/layout/markdown/marked.esm.js
```

…then restore the provenance header block at the top of the copied file, updating the recorded version.

---

## Navigation Components

**Directory**: `nav/`

### Navigation Menu (`nav/navigation-menu.mjs`)

Dropdown menu for app-wide navigation (Home, Workflow Editor, Brew Editor, Theme Toggle). **Class component**.

### Navigator (`nav/navigator.mjs`)

Pagination control with Previous/Next/First/Last buttons and page indicator.

### Button Group (`nav/button-group.mjs`)

Grouped buttons for mutually exclusive choices (radio-style). `size` (default `'small'`) is forwarded to each `Button` (see [Control size scale](../public/js/custom-ui/COMPOSITION.md#control-size-scale)).

### Tab Panels (`nav/tab-panels.mjs`)

Tabbed container that shows one panel at a time with tab navigation. `size` (default `'medium'`) is forwarded to the tab Buttons.

### Hooks

- **`use-item-navigation.mjs`**: Hook for keyboard and mouse-based item navigation in lists.
- **`use-pagination.mjs`**: Hook for managing pagination state (current page, total pages, page size).

---

## Overlay Components

**Directory**: `overlays/`

### Modal (`overlays/modal.mjs`)

Declarative modal dialog rendered via Portal to `document.body`. Also exports imperative helpers:

- `createImageModal(url)` — opens a full-screen image lightbox
- `createVideoModal(url)` — opens a full-screen video player with native controls

| Prop      | Type     | Default    | Description                                |
| --------- | -------- | ---------- | ------------------------------------------ |
| `title`   | string   | —          | Modal title                                |
| `size`    | string   | `'medium'` | `'small'`, `'medium'`, `'large'`, `'full'` |
| `onClose` | function | —          | Close handler                              |
| `footer`  | VNode    | —          | Footer content                             |

### Floating Panel (`overlays/floating-panel.mjs`)

Draggable, portal-rendered panel that stays on top of other content. Useful for persistent tool panels.

| Prop              | Type     | Default      | Description                                                                                                          |
| ----------------- | -------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `isOpen`          | boolean  | —            | Whether the panel is visible                                                                                         |
| `onClose`         | function | —            | Close handler; omit to render no close button (non-dismissible panel)                                                |
| `initialPosition` | string   | `'center'`   | `'top-left'`, `'top'`, `'top-right'`, `'right'`, `'bottom-right'`, `'bottom'`, `'bottom-left'`, `'left'`, `'center'` |
| `actions`         | array    | `[]`         | Toolbar icon buttons: `{ icon, color?, onClick }`                                                                    |
| `variant`         | string   | `'elevated'` | `'default'`, `'elevated'`, `'outlined'`, `'glass'`                                                                   |
| `width`/`height`  | string   | —            | CSS size; sizes to content if omitted                                                                                |
| `footer`          | VNode    | —            | Optional footer content (e.g. action buttons), rendered below the body                                               |

### Hover Panel (`overlays/hover-panel.mjs`)

Tooltip-style panel triggered by hover events. Requires `HoverPanelProvider` context. The panel prefers a spot above and to the right of the cursor, flipping to the opposite side of either axis when that placement would overflow the viewport, then clamping back inside the viewport bounds as a backstop; the geometry comes from `positionOverlay` in `custom-ui/util.mjs`.

```javascript
html`
  <${HoverPanelProvider}>
    <${MyComponent} />
  <//>
`
```

### List Select (`overlays/list-select.mjs`)

Popup list overlay for selecting from many options. Useful for file pickers and tag selectors. `ListSelectModal` is the component (default export); `showListSelect(options)` is a portal convenience wrapper that does not forward `onReorder`, `searchable`, or `searchPlaceholder`.

- **`onReorder(nextItems)`** — renders a drag handle on each row; called with the reordered `items` array on drop.
- **`searchable`** (default `false`) — renders a search `Input` above the list that filters rows by `label` (case-insensitive substring, source order preserved). Whitespace-only text counts as no filter. The filter resets and the input takes focus each time `isOpen` turns true. A filter with no matches shows `No matches for "<text>"`.
- **`searchPlaceholder`** (default `'Search…'`).
- **Reorder is disabled while filtered.** Whenever filter text is present, every row's drag handle renders disabled. Drag indices address the full, unfiltered `items` array, so a drag must never start from a filtered view; the disable is the guard, not an index remap.

### Dialog (`overlays/dialog.mjs`)

Low-level imperative dialog API (`show()` / `dismiss()`).

### Tooltip (`overlays/tooltip.mjs`)

Cursor-anchored tooltip with a 600ms hover delay. Uses the context/provider pattern. The tooltip prefers a spot below and to the right of the cursor, flipping to the opposite side of either axis when that placement would overflow the viewport, then clamping back inside the viewport bounds as a backstop; the geometry comes from `positionOverlay` in `custom-ui/util.mjs`.

```javascript
// Wrap app in provider
html`<${TooltipProvider}><${App} /><//>`

// Use in any child component
const tooltip = useTooltip()
// onMouseEnter=${(e) => tooltip.show('Help text', e.clientX, e.clientY)}
// onMouseLeave=${() => tooltip.hide()}
```

### Search Select (`overlays/search-select.mjs`)

Full-screen modal for selecting from large datasets with real-time search filtering. Supports single and multi-select modes. Items can be strings or `{ label, value }` objects.

| Prop              | Type     | Default    | Description                                                                                                |
| ----------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `isOpen`          | boolean  | —          | Controls visibility                                                                                        |
| `title`           | string   | —          | Modal title                                                                                                |
| `items`           | array    | —          | `string[]` or `{ label, value }[]`                                                                         |
| `mode`            | string   | `'single'` | `'single'` or `'multi'`                                                                                    |
| `initialSelected` | array    | `[]`       | Pre-selected values (multi mode)                                                                           |
| `itemActions`     | array    | —          | Per-row small icon-only action buttons: `{ icon, title, color?, onClick(item), closeAfter?, disabled? }[]` |
| `onSelect`        | function | —          | `(value) => void` or `(value[]) => void`                                                                   |
| `onClose`         | function | —          | Close handler                                                                                              |

`itemActions` buttons render on the right of each row in both modes; `onClick` receives the normalised item (`{ label, value, subtitle }`) and never triggers the row's select/toggle. `closeAfter: true` closes the modal after the action runs. Used by the AnyTale editor's Load modals for the shared Clone convention (`icon: 'copy'`, `title: 'Clone'`, `closeAfter: true`).

---

## Message & Feedback Components

**Directory**: `msg/`

### Toast (`msg/toast.mjs`)

Toast notification system using Preact Context. Provides the `useToast()` hook.

```javascript
import { ToastProvider, useToast } from '/js/custom-ui/msg/toast.mjs'

// Wrap app in provider
html`<${ToastProvider}><${App} /><//>`

// Use in any child component
const toast = useToast()
toast.show('Operation completed', 'success')
```

### Progress Banner (`msg/progress-banner.mjs`)

Top-of-page progress bar for long-running tasks. **Class component**. Listens to progress updates via context. Accepts `suppressTitle` (boolean, default `false`) to skip all `document.title` updates from its SSE handlers — used when the host page owns the page title itself (see `ProgressProvider`'s `hideBanners` below).

**Time left.** While generating, a progress event carrying `remainingSeconds` (the server's estimate of the task's time left, added by `emitProgressUpdate`; see `docs/server.md`'s "Generation Workflow") is shown beside the percentage as `40% · 2m14s left`, formatted with `formatGenerationTime` (`custom-ui/util.mjs`). An event without it shows the percentage alone, so a task with no estimate shows no guess. The estimate arrives on the progress payload rather than through queue status because `ProgressProvider` lives in `custom-ui/` and cannot import the app-ui queue hook. `test.html`'s "Simulate Progress (time left)" button sends a fixed `remainingSeconds`.

### Progress Context (`msg/progress-context.mjs`)

Context provider that manages progress state, used by `ProgressBanner` and task-tracking logic. `hideBanners` (boolean, default `false`) hides rendered banners while keeping subscriptions active, and is forwarded to each `ProgressBanner` as `suppressTitle`.

### FormStatusPanel (`msg/form-status-panel.mjs`)

Form-wide (non-field) status messages, rendered as an outlined `Panel`. Field-level errors belong inside the input via the `validation` prop; this is for failures that belong to the form as a whole ("Rules file has errors", "Name already in use by another preset").

| Prop       | Type       | Default     | Meaning                                                                                             |
| ---------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `messages` | `string[]` | `[]`        | One line each. One message renders as a single `Label`, two or more as a list. Empty renders `null` |
| `status`   | `string`   | `'invalid'` | `'idle' \| 'validating' \| 'valid' \| 'warning' \| 'invalid'`. `'idle'` renders `null`              |

Status → `Panel` color, via `validationPanelColor` — the same mapping the field-level hook uses, so form-level and field-level treatments match:

| Status       | `Panel` color | Result                      |
| ------------ | ------------- | --------------------------- |
| `idle`       | —             | renders nothing             |
| `validating` | `undefined`   | neutral uncolored panel     |
| `valid`      | `success`     | success background + border |
| `warning`    | `warning`     | warning background + border |
| `invalid`    | `danger`      | danger background + border  |

The component renders no title, no icon, and no margin of its own — it goes immediately above the form's action button row and the enclosing layout's gap spaces it. Because it returns `null` when empty, callers render it unconditionally:

```js
<${VerticalLayout} gap="medium">
  ...form fields...
  <${FormStatusPanel} messages=${formErrors} />
  <${HorizontalLayout} gap="medium" justifyContent="flex-end">
    ...Save / Revert / Delete...
  </${HorizontalLayout}>
</${VerticalLayout}>
```

### LogView (`msg/log-view.mjs`)

Generic, layout-agnostic scrollable monospace log viewer with a follow-tail toggle and a copy button. Purely presentational — no fixed height/positioning and no knowledge of what process (if any) produced its lines; it fills whatever box its parent gives it. The host owns fetching/streaming the lines and the `followTail` state.

| Prop                 | Type        | Default           | Meaning                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines`              | `LogLine[]` | `[]`              | `{ ts, stream, text }[]` in capture order. `stream` is `'stdout' \| 'stderr' \| 'meta'` and controls line color (danger / secondary / primary text).                                                                                                                                                                                            |
| `followTail`         | `boolean`   | `true`            | When true, auto-scrolls to bottom on every `lines` change.                                                                                                                                                                                                                                                                                      |
| `onFollowTailChange` | `Function`  | —                 | Called with the new boolean from the toggle, or with `false` when the user manually scrolls away from the bottom. A scroll counts as manual only when a wheel, touch, or scroll-key gesture landed within the last second — scrolling caused by `LogView`'s own pin-to-bottom never disables follow-tail. `LogView` never re-enables it itself. |
| `onCopy`             | `Function`  | —                 | Called when the copy button is clicked; `LogView` does not implement clipboard access — the host decides what "copy" means.                                                                                                                                                                                                                     |
| `emptyMessage`       | `string`    | `'No output yet'` | Shown via `Label` when `lines` is empty.                                                                                                                                                                                                                                                                                                        |

```js
<${LogView}
  lines=${lines}
  followTail=${followTail}
  onFollowTailChange=${setFollowTail}
  onCopy=${() => navigator.clipboard.writeText(lines.map((l) => l.text).join('\n'))}
/>
```

Follow-tail disable is gesture-gated. A `scroll` event alone is not evidence of user intent: browsers dispatch scroll events asynchronously, so during a burst of lines one queued by the component's own pin-to-bottom can land after a later render has grown `scrollHeight`, which used to read as a large manual scroll-up and silently switch follow-tail off. `LogView` now ignores scroll events fired while it is pinning, ignores any scroll with no recent input gesture behind it, and sets `overflow-anchor: none` so Chromium's scroll anchoring stops adjusting `scrollTop` when lines are inserted.

`public/js/app-ui/process-logs/process-log.mjs`'s `ProcessLog({ processId })` is the reference host: it wires `LogView` to `useProcessLog(processId)` (live SSE-backed lines/running state for a managed process) and `useToast()` for copy feedback, staying fully embeddable — no `Panel`/sizing of its own — so it drops into a setup wizard step, a modal, or a standalone page unchanged. It requires a `ToastProvider` ancestor.

### StackedMeter (`msg/stacked-meter.mjs`)

A horizontal bar of stacked segments against a maximum, with an optional peak tick. Layout-agnostic: it takes its parent's full width; its height (`meter.height`), tick geometry (`meter.tickWidth`, `meter.tickOverhang`), and track and tick colours (`colors.meter.track`, `colors.meter.tick`) come from theme tokens.

| Prop        | Type                             | Default    | Description                                                                                                                                 |
| ----------- | -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `segments`  | `Array<{ value, color, label }>` | `[]`       | Drawn left to right. `color` is a theme colour group name (`primary`, `danger`, …) or a CSS colour; `label` is the segment's hover tooltip. |
| `max`       | `number`                         | —          | The value the full bar represents.                                                                                                          |
| `marker`    | `{ value, tooltip? }`            | —          | A thin vertical tick at `value` (clamped to the bar) that shows `tooltip` through the TooltipContext on hover.                              |
| `overColor` | `string`                         | `'danger'` | When the segments sum past `max`, the fill is clamped to the full bar and drawn in this colour instead of the segment colours.              |

`public/js/app-ui/memory/memory-readout.mjs`'s `MemoryReadout` is the reference host: one meter per resource (VRAM, RAM), a segment per process group coloured from `colors.memoryGroup`, and the peak as the marker.

---

## Media Components

**Directory**: `media/`

### TransitionViewer (`media/transition-viewer.mjs`)

Renders one visual element at a time and transitions between elements by fading the current one out while the next is already visible beneath it. Uses an imperative ref-based API.

| Prop           | Type   | Default                          | Description                                                      |
| -------------- | ------ | -------------------------------- | ---------------------------------------------------------------- |
| `overflow`     | string | `'hidden'`                       | CSS `overflow` on the wrapper                                    |
| `transitionMs` | number | `theme.transitions.slow` (400ms) | Fade-out duration in milliseconds                                |
| `...rest`      | —      | —                                | Spread onto root div (`style`, `class`, `width`, `height`, etc.) |

**Ref handle:** `viewerRef.current.transitionTo(vnode)` — transitions to a new element.

- No current element: shows immediately, no animation.
- Not transitioning: fades out the current element while the new one is already visible below.
- Mid-transition: swaps the destination element; current fade continues to completion.

```javascript
import { TransitionViewer } from '/js/custom-ui/media/transition-viewer.mjs'

const viewerRef = useRef(null)

// Trigger on URL change
useEffect(() => {
  if (!viewerRef.current) return
  viewerRef.current.transitionTo(
    imageUrl
      ? html`<img
          src=${imageUrl}
          style=${{ maxWidth: '100%', height: 'auto' }}
        />`
      : null,
  )
}, [imageUrl])

html`
  <${TransitionViewer}
    ref=${viewerRef}
    transitionMs=${600}
    style=${{ width: '400px', height: '300px', borderRadius: '8px' }}
  />
`
```

### Audio Player (`media/audio-player.mjs`)

HTML5 audio player with themed controls (play/pause, volume, progress scrubbing).

`widthScale` (default `'full'`) follows the [width scale](../public/js/custom-ui/COMPOSITION.md#width-scale) and does not accept `auto`; any value other than `full` switches the player to its compact layout.

`loop` (default `false`) repeats the clip, or its region, until it is stopped or another clip takes the channel. It has no visible control: it is passed through to `globalAudioPlayer.play` as `{ loop }`, which sets the channel element's native `loop` (a region wraps to its `start` instead), so the seek bar wraps with playback and scrubbing keeps working. The AnyTale Ambience cards use it for their previews.

### Seek Bar (`media/seek-bar.mjs`)

The click-or-drag timeline shared by `AudioPlayer`, `VideoPlayer` and the AnyTale Music tab's BGM player bar. A 6px track (8px on hover) with a themed fill.

| Prop       | Type                         | Description                                                     |
| ---------- | ---------------------------- | --------------------------------------------------------------- |
| `progress` | `number` (0–1)               | Current position                                                |
| `onSeek`   | `(fraction: number) => void` | Called once on release with the 0–1 target position             |
| `disabled` | `boolean` (default `false`)  | Ignores pointer input, dims the bar, and drops the hover growth |

The fill follows the pointer while dragging and `onSeek` fires once on release, so a plain click is a drag of zero length. Pointer capture keeps a drag alive outside the bar, and a cancelled pointer does not seek. The caller turns the fraction into a position — `AudioPlayer` adds its region `startOffset`, `VideoPlayer` multiplies by `duration`, and the BGM bar calls `globalBgmPlayer.seek(fraction)`, which also re-arms the player's next-track timer.

### Video Player (`media/video-player.mjs`)

Video playback controls (play looped, play/pause, progress bar, time display) for a `<video>` DOM element managed by the caller.

| Prop       | Type                                  | Description                                                         |
| ---------- | ------------------------------------- | ------------------------------------------------------------------- |
| `videoRef` | `{ current: HTMLVideoElement\|null }` | Ref to the `<video>` DOM element rendered inside `TransitionViewer` |
| `videoUrl` | `string`                              | Video URL; used to detect source changes and reset state            |
| `showLoop` | `boolean` (default `true`)            | Show the "play looped" button left of play/pause                    |

**Loop/play interaction.** Whether playback loops is decided solely by the button that started it: the loop button (`repeat` icon) sets `video.loop = true` and plays; play sets `video.loop = false` and plays. The loop button is disabled while playing, and only play/pause changes icon to offer stop. No loop state is kept, so nothing carries over after a stop or a source change. With `showLoop={false}` the component never reads or writes `video.loop`, leaving looping to the caller.

Unlike `AudioPlayer`, `VideoPlayer` does not use a global singleton — the caller owns the `<video>` element and passes its ref.

### Audio Select (`media/audio-select.mjs`)

Dropdown selector for picking audio files from local media or uploads.

### Image Select (`media/image-select.mjs`)

Dropdown selector for picking images from gallery history or uploads.

---

## Themed Base Elements

**File**: `themed-base.mjs`

Pre-styled HTML elements that automatically pick up theme tokens. Use these instead of raw HTML elements for consistent styling.

| Export             | HTML Element    | Purpose                                                                                                                                                                                       |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `H1` – `H6`        | `<h1>` – `<h6>` | Themed headings                                                                                                                                                                               |
| `HorizontalLayout` | `<div>`         | Flex row container; `gap="none\|tiny\|small\|medium\|large"`, `justifyContent` (`flex-end` right-aligns), `fitContent` keeps children at their natural width instead of flex-compressing them |
| `VerticalLayout`   | `<div>`         | Flex column container; `gap="none\|tiny\|small\|medium\|large"`, `justifyContent` (`flex-end` bottom-aligns)                                                                                  |
| `RowTitle`         | `<div>`         | Title for a title + control row; `size="tiny\|small\|medium\|large"` (default `medium`), `variant="title\|text"`. See [RowTitle](#rowtitle) below                                             |

```javascript
import { H1, HorizontalLayout } from '/js/custom-ui/themed-base.mjs'

html`
  <${H1}>My Title<//>
  <${HorizontalLayout} gap="medium">
    <${Button}>Left<//>
    <${Button}>Right<//>
  <//>
`
```

### RowTitle

The left edge of a **title + control row** — a `HorizontalEdgesLayout` whose right child is one or more controls. A `RowTitle` at a given `size` is exactly the height of a `Button`/`Input` of that size (its height and line-height are read from `theme.controlSize` via `getRowTitleSize(theme, size)`), so it sits vertically centred beside them. It is single-line: long titles truncate with an ellipsis rather than wrap. Use goober's `as` prop to keep heading semantics (`as="h2"`).

| size   | height | title font (`variant="title"`) | text font (`variant="text"`) |
| ------ | ------ | ------------------------------ | ---------------------------- |
| tiny   | 24px   | 14px                           | 12px                         |
| small  | 34px   | 16px                           | 12px                         |
| medium | 44px   | 19px                           | 14px                         |
| large  | 54px   | 22px                           | 16px                         |

`title` is bold primary text on its own font scale (`theme.rowTitleSize`) so even a small row's title reads as a section header; `text` is normal-weight secondary text at the control font. Give the title the same `size` as the row's controls. **Row-pill rule:** a status `Pill` in a title row goes one size down from the title (small title → tiny pill, medium title → small pill). Only rows with a control on the right use `RowTitle`; title-only headings stay `H1`–`H3`.

```javascript
html`
  <${HorizontalEdgesLayout}>
    <${RowTitle} as="h2" size="small">Parts<//>
    <${Button} size="small" icon="folder-open">Load<//>
  <//>
`
```

---

## Utilities

**File**: `util.mjs`

Generic utility functions shared across components.

| Function                            | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `fetchJson(url, options)`           | Fetch wrapper that parses JSON response with error handling   |
| `extractNameFromFilename(filename)` | Strips extension and cleans up a filename into a display name |

**File**: `goober-setup.mjs`

Pre-configured goober CSS-in-JS setup that binds to Preact's `h` function. Exports `styled` and `glob`.

```javascript
import { styled } from '/js/custom-ui/goober-setup.mjs'

const StyledDiv = styled('div')`
  background: ${(props) => props.theme.colors.primary.background};
  padding: ${(props) => props.theme.spacing.medium.padding};
`
StyledDiv.className = 'styled-div'
```

**File**: `logger.mjs`

The client's `log(source, level, message)` entry point (`level` is `'info' | 'warn' | 'error'`; `info` passes through the `HIDE_LOG_SOURCES` denylist, output is `[source] message`). Its implementation lives in `public/js/shared/logger.mjs`, so code shared between the browser and the server (`public/js/shared/`) can log too; `custom-ui/logger.mjs` is a one-line re-export of it (`export { log } from '../shared/logger.mjs'`). Client code keeps importing `custom-ui/logger.mjs`; shared modules import `shared/logger.mjs` by relative path, since they may not import from `custom-ui/`.

```javascript
import { log } from '/js/custom-ui/logger.mjs'

log('my-source', 'warn', 'something looks off')
```

**File**: `global-audio-player.mjs`

Singleton audio state manager (`GlobalAudioPlayer`) with independent channels, each a shared `<audio>` element created on first use (channel 0 is voice, 1 is SFX; Play's ready cue uses 2 and 3). Only one clip plays at a time per channel. Supports region playback (start/end times) and notifies subscribed listeners on play/pause/end events.

`play(audioUrl, region, instanceId, channel, options)` takes an optional fifth `options` argument, `{ loop?: boolean, volume?: number }`. `loop` sets the channel element's native `loop`, and with a `region.end` the region wraps to `region.start ?? 0` instead of pausing; `volume` (0–1) sets the element's `volume`. Both apply to that call only: a call that omits them resets the channel to no loop and full volume. `toggle` takes the same `options` and passes them to `play`.

```javascript
import { globalAudioPlayer } from '/js/custom-ui/global-audio-player.mjs'

globalAudioPlayer.play(url, null, instanceId, 0, { loop: true, volume: 0.5 })
globalAudioPlayer.stop(0)
globalAudioPlayer.subscribe(callback) // called on any state change
globalAudioPlayer.unsubscribe(callback)
```

The same file exports two `GlobalBgmPlayer` instances, which play a playlist through two Web Audio slots so tracks crossfade (`setTransition({ mode, durationSeconds })`) at a master gain (`setGain(value, seconds)`, stored while stopped): `globalBgmPlayer` for background music, and `globalAmbiencePlayer` for AnyTale Play's looping spot ambience. Neither stops the other or `globalAudioPlayer`. `setRepeat(true)` repeats the playlist: when the last item ends (or reaches its crossfade window) it crossfades into the first item again, so a one-item playlist loops seamlessly into itself. Repeat is off by default, and the playlist then stops after its last item.

```javascript
import { globalAmbiencePlayer } from '/js/custom-ui/global-audio-player.mjs'

globalAmbiencePlayer.setRepeat(true)
globalAmbiencePlayer.setTransition({ mode: 'crossfade', durationSeconds: 2 })
globalAmbiencePlayer.setPlaylist([{ url: '/rain.mp3' }])
globalAmbiencePlayer.play()
```

---

## Component Showcase

**File**: `test.html`

A live demonstration page that renders every custom-ui component with interactive examples. Open this file in a browser to preview:

- All button variants and color combinations
- Form inputs (text, number, textarea, select, checkbox, toggle, sliders)
- Layout containers (Panel variants, HorizontalLayout, VerticalLayout)
- Navigation (tabs, pagination, button groups)
- Overlays (modals, floating panels, hover panels)
- Toast notifications
- Theme switching (light/dark)

The first category, **Composition**, renders `COMPOSITION.md` (the library's composition guide): `test.html` fetches the file, splits it on `## Recipe: ` headings, and shows each recipe's prose beside a live demo with a tiny/small/medium/large size switcher. Demos are matched to recipes by exact heading text; `test.vitest.mjs`'s `COMPOSITION.md` test pins the recipe list so the guide and the demo map cannot drift apart. When the fetch fails (e.g. the page is opened over `file://`), the demos still render without their prose.

This file serves as both documentation and a visual regression test. Every new custom-ui component must include a usage example in `test.html`.
