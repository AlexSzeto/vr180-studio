---
description: when working on the client facing (i.e. /public) side of the website
---

## Frontend Architecture

- **File Naming Conventions**: All source files should be lowercase with dashes (e.g., `workflow-editor.mjs`, `node-input-selector.mjs`).
- **Framework & Libraries**: Always use `preact` + `htm/preact` for dynamic components.
- **Theme Usage**: All pages must utilize the `Page` component and initiate theming via `currentTheme.subscribe` to ensure consistent theming across the app.
- **Component Strategy**:
  - **Functional Components (Preferred)**: Use functional components with hooks (`useState`, `useEffect`, `useCallback`) for most UI elements. This aligns with modern Preact patterns seen in `App.mjs`.
  - **Class Components (Allowed)**: Use `Component` from `preact` for complex stateful logic or when lifecycle methods (`componentDidMount`, `componentWillUnmount`) offer cleaner abstraction than hooks (e.g., `ProgressBanner.mjs`).
  - **Existing Components First — mandatory check before any `styled()` call.** Before writing any `styled('div')`, `styled('section')`, or other layout-only wrapper, verify that none of the components below cover the need. A single-use `styled()` that could have been replaced by combining existing primitives is always wrong.

    **Layout & typography — `custom-ui/themed-base.mjs`**

    | Component               | Use when…                                                                                                                                                                                                                                                             |
    | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `VerticalLayout`        | Stacking children in a column with a themed gap (`gap="none\|tiny\|small\|medium\|large"`); `justifyContent="flex-end"` bottom-aligns children; supports `overflow` prop                                                                                              |
    | `HorizontalLayout`      | Placing children in a row with a themed gap (`gap="none\|tiny\|small\|medium\|large"`); configurable `alignItems` and `justifyContent` (`flex-end` right-aligns); `fitContent` keeps children at their natural width instead of flex-compressing them to fill the row |
    | `HorizontalEdgesLayout` | Two children pushed to opposite edges (title left / action right); use for sub-section headers and toolbar rows                                                                                                                                                       |
    | `H1`                    | Main page title (2 rem, bold)                                                                                                                                                                                                                                         |
    | `H2`                    | Section heading (1.2 rem, bold)                                                                                                                                                                                                                                       |
    | `H3`                    | Subsection or component heading (1 rem, medium weight, secondary color)                                                                                                                                                                                               |
    | `Label`                 | Form field or section label text                                                                                                                                                                                                                                      |
    | `RowTitle`              | Title for a title + control row (title left, controls right in a `HorizontalEdgesLayout`); `size` matches the row's controls so it has their exact height, `variant="title\|text"`, `as="h2"` keeps heading semantics; a status Pill beside it goes one size down     |

    **Content containers — `custom-ui/layout/panel.mjs`**

    | Component | Use when…                                                                                                                              |
    | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
    | `Panel`   | Any padded content box; `variant="default\|elevated\|outlined\|glass"`, `padding="tiny\|small\|medium\|large"`, optional `color` theme |

    **Text block rendering — `custom-ui/layout/markdown/markdown.mjs`**

    | Component  | Use when…                                                                                                                                                                                                                                                                                             |
    | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `Markdown` | Rendering any multi-line block of user- or model-authored text; `content`, `color`, `fontSize`, and `renderers` (shallow-merged over `defaultRenderers`, so overriding one token arm inherits the rest). It owns whitespace preservation — never wrap it in a `styled()` with `white-space: pre-wrap` |

    **App-level header bar — `app-ui/themed-base.mjs`**

    | Component   | Use when…                                                                                                                                    |
    | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
    | `AppHeader` | Top-level page header bar (page title + HamburgerMenu); semantically distinct from `HorizontalEdgesLayout` even though the CSS is equivalent |

    **IO components — `custom-ui/io/`**
    Never create a custom input, button, or control. Use: `Button` (`size="tiny|small|medium|large"`, default `medium`; `variant="default|chip"` is appearance only; icon-only / text / icon + text is inferred from `icon` and children), `Input` (supports `buttonProps` for an inline icon action button), `Textarea`, `Select` (fully custom portal dropdown; supports `buttonProps`), `MultiSelect` (options as `{ label, value, tooltip? }[]`; supports `buttonProps`) — both keyboard-operable through `useListboxKeyboard` (`io/use-listbox-keyboard.mjs`: native-`<select>`-style type-ahead and arrows, but a closed field only opens, never changes value), which any new list-style dropdown reuses rather than hand-rolling keys, `Checkbox`, `Slider`, `RangeSlider`, `DiscreteSlider`, `ToggleSwitch`, `Pill` (variants: static, dismiss, interactive icon, template toggle, whole-pill select; `variant="filled|outlined"`; `onClick`/`value` for clickable body; clicking a `{{slot}}` token with `options` opens a `PillSelectPanel` of them and a pick fires `onTemplateChange`; `selectOptions` (strings or `{ value, label?, color? }`) + `onSelect(value)` make a body click open a `PillSelectPanel` instead, with `value` as the current choice — never a click-to-cycle; `outlined` variant keeps shell neutral while slot tokens still render in the assigned `color`; `color` also accepts a raw `{ text, background, border }` token object; a `{{slot}}` in string children with **no** `options` renders as a static, non-interactive translucent inner token), `PillSelectPanel` (`io/pill-select-panel.mjs`; stateless anchored popup listing a pill's choices as option rows — `Select`'s popover rows at the source pill's control size, neutral until hovered or pressed (then its colour's `hover`/`active` token), the current value drawn like the rest — host passes `anchorRect` or `null`, plus `options`, `value`, `size`, `color`, `onSelect`, `onClose`; closes on a pick, Escape, or outside mousedown; `Pill` renders it for you, so use it directly only for pills built outside Preact), `ContentEditablePillInput` (contenteditable div with inline pills + autocomplete dropdown; a pill whose value is not in `suggestions` gets a warning-triangle "unknown" indicator, on by default and turned off per field with `flagUnknown=${false}` (also on `TagInput`/`ChipAutocompleteInput`), and values already present as pills are never offered in the dropdown; supports `onPillClick` for pill-body click; `getPillTooltip` (show tooltip on hover; returning null dismisses any visible tooltip rather than being a no-op, since container-bound `mouseleave` does not fire on pill→pill moves) and `buttonProps` for an overlay icon button; use `TagInput` from `app-ui/tags/tag-input.mjs` for tag-specific use — its `slotTypes`/`expressionOptions` props make the slot token of a `{{type}}`/`{{id}} <word>` template pill open a `PillSelectPanel` to choose from, listing `slotTypes` or, for `expressionOptions: Array<{ id, word }>`, the ids sharing the pill's word respectively), `useAutocomplete` + `AutocompleteDropdown` (hook + stateless component pair from `io/use-autocomplete.mjs` and `io/autocomplete-dropdown.mjs`; compose onto any input — including plain `<textarea>` or `<input>` — to add a filtered suggestion dropdown without pulling in `ContentEditablePillInput`; hook returns stable refs safe to call from `useEffect([])` closures), `AutocompleteInput` (`io/autocomplete-input.mjs`; a themed `Input` with `useAutocomplete`/`AutocompleteDropdown` already composed in, plus an optional browse-all search modal — stays a plain controlled free-text field and never converts the value into a pill, unlike `ChipAutocompleteInput`), `useInputValidation` + `ValidationMessage` (hook + shared renderer pair from `io/use-input-validation.mjs` and `io/validation-message.mjs`).

    **Width goes through the `widthScale` prop.** Every IO control that sizes horizontally takes `widthScale` (`compact | normal | wide | full`), independent of `size` — pick it by how long the value is, never by `size`. `auto` (fit content) is valid **only on content-bearing controls** — `Button`, `Pill`, `Select`, `MultiSelect`, `Checkbox`, `ToggleSwitch`; elsewhere it warns and falls back to the control's default. `TagInput` takes `widthScale` (default `full`, no `auto`) and passes it through to its pill editor. Widths and per-control defaults: `public/js/custom-ui/COMPOSITION.md`'s "Width scale".

    **Field validation goes through the `validation` prop.** All ten field components above (`Input`, `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `Slider`, `RangeSlider`, `DiscreteSlider`, `ToggleSwitch`, `ContentEditablePillInput`) accept `validation={{ status, message }}`, where `status` is `'idle' | 'validating' | 'valid' | 'warning' | 'invalid'`. Never re-invent a per-form error line or hand-roll a debounce: `useInputValidation({ validate, debounceMs = 600, validatingMessage })` owns the debounce, the in-flight `validating` state, and stale-result discarding, and returns a `validation` object to hand straight to the component. `idle` renders nothing, `validating` keeps the neutral border, and a `valid` result with an empty message renders nothing — positive confirmation is opt-in. The former `error` prop on `Input`/`Textarea`/`Select` no longer exists. See `docs/components.md`'s "Field validation" section. (`app-ui/app-setup/install-path-field.mjs` predates the hook and keeps its own debounce; it is a deliberate exception, not a pattern to copy.)

    **Status indicators are pills, never plain colored text.** Any element whose only job is to report a state — running/stopped, connected/disconnected, queued/generating/failed, enabled/disabled, valid/invalid — renders as a `Pill` from `custom-ui/io/pill.mjs` containing the state word. Never a `Label`, `span`, or heading tinted with a theme color instead. Colored text alone reads as emphasis rather than as a discrete state, and gives the reader no boundary between "the status is running" and "the word running happens to be green"; the pill's shell supplies that boundary and keeps every status in the app the same shape regardless of which page it appears on. The reference implementation is the per-process running/stopped indicator in `public/js/process-logs.mjs`. This rule is about status _readouts_; it does not apply to a control the user operates to change the state (that stays a `Button` or `ToggleSwitch`), nor to field-level validation, which goes through the `validation` prop described above.

    **Status text is lowercase, and the color comes from one of three buckets.** Write the state word in lowercase — "running", "stopped", "waiting" — never Title Case, so a status reads as a machine-reported value rather than as a label or a heading. Nearly every state an indicator can report sorts into one of three buckets, and the bucket picks the color; do not reach past this set for a fourth:

    | Bucket                   | Colour             | Example states                                                       |
    | ------------------------ | ------------------ | -------------------------------------------------------------------- |
    | Broken / error / stopped | `danger` (red)     | `stopped`, `failed`, `crashed`, `disconnected`, `missing`, `invalid` |
    | Running / success        | `success` (green)  | `running`, `ready`, `connected`, `installed`, `complete`, `valid`    |
    | Waiting / unknown        | `warning` (yellow) | `waiting`, `queued`, `starting`, `pending`, `checking`, `unknown`    |

    Note that a **stopped** process is `danger`, not `secondary` — an inactive-but-fine state is not a fourth bucket, because from the reader's point of view a thing that should be running and is not is a problem to act on. Reach for `variant="outlined"` when a filled pill would compete with the content beside it. **A marker that is not a success/failure/wait outcome is not a status and takes `primary`** — "playing" on the current track, "current" on the selected item, "default" on the preferred option: playing music has no success or failure state, so green would imply a result that does not exist. Reserve the three buckets for states a reader might need to act on or that report a health outcome. If a genuine state truly does not fit any of the three buckets, say so and agree a mapping before inventing one.

    **AI-generated content carries a `generated` marker.** When a record that is normally authored by a person (a character, say) is saved entirely by AI with no human review, the record carries `generated: boolean` (default `false`). Only the generating path sets it, and the record's manual-save routes always store `false`, so a person's save is what clears it. Wherever the record is listed or edited, it shows a lowercase `primary` **generated** `Pill` (a marker, not a status bucket). Characters are the reference implementation: Match sets the flag, the `/anytale/characters` POST/PUT routes clear it, and the Editor's character section and the Manager's Library tab show the pill (see `docs/features/anytale.md`'s "Generated characters"). A new generated path adopts the same field name and pill rather than inventing a variant.

    **Icon names come from `ICON_MAP`, not from Material Symbols.** Every `icon`/`prefix`/`suffix`/`name` prop on a `custom-ui` component takes a key of `ICON_MAP` in `public/js/custom-ui/layout/icon.mjs`, which `Icon` translates to a Material Symbol name internally. Entries mapped to `null` in `ICON_MAP` explicitly fall back to the Boxicon icon set (rendered wrapped in a sizing span). Consult that map before choosing a name. An unmapped key renders an empty placeholder (width/height matching `size`) — `Icon` falls through the `if (!materialName)` branch — so a guessed Material Symbol name fails silently rather than erroring. If no suitable key exists, say so and propose adding the mapping; never pass a raw Material Symbol name through and assume it resolves.

    **Control size scale.** `Button`, `Input`, `Textarea`, `Select`, `MultiSelect`, `ContentEditablePillInput`, and `AutocompleteInput` share one `size` prop (`tiny | small | medium | large`, default `medium`), so controls side by side at the same `size` line up. Controls placed _beside_ each other use the same size; a button embedded _inside_ a field renders one size down (the nesting rule, below). Change size only uniformly across a UI segment. Spacing follows the **pairing rule**: controls of size S sit at `gap=S`; distinct groups and Panel `padding` around them go one step up (`oneSizeUp(size)` in `custom-ui/theme.mjs`); pill clusters use `gap="tiny"`. `heightScale` is removed — use `size="small"` where `heightScale="compact"` was used. **Consult `public/js/custom-ui/COMPOSITION.md` before composing a new form, row, or toolbar** — it holds the full scales and recipes for the common combinations.

    **Secondary controls share the same `size` prop.** `Checkbox`, `ToggleSwitch`, `Slider`, `RangeSlider`, `DiscreteSlider`, and `Pill` take `size` too. Checkbox/ToggleSwitch scale their indicator and inline label but do not reserve the row height; sliders keep their stacked layout and line up by width, not height. **`Pill` defaults to `tiny`**, the one exception to the `medium` default — pass the neighbours' `size` to line a pill up beside other controls. Pills drawn _inside_ a field (ContentEditablePillInput, TagInput) follow a separate **pill nesting rule**: two sizes down, clamped at tiny (`pillSizeInField(size)`), handed to custom renderers as `renderPill(value, { pillSize })`. See `COMPOSITION.md`'s "Secondary controls".

    **`buttonProps` pattern** — consistent inline icon button overlay used by `Input`, `Select`, `MultiSelect`, `ContentEditablePillInput`, and `Textarea`:

    ```js
    buttonProps: {
      icon: string,          // icon name
      color?: string,        // button color theme
      disabled?: boolean,    // merged with component's own disabled via OR
      onClick: () => void,
      title?: string,        // native tooltip text
      tooltip?: string,      // TooltipContext tooltip; shows even while disabled
      loading?: boolean,     // shows spinner
    }
    ```

    The embedded button renders **one size down** from its field (`oneSizeDown(size)`: large→medium, medium→small, small→tiny; a `tiny` field's button stays `tiny` — the known exception, it does not fit). Geometry is derived, never hardcoded — `getEmbeddedButtonLayout(theme, size, count)` in `custom-ui/theme.mjs` computes the inset and the field's right padding (formula in `COMPOSITION.md`'s "Control size scale").

    For `Input`: button is absolutely positioned at the top-right inset; input gains the derived right-padding automatically.
    For `Select`/`MultiSelect`: button sits left of the value text inside the trigger, vertically centred with the same inset from the left edge; `e.stopPropagation()` prevents dropdown toggle.
    For `ContentEditablePillInput`: primary button sits at the top-right inset; secondary button (`secondaryButtonProps`) is stacked one `buttonHeight + gap` below it in the same column. Editor gains the derived right-padding automatically, and its min-height grows to fit both buttons.
    For `Textarea`: `buttonProps` may be an array, rendered as a horizontal row at the top-right inset (measured against the step height, so the row stays in the first line).

    `TagInput` (`app-ui/tags/tag-input.mjs`, built on `ContentEditablePillInput`) accepts a `colorByOrigin` prop (default `true`) that tints `{{...}}` template pills by their lexical origin (`page`/`expression`/`expanded`/`rule`, via `classifyTagOriginLexically` in `app-ui/anytale/prompt-assembler.mjs` and the `tagOrigin` theme color group) instead of the flat `primary` background. Pass `colorByOrigin=${false}` at call sites with no part or expression system behind them, where the origin classification carries no meaning.

    **Tags are stored with spaces, never underscores.** `TagInput` loads, shows, and emits every tag through `tagUnderscoresToSpaces` (`public/js/shared/tag-format.mjs`; leaves `{{…}}` tokens, `<lora:…>`/`embedding:` syntax, and emoticon tags like `^_^` alone), applying it to newly typed pills through `ContentEditablePillInput`'s `normalizeValue` prop. Never convert tag text to underscores on save, and never add a per-field normaliser: `getTagDefinition` already accepts either form. Pass `normalizeUnderscores=${false}` only where the values are not tags (workflow Send Properties).

    **Message components — `custom-ui/msg/`**

    | Component                    | Use when…                                                                                                                                                                                                                                                                   |
    | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `FormStatusPanel`            | Reporting a **form-wide** (non-field) error or status — props `{ messages, status }`; one message renders as a `Label`, two or more as a list; renders `null` when `messages` is empty or `status` is `'idle'`. Field-level errors go through the `validation` prop instead |
    | `ProgressBanner`             | Top-of-page progress for a long-running task                                                                                                                                                                                                                                |
    | `ToastProvider` / `useToast` | Transient success/error/info notifications                                                                                                                                                                                                                                  |

    **Media viewer — `custom-ui/media/transition-viewer.mjs`**

    | Component          | Use when…                                                                                                                                                                                                     |
    | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `TransitionViewer` | Displaying a visual element that changes over time and needs a smooth fade transition; accepts any Preact VNode via `viewerRef.current.transitionTo(vnode)`; size is controlled by the caller via props/style |

    **Seek bar — `custom-ui/media/seek-bar.mjs`**

    | Component | Use when…                                                                                                                                                                                                                                                                                                          |
    | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `SeekBar` | Any click-or-drag timeline for audio or video; props: `progress` (0–1), `onSeek(fraction)` (once on release), `disabled`. Never hand-roll a progress track with a click handler — `AudioPlayer`, `VideoPlayer` and the BGM bar share this one (`AudioPlayer`'s `loop` prop repeats a clip with no visible control) |

    **Video player — `custom-ui/media/video-player.mjs`**

    | Component     | Use when…                                                                                                                                                                                                                                                             |
    | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `VideoPlayer` | Rendering play/pause + progress controls for a `<video>` element owned by the caller; props: `videoRef` (ref to the raw `<video>` DOM node), `videoUrl` (string, for source-change detection), `showLoop` (default `true`; hides the "play looped" button when false) |

  - **Play's glass kit is the exception.** `public/js/app-ui/glass/` (`GlassButton`, `GlassPanel`, `SlideFade`/`Fade`, `showGlassPrompt`, `GlassOptionButton`/`CategoryList`, `PageDots`, `SpeechBubbleButton`, `ReadingPanel`, `GlassComposer`, `TypingDots`, `BackButton`, `SwipeVerdict`) is AnyTale Play's sanctioned control set and the one exception to "Existing Components First" and to the IO-components rule: Play's screens live in one portrait frame, sized in `cqw` (the frame's width) from the `theme.glass` token group, and drawn as frosted glass over the tale's imagery, which the custom-ui `size` scale and colour themes do not express. Play screens (and the character creator) build from the glass kit instead of custom-ui controls, styled only from `theme.glass`, and every screen enters and leaves through `SlideFade`. **Overlays count as screens here** — a viewer, a modal, a profile sheet opened over a Play screen enters and leaves through `SlideFade` too, never by mounting outright or through a hand-rolled transition. **Inside a glass file, styling goes in goober `styled()` classes** — or a `css` class built in `useMemo` for an element that takes a `class` prop (such as `Fade`/`SlideFade`) — never in inline `style=${{…}}` objects. Inline style is kept only for values computed per render (an opacity driven by state, a drag offset). Older files such as `flirt-photo-viewer.mjs` predate this and are not a pattern to copy. **When a kit component almost fits, extend it — never fork it.** If `ReadingPanel` is needed inside an existing panel, or in the system font rather than the dialog font, the kit component gains an option or a sub-export (e.g. its inner body exported on its own) that the new screen uses; a styled lookalike that copies its tokens is always wrong, because the two drift apart the first time either changes. `BackButton` (`glass/back-button.mjs`, `{ onBack, visible, disabled, inline }`) is the only Back control on Play screens and overlays: an icon-only button at the top-left inset that enters and leaves from the top edge, or, with `inline`, in its parent's flow (inside a panel). Never build a Back out of a bare `GlassButton` or any other control. Prompts there go through `showGlassPrompt`, never `showDialog`. It is the generic AnyTale prompt format: a message whose wording makes clear that confirming performs the action, and a single ✓ icon button at the bottom right, with no Cancel button. A `'confirm'` prompt is backed out of with the backdrop or Escape. An `'error'` prompt closes only on ✓, and an error that ends a session uses it, with a ✓ that performs the recovery (e.g. resets the session) and no Retry. Informational notices (e.g. the now-playing track) go through the glass toast (`app-ui/glass/glass-toast.mjs`, `GlassToastProvider`/`useGlassToast().show(text)`) rather than custom-ui's `useToast`. Each glass file carries a comment saying so. Reach for the kit's own variants before styling a new control: `GlassButton`'s `compact` (icon-only, no caption, and it ignores the mobile `--glass-icon-scale`), `loading`, and `frozen` (a `snowflake` badge in the bottom-right corner, sized from `glass.size.frozenBadge`/`frozenBadgeInset`, for a toggle that cannot take effect here — a media type a memory did not record, an unavailable Handy; the button keeps its `active` look and stays clickable), and `imageUrl` (on a captioned, non-compact button, an image filling the button square in place of the icon, clipped to `glass.size.radius`, falling back to `glass.media.placeholder` when empty or failed — Match's choice rows), `pill` (text-only, with no icon or caption: `glass.size.radiusPill` corners and a slightly larger label, at one fixed size that ignores the frame's text scales so several share a line; `active`, `tooltip` and the sounds behave unchanged — Match's archetype choices), `toggleSound` (always plays the toggle sounds, reading an unset `active` as off, for a button that always toggles but keeps the undimmed unset look — Match's choices); `GlassOptionButton`'s `marker` (an `ICON_MAP` key in a fixed-width left column that is always reserved, blank when unset), `descriptionLines` (crops the description to that many lines with an ellipsis; default uncapped, the Flirt inbox sets 4), `disabled`, and `static` (a non-interactive display row: no surface, no hover, no sounds — what `CategoryList`'s `current` header uses); and `useStageGestures` (`glass/use-stage-gestures.mjs`, `{ enabled, onTap(zone), onSwipe(direction), onDrag(dx|null) }` → `{ ref, handlers }`; tap zones `left`/`center`/`right`, swipes `forward`/`back`; a pointer starting on a `button`, `.glass-panel`, `.vn-dialog`, or inside `[data-gesture-ignore]` is ignored; thresholds from the `glass.gesture` tokens `edgeZone`, `swipeDistance`, and `intentWindowMs` — a release is a swipe when the stroke's latest `swipeDistance` of travel within the rolling `intentWindowMs` points away from the start, nothing when it points back toward it, and decided by distance from the start when the reader paused before letting go; the caller applies `touch-action: pan-y`, leaving vertical pans to the browser so its pull-to-refresh works; `onDrag(dx)` reports the live offset, and on a release its `onDrag(null)` arrives after that release's `onSwipe`/`onTap`, so a swipe can commit a drag before the drag's end cancels it); `ImageStage`'s drag-follow, driven by the stable controller from `useStageDrag()` (`image-stage.mjs`, `{ move(fraction, { peekMedia, damped }), release('commit'|'cancel'), subscribe }`, passed as `drag`) so a pointer move re-renders only the stage, with a blocked move's rubber band capped by the `glass.gesture.rubberBandCap` token; `SwipeVerdict` (`glass/swipe-verdict.mjs`, `{ controller, kinds }`, driven by the stable `useSwipeVerdict()` controller `{ track(kind, progress), cancel, hold(kind), release, complete(kind), subscribe }` so a drag re-renders only it), the centred, panel-free icon-and-caption in `overImageText` that reports a swipe-to-decide action over the stage (Match's Rejected/Matched) — reuse it for any such feedback rather than styling a new overlay; `TypingDots` (`glass/typing-dots.mjs`), Flirt's three-dot typing indicator, drawn with `DotGlyph` — the single, non-interactive page-dot look exported from `page-dots.mjs` — so reuse `DotGlyph` for any other standalone dot; and `PageDots`, the play screen's page dots (`interactive={false}` makes them a non-clickable, pointer-less indicator, as on Match's swipe step), coloured and sized only from the `glass.dots` tokens (`ring`, `secondary`, `primary`, `error`, `pulseDuration`, `size`, `gap`, `maxVisible`, `edgeScaleNear`, `edgeScaleFar`, `shadowRoom`). `SpeechBubbleButton` (`glass/speech-bubble-button.mjs`, `{ text, onClick, disabled }`) is the player's line — the decision choices and the end screen's Goodbye: right-aligned, `glass.size.bubbleWidth` wide, a word balloon (`glass.size.balloonRadius`/`balloonPadding`, shared with `VnDialog`, whose square top-left corner is its tail) with a square bottom-right corner as its tail, and `data-gesture-ignore` on its root; reuse it for any line the player says rather than styling a new bubble. `ReadingPanel` (`glass/reading-panel.mjs`, `{ heading, text, font, pills, emphasis }`) is the loading screen's static, scrollable read — reuse it for any read-only paragraph on a Play screen rather than styling a new panel; `font="system"` sets the text in the regular UI font (typed material such as Match's self profile), and `pills` (string array) draws a wrapping row of small static primary pills (`glass.pill` tokens) inside the glass panel above the text, omitted when empty, and `emphasis` renders `*x*`/`**x**` as `<em>` (asides kept; Match's self profile). `GlassComposer` (`glass/glass-composer.mjs`, `{ onSend, disabled, placeholder, onDraftChange }`) is the typed-message field with a compact send button (Flirt's conversation screen) — a raw `<textarea>` under this exception, in the regular UI font rather than the dialog font (a typed text, like Flirt's chat bubbles, is a system message, not spoken dialog), Enter sends the trimmed text, Shift+Enter is a newline, `data-gesture-ignore` on its root; reuse it for any text the player types on a Play screen. A Flirt message, the character's or the player's, is shown through `renderFlirtText` (`app-ui/play/flirt-text.mjs`), which hides `[…]`/`(…)` asides and renders `*x*`/`**x**` as `<em>` — never print a stored Flirt message raw. `VnDialog` renders `*x*`/`**x**` emphasis as `<em>` through `emphasisSegments` (`shared/anytale/flirt-display-text.mjs`), never showing or counting the markers. A player's line shown as dialog rather than pressed (the "You" page after a decision) is `VnDialog` with its `tail` prop (`'top-left'` by default, `'bottom-right'`), which squares the bottom-right corner instead, matching `SpeechBubbleButton`'s tail. `VnDialog` draws its balloon through `DialogBalloon` (`app-ui/dialog-balloon.mjs`), a shape-only component (it squares the tail corner; every colour, blur, padding, radius, and shadow is a prop) that the Editor viewer also uses for its dialog, with custom-ui theme values; it lives in `app-ui/`, not `glass/`, so sharing it needs no exception to this rule. The glass-surfaced buttons, `GlassButton` and `GlassOptionButton`, play hover and click (or toggle-on/off) sounds through `useButtonSounds` (`glass/button-sounds.mjs`), gated by a module-level flag `PlayApp` sets from the Sounds setting and audio unlock; `GlassButton`'s `silent` prop turns both off for a button whose press another cue voices (the composer's send button, under Flirt's sent sound), and `playCueSound(url)` plays any other one-off cue through the same gate; a new glass-surfaced button wires the same hook, and buttons without a glass background (speech bubbles, page dots, the autoplay indicator) stay silent. A pill-shaped glass panel takes `glass.size.radiusPill`. `theme.glass.shadow` is the glass kit's soft diffused drop, used as `box-shadow` on boxes and `text-shadow` on panel-backed text; its one other shadow is `theme.glass.overImageShadow`, the halo for text drawn straight over imagery. Never add another shadow, a text stroke, or an outline to a glass design. Text colour follows the backing: anything with a glass surface behind it (button labels and captions, panel bodies, list/prompt/toast titles) takes `glass.text`, dark in the light theme; text with no panel behind it (the dialog speaker name, the reading panel's heading, the decision/end title and closing line, the spinner's percentage and label, the autoplay indicator) takes `glass.overImageText` over `glass.overImageShadow`, white in both themes. So reusing a component built for text over imagery inside a glass panel needs a panel-backed variant of it — an option that switches its text to `glass.text` (and drops the halo for `glass.shadow`) — never its `overImageText` styling carried onto the panel, where white-on-frosted-glass is unreadable in the light theme. The exception does not reach beyond Play: the debug UI under `app-ui/play-debug/` keeps using custom-ui controls, and so does every other page. See `docs/features/anytale.md`'s "Glass kit".
  - **New component placement.** When a new UI component is genuinely needed (cannot be composed from existing primitives):
    - Reusable across pages or projects → `custom-ui/`; add a usage example to `test.html` and a render entry to `test.vitest.mjs`.
    - Page- or feature-specific → `app-ui/`.
  - **Custom UI Component Documentation**: Every new custom UI component added to `public/js/custom-ui/` must include usage examples in `public/js/custom-ui/test.html` to demonstrate its API and typical use cases.
- **File Structure**:
  - **Reusable Components**: Place generic, reusable UI components in `public/js/custom-ui/` (e.g., `io/`, `layout/`, `msg/`).
  - **App-Specific Logic**: Place application-specific components and logic in `public/js/app-ui/`.
  - **Utility Functions**: Generic utilities go in `public/js/custom-ui/util.mjs`.
- **Navigation Registration**: A finished page must be registered in `public/js/app-ui/hamburger-menu.mjs`. Never ship a finished page without a navigation entry.
  - **A page still in development must NOT be registered.** Some pages are built over several stories before they're usable, for example a parallel rebuild that replaces an existing page in a later swap. Such a page stays reachable only by its URL until it reaches the completeness its feature defines. Registering it is part of the task that reaches that point, typically the swap or final story.
  - Every other new page is registered in the same task that creates it.

## Component Implementation Standards

- **State Management**:
  - Use `useState` or `useReducer` for local component state.
  - For global state or complex logic shared across components (like theme or SSE), use the subscription pattern (e.g., `currentTheme.subscribe`).
- **Styling Integration**:
  - Always use `styled` from `goober-setup.mjs` (which configures `goober` with `h` from Preact) unless a specific feature cannot support it and there are no reasonable workarounds.
  - Do **not** import `styled` directly from `goober`.
- **DOM Refs and Goober Styled Components**:
  - Attaching a `ref` to a `styled()` component (e.g., `<${StyledDiv} ref=${myRef}>`) yields the **Preact component instance**, not the underlying DOM node. Calling DOM methods like `getBoundingClientRect()`, `focus()`, or `select()` on such a ref will throw a runtime error.
  - **Avoid `createRef` and direct DOM measurement wherever possible** — prefer event-driven alternatives (e.g., `e.currentTarget.getBoundingClientRect()` in event handlers, native `<input>` elements that expose DOM APIs natively).
  - When a ref to a raw DOM node is absolutely necessary (e.g., for canvas or scroll APIs), attach the ref to a **plain HTML element** (`<div>`, `<canvas>`, `<input>`) rather than a styled wrapper, even if that means adding a minimal unstyled element whose sole purpose is to be the ref target.
- **Props & API**:
  - Destructure props with default values in the function signature (functional) or `render()` method (class).
  - Forward DOM-compatible props using `...rest`.
  - Document public props with JSDoc, including examples for non-trivial usage.

## Styling & Theming

- **Naming Conventions**:
  - All source files should be lowercase with dashes (e.g., `workflow-editor.mjs`, `node-input-selector.mjs`).
  - Use PascalCase for styled components (e.g., `StyledButton`).
  - Always attach a readable class name for debugging: `StyledButton.className = 'styled-button';`.
- **Theme Usage**:
  - Import `currentTheme` from `custom-ui/theme.mjs`.
  - **Never hardcode generic values**. Use theme tokens for:
    - Colors (`theme.colors.primary.background`, `theme.colors.text.secondary`)
    - Spacing (`theme.spacing.medium.padding`)
    - Borders (`theme.border.radius.medium`, `theme.border.width`)
    - Typography (`theme.typography.fontSize`)
  - If a token is missing, add it to `theme.mjs` rather than hardcoding.
- **CSS-in-JS**:
  - Keep styles local to the component file whenever possible.
  - Avoid generic class names like `.container` or `.wrapper` in global CSS; scope them within the styled component.

## Shared client/server code

Code that must run in both the browser and the server — today the AnyTale engine under `public/js/shared/anytale/` and the logger at `public/js/shared/logger.mjs` — lives in `public/js/shared/`. It is one copy of the code, run in two places.

- A shared module imports **only** from within `public/js/shared/`, by relative path — never from `custom-ui/`, `app-ui/`, `server/`, or a bare package specifier. Shared code logs through `public/js/shared/logger.mjs` (`custom-ui/logger.mjs` is a re-export of it for client code).
- It must not touch browser-only APIs (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `EventSource`, `fetch`) or Node-only APIs (`fs`, `path`, `process`). Anything that needs one stays in the client or server module that wraps the shared code — e.g. `play-cache.mjs` keeps the `localStorage` functions and re-exports `buildCacheKey` from `shared/anytale/page-signature.mjs`; `play-dialog.mjs` keeps the `fetch`-based generators and imports its prompt builders from `shared/anytale/dialog-prompt.mjs`.
- The server imports shared modules by relative path (e.g. `../../../public/js/shared/anytale/play-utils.mjs`).
- Shared tests run in the `shared` vitest project, under `node` with no DOM.
- `public/js/shared/shared-guard.test.mjs` enforces all of this: it checks every shared module's static imports, scans it (outside comments) for the forbidden identifiers and `fetch(`, and imports it in Node.

## Logging

All client-side logging goes through `public/js/custom-ui/logger.mjs`:

```js
import { log } from './logger.mjs' // adjust path as needed

log('source', 'info', 'message')
log('source', 'warn', 'message')
log('source', 'error', 'message')
```

- `info` messages pass through a `HIDE_LOG_SOURCES` denylist.
- `warn` and `error` messages always emit.
- Output format is `[source] message`.
- Do not call `console.log`, `console.warn`, or `console.error` directly. Use the `log()` function with a stable source name.

## Service Readiness

Every page, AnyTale Play included, loads while ComfyUI/the LLM runtime are still starting — no page is held behind a readiness gate — so service-dependent UI must gate itself. Use `public/js/app-ui/service-status.mjs`:

- **Primary generate actions** (a page's main Generate/Send button): `disabled` while `!useServiceStatus().ready`, with `tooltip=${SERVICES_NOT_READY_MESSAGE}` only while not ready.
- **Automatic calls** (fired on mount or attribute change, without a click): skip while `!ready` and include `ready` in the effect's dependencies so they run once services come up — no request, no toast while waiting.
- **Every other user-initiated call** to a service-dependent endpoint: let it fire; call `toastIfServicesNotReady(resOrErr, toast)` first in its error path and return early if it handled the 503.
- **Never gate per service.** `ready` means every service in `/status` is ready; never guess which one an action needs.

The queue banner (`QueueStatusBanner`) and its dashboard are hidden entirely until ready.

## Multi-Tab / Queue SSE Patterns

### One events stream per browser

Browsers cap HTTP/1.1 at six connections per host, shared by every tab, and a long-lived SSE stream holds one for as long as its page is open. When each feature opened its own stream, a few tabs filled the pool and every other request — static files included — queued inside the browser while the server sat idle. So every live update except Play's travels over one stream, `GET /events`:

- **Never call `new EventSource(...)` outside `public/js/app-ui/event-hub.mjs`.** Subscribe with `eventHub.subscribe(channel, event, handler)` (returns an unsubscribe function), or through the managers built on it (`queueSSEManager`, `sseManager`, `ProcessLogSSEManager`, `useMemoryStatus`). Play's `play-page.mjs`, `flirt-client.mjs`, and `match-client.mjs` are the only exceptions, and `public/js/app-ui/event-source-guard.test.mjs` fails on any other.
- **A new live feed is a channel, not a route.** The server side registers it in `server/core/event-channels.mjs` with a `snapshot()` that returns the full state a fresh subscriber needs, and publishes through `publish(channel, event, data)` — see `.claude/rules/server.md`.
- **One tab per browser holds the stream.** The hub elects a leader with the Web Lock `anytale-events`; the leader subscribes the union of every tab's channels and relays each event over `BroadcastChannel('anytale-events')`. Where `navigator.locks` is missing (an insecure context, e.g. a phone on a LAN IP) each tab opens its own single stream. Callers never see the difference.
- **Snapshots, not re-fetches, recover state.** Every subscribe, reconnect, and leader handoff delivers each channel's snapshot again, and a second subscriber joining an already-open channel gets a resend. Expect a handler to receive the same state more than once; make it idempotent.

### Per-tab client identity

- `public/js/app-ui/client-id.mjs` exports `getClientId()`, which returns a stable UUID stored in `sessionStorage` (isolated per tab, survives page refresh within the same tab).
- Every queue-submission fetch must include `clientId: getClientId()` in its request body (or `formData.append('clientId', getClientId())` for FormData requests). This lets the server associate each queue item with the submitting tab.

### Ownership-gated task SSE subscriptions

- The `queue:task-started` SSE event carries a `clientId` field.
- Every `queue:task-started` handler that opens a task SSE connection (directly or via `progressShow`) must check `if (clientId !== getClientId()) return;` before subscribing. This prevents idle tabs from opening task SSE connections for tasks they didn't submit.
- Idle tabs may still consume `queue:task-started` for UI display purposes (queue dashboard), but must not call `sseManager.subscribe()` or `progressShow()` for tasks they don't own.
- **Resume paths are covered by the same rule.** `queue:task-started` is not the only way a tab attaches to a task: every reconnect-resume effect that reads `activeTasks` from `useProgress()`, and every `sseManager.fetchActiveTasks()` consumer, must filter its candidates through `isOwnTask(task)` from `app-ui/client-id.mjs`. Without it a tab picks up whatever is in flight on an events-stream reconnect or a fresh mount — including another tab's task — and then runs that task's completion logic (media deletion, `previewUid` writes) against its own state.
- `isOwnTask` treats a **missing** `clientId` as owned and a `null` one as foreign. `progressShow` injects local entries with no `clientId` field at all, so those are own-tab by construction; server-fetched entries always carry the field (`GET /generation/tasks/active` serializes an unstamped task as `null`), so an unstamped server task is skipped rather than falsely attached to. The fail-safe direction is "miss a resume that `queue:task-started` immediately covers", never "attach to a stranger's task".
- Consequence: a **brand-new tab no longer picks up in-flight tasks started by a different tab.** Refreshing the _same_ tab still resumes, because `getClientId()` is backed by `sessionStorage`. Cross-tab _visibility_ of queue activity is unaffected — `QueueStatusBanner` reads `/queue/status` and shows all queue work regardless of owner.

### Queue SSE reconnect recovery

- `QueueSSEManager` exposes `onConnect(fn)`, which delegates to `eventHub.onConnect` and fires every time the events stream (re)connects, including a leader handoff. Use it to re-fetch `/queue/status` so the client recovers its view of the queue after a dropped connection.
- `use-queue-status.mjs` already wires this up — new callers of `useQueueStatus()` get recovery for free.
- Any component or hook that subscribes directly to `queueSSEManager` and caches queue state should also call `onConnect` and refresh from the REST endpoint.

### Running task progress hook

- `useRunningTaskProgress(taskId)` in `public/js/app-ui/use-queue-status.mjs` subscribes to the `progress:<taskId>` channel through `eventHub` and returns the latest `percentage` (number) or `null` if no progress has arrived yet.
- Returns `null` (not `0`) before the first `progress` event to avoid a misleading flash.
- Closes the `EventSource` and resets to `null` on `complete`, `error-event`, or `cancelled` events, and whenever `taskId` changes or the component unmounts.
- Used by `QueueStatusBanner` to append `— N%` to the running chip label.

### SSEManager event coalescing

- `SSEManager` (in `public/js/app-ui/sse-manager.mjs`) batches events via `setTimeout(0)` before dispatching. This prevents replayed completed tasks from firing multiple `onComplete` calls.
- Pruning rule in `_flushEvents`: if a terminal event (`complete`/`error`/`cancelled`) is present in the batch, discard all `progress` events and dispatch only the terminal. If no terminal: discard all `progress` except the last, dispatch that one.
- Transient errors are the event hub's job, not `SSEManager`'s: an `onerror` with `readyState === CONNECTING` (browser auto-reconnecting) never ends a subscription, and after `CLOSED` the hub reopens the stream itself. The server keeps each task's replay buffer (its latest `progress` plus the terminal event) for 5 minutes and writes it as the `progress:<taskId>` channel's snapshot on every subscribe and reconnect, so the completion arrives after the retry. The 2-minute inactivity timeout remains the backstop.
- The events stream's heartbeat is a NAMED SSE event (`event: heartbeat`, every 30s), not a comment — comments never reach EventSource JS. `SSEManager` listens for it through `eventHub.onHeartbeat` and resets the inactivity timeout without dispatching to callbacks, so the timeout only fires on a genuinely dead stream, never on a slow-but-alive generation (long video renders can go minutes between progress events).
- Server task completions carry the full `generationData` as the event's `result` — client handlers must read what they need from the payload rather than re-fetching `/media-data` on `complete`: any media-entry write done in `_executeQueuedTask`'s post-processing `.then()` lands AFTER the `complete` event was emitted, so an immediate re-fetch races it (see `handleVideoComplete` in `anytale.mjs` for the payload-driven pattern).
- `ProgressBanner` fast-complete bypass: if `handleComplete` fires before any `progress` event was received (`hadProgressRef.current === false`), skip the banner display and call `onComplete`/`onDismiss` immediately — the task was already done when the subscription opened.
- `queue:task-started` events are NOT replayed after an events-stream reconnect (the `queue` channel's snapshot is only `queue:updated`). Any page that relies on them to attach `progressShow` handlers must also register `queueSSEManager.onConnect(...)` recovery so it doesn't strand a subscription across a dropped connection; `progressShow`/`sseManager` dedupe by taskId, so re-attaching is safe. Two different recovery shapes exist, and picking the wrong one for a given page matters:
  - **Re-fetch and re-attach** (the Editor, `app-ui/anytale/anytale.mjs`'s reconnect-recovery effect): re-fetches `/generation/tasks/active` and re-attaches handlers to in-flight tasks it owns. Appropriate when the page has no server-side source of truth to re-synchronise against beyond the queue itself.
  - **Server-owned session stream** (AnyTale Play, `app-ui/play/play-page.mjs`): the page attaches no task handlers at all. It subscribes to `GET /play/session/events`, and every (re)connect of that stream re-sends the full session state as its first push, so a dropped connection needs no client-side recovery — the server owns what is generating and the page renders what it is told. Prefer this shape whenever the server already owns the work (like a tale), rather than re-deriving "what was I waiting on" from `/generation/tasks/active`.

## TagSelectorPanel Singleton

All opens of `TagSelectorPanel` go through `openTagPanel(config)` / `closeTagPanel()` from `app-ui/tags/tag-panel-state.mjs`. Never render `<${TagSelectorPanel}.../>` inline — use the singleton API instead.

```js
import { openTagPanel, closeTagPanel } from '../tags/tag-panel-state.mjs';

// Open a floating browse-only panel
openTagPanel({ type: 'float', initialSearchTerm: term, showConfirm: false });

// Open a modal selector with a confirm callback
openTagPanel({ type: 'modal', initialSearchTerm: '', onConfirm: (displayName, internalName) => { ... }, confirmRequiresDefinition: false });

// Close from inside a handler
closeTagPanel();
```

Config fields: `type` (`'float'|'modal'`), `initialSearchTerm?`, `onConfirm?`, `showConfirm?` (default `true`), `confirmLabel?`, `confirmRequiresDefinition?` (default `true`), `onClose?` (called by `closeTagPanel` before closing).

The singleton enforces at most one panel open at a time. Same-type re-opens update the initialSearchTerm and re-run search; type switches close the old panel first (via `setTimeout(0)`).

## Save/Revert Pattern (settings and persistent records)

Use `useFormRecord` from `app-ui/forms.mjs` to manage dirty state. Derive button enable states via `formButtonStates(recorded, dirty, ready)`. On save: call the API → `markSaved(newData)`. On revert: confirm via `showDialog` → reset form state to `savedData`. Config-style forms that always exist set `recorded = true` always and omit delete.

**`recorded` must mean "present in the library", and the save path must branch on the same value the label does.** Where `recorded` is derived from an async library list (the AnyTale Character, Outfit, and Location sections compute it as `isInLibrary` — `uid && list.some((r) => r.uid === uid)`), a form can hold a **dead uid**: one deleted from the library in another tab, or seeded from a tale snapshot that this library never had. The button then correctly reads "Create" — so the save handler must branch on `isInLibrary` too, POSTing for a fresh server-assigned uid. Branching on `record.uid` being merely truthy instead issues a PUT, and because the AnyTale PUT routes are **upserts** (`upsertCharacter`/`upsertOutfit`/`upsertLocation` in `server/features/anytale/repository.mjs`), that silently resurrects the deleted record under its old uid, re-binding every dangling reference to it.

**The third argument, `ready`, exists because that same derivation has a load window.** A section that seeds its list to `[]` and fills it from a fetch reports `recorded === false` for every record — valid or not — until the fetch resolves, and `dirty` is typically `!recorded || !equals(...)`, so it is unconditionally `true` in that window too. Saving there would POST a duplicate of a perfectly good record. Pass a `listLoaded` flag as `ready` to hold Save disabled until the baseline is known; it defaults to `true`, so callers whose `recorded` is not list-derived (`!!record.uid`) need not pass it. If the fetch **fails**, leave `ready` false — Save stays disabled rather than guessing — and surface the reason with a `toast.error`. Prefer the toast to a tooltip on the disabled Save: a disabled `Button`'s `tooltip` does now show (it moves to a wrapper span), but a failed load is a one-time problem the user should notice without hovering.

### Form action button row

Every Save/Revert/Delete row follows the same order, icon, and color:

| Button        | Icon    | Color                                      | Order           |
| ------------- | ------- | ------------------------------------------ | --------------- |
| Save / Create | `save`  | `primary`                                  | 1st             |
| Revert        | `undo`  | `secondary` (or omit — `Button`'s default) | 2nd             |
| Delete        | `trash` | `danger`                                   | 3rd (rightmost) |

Both Delete and Revert require a `showDialog` confirmation before acting (e.g. `['Delete', 'Cancel']`, `['Revert', 'Cancel']`). Save does not require confirmation.

There are two layout sub-patterns, depending on whether the form is a top-level entity editor or an item inside a `DynamicList`:

- **Pattern A — top-level entity form** (e.g. `character-section.mjs`, `plot-section.mjs`, `outfit-section.mjs`): `HorizontalEdgesLayout` with a left-aligned **"Clear"** button (`color="danger" icon="x"`) whenever the form content can be cleared, and a right-aligned `HorizontalLayout gap="small"` containing Save/Revert/Delete. The left button must always be labeled "Clear" — entity-specific labels are not the convention. Clear uses `confirmClear(saveEnabled, message, title)` from `app-ui/forms.mjs` so it prompts for confirmation only when `saveEnabled` is true (unsaved changes exist); when Save is disabled (nothing is dirty), Clear executes immediately without a dialog.
- **Pattern B — DynamicList item form** (e.g. `models-config-tab.mjs`'s `ModelEntryForm`/`ExtensionEntryForm`): no left-side button; a right-aligned `HorizontalLayout gap="small" justifyContent="flex-end"` containing Save/Revert/Delete. An unsaved new item is discarded by closing/removing its DynamicList card (wired via the list's `onDelete` callback), not via a dedicated Cancel button. Revert stays disabled for the entire lifetime of a new/unrecorded item since there is no saved baseline to revert to (`formButtonStates` returns `revertEnabled: recorded && dirty`, and `recorded` is false for a new item).

**Form-wide errors go in a `FormStatusPanel` immediately above the button row**, in both Pattern A and Pattern B. The panel owns no margin or positioning — it is just another child of the form's `VerticalLayout`, spaced by that layout's gap — and it returns `null` when `messages` is empty, so render it unconditionally rather than wrapping it in a ternary:

```js
<${VerticalLayout} gap="medium">
  ...form fields...
  <${FormStatusPanel} messages=${formErrors} />
  <${HorizontalLayout} gap="medium" justifyContent="flex-end">
    ...Save / Revert / Delete...
  </${HorizontalLayout}>
</${VerticalLayout}>
```

Never hand-roll a `Panel variant="outlined" color="danger"` for this. (`plot-section.mjs`'s rules-error panel predates the component and is its visual reference, not a counter-example to copy.)

Size selection: the default `size="medium"` for page-level/top-of-page single-form contexts (e.g. `anytale-config-tab.mjs`, `workflows-config-tab.mjs`, `services-config-tab.mjs`, `misc-config-tab.mjs`, `handy-config-tab.mjs`, `pages-section.mjs`, `brew-editor.mjs`). `size="small"` for forms nested inside a multi-section editor or rendered as a DynamicList item (AnyTale editor sections, `models-config-tab.mjs`'s item forms).

**Known non-compliant forms (not yet fixed):** the Genre list form and SFX list form (`music-section.mjs`, `plot-section.mjs`) conflate their DynamicList delete action with dismissing an unsaved new entry — there is no way to cancel out of a new item except the load modal — and neither form has its own dedicated Delete button in the Save/Revert/Delete row. These should be brought into line with Pattern B in a future change; do not treat them as reference examples.

### DynamicList identity-based keying

`DynamicList` (`custom-ui/layout/dynamic-list.mjs`) keys each rendered row by `item.uid ?? item._localId ?? item.id ?? index`, not raw array position. This matters for any `renderItem` component (like `SfxCard`, `GenreCard`, `VideoExpansionCard`, `HandyPresetForm`) that seeds local edit state from props via `useState` — that initializer only runs once, on mount. If rows were keyed by index, reordering the list (drag, add, delete-from-middle, or a Load-select that reorders/prepends items) would make Preact reuse a slot's existing component instance for a _different_ item, silently carrying stale unsaved-edit state onto the wrong record. Always give new/unsaved items a stable `_localId` (e.g. `String(Date.now())`) so this keying works correctly for them too.

The `id` fallback assumes `id` is an immutable identity. Where `id` is instead a **user-editable field** — the workflow editor's Extra Inputs, whose `id` is typed into the form — each keystroke would change the row key, remounting the row and collapsing its card. Such callers pass `getItemKey` (`(item, index) => key`, defaulting to the identity rule above) to key by something stable; Extra Inputs uses `(_item, index) => index`, which is safe because `ExtraInputForm` is fully controlled and holds no local state.

**Expansion is the list's job.** `DynamicList` holds open and pinned state by row key: at most one unpinned row is open, every pinned row is open, and pinning or unpinning only affects its own row. A new row opens and scrolls into view with no caller wiring: the list's add button records its slot, and any other create or clone is inferred as exactly one new row key whose item is unsaved (`_localId`, no `uid`). So a caller's create or clone gives its one new item a `_localId`; a Load of saved records or a multi-row hydration does not open anything. Rows keep the same key during a drag, and the dragged row stays mounted but hidden, so a reorder keeps expansion and form state.

**A row survives its first save on its own.** Creating a record swaps the row's `{ _localId }` item for the server's `{ uid }` record in place, which changes its identity key. `DynamicList` (`useStableRowKeys`) carries the old row key over on exactly that transition: same slot, the previous item was unsaved and its key is gone, and the new item has a `uid` the list has never held. The row stays mounted, so the card stays open and its form keeps its state. A save handler just replaces the item with the saved record (`prev.map((r) => (sameRow(r) ? saved : r))`). It needs no `_localId` carry-over and no `getItemKey` workaround for this, as long as it replaces in place rather than removing and appending.

### Library + Load pattern (SFX / Genres / Video Expansions / Handy Presets)

Several record types are edited via a shared "library + session-selected workspace" pattern: a full CRUD-backed collection on the server (`GET/POST/PUT/DELETE` per item), a sessionStorage-persisted set of selected UIDs (`anytale-state.mjs`'s `load*Selected`/`save*Selected` pairs), and a **Load** button (`size="small" color="secondary" icon="folder-open"`) next to the section's `H2` that opens a `SearchSelectModal` (multi-select) over the full library. Selecting a new subset replaces the server-backed items in the workspace while preserving any unsaved local items (identified by `_localId`, no `uid` yet). Each item in the workspace list renders as its own Pattern B form (own Save/Revert/Delete row) via `DynamicList`. Reference implementations: `SfxSection`/`SfxCard`, `MusicSection`'s Genre list/`GenreCard`, `VideoSection`'s Tag Expansions list/`VideoExpansionCard`, and `HandySection`/`HandyPresetForm` — all in `music-section.mjs` and `handy-section.mjs`. A workspace-list Clear button also guards via `confirmClear(dirtyUids.size > 0 || list.some((x) => !x.uid), message, title)`, skipping confirmation when no item in the list is dirty.

**Modal-based Clone convention.** Every Load modal (both the multi-select library modals above and the single-select Character/Outfit/Plot Load modals) carries a Clone `itemAction` (`icon: 'copy'`, `title: 'Clone'`, `closeAfter: true`) via `SearchSelectModal`'s `itemActions` prop. Cloning always produces an UNSAVED copy: `uid` stripped via `cloneRecordData(source, { omit, clear })` and the name de-duplicated via `nextCloneName(allLibraryNames, sourceName)` (both in `app-ui/forms.mjs` — `(copy)`, `(copy 2)`, … numbering). Generated/derived media fields are stripped per entity (character: `portraitUrl`/`audioUrl`/`introTranscript`; outfit: `renderUrl`; SFX: `audioUrl`; genre: `tracks` → `[]`, `coverUrl` → `''`; part: `data.previewImageUrl` → `''`). Multi-select modals insert the clone into the workspace `DynamicList` as a new `_localId` item; single-select modals replace the open form (with a `showDialog(['Clone', 'Cancel'])` confirm if the form has unsaved edits). The modal is the ONLY place to clone — the former in-form Clone button on `PartItem` was removed; do not add per-item Clone buttons to forms.

**Scope of that rule: library records only.** It governs entities that have their own server-backed collection reached through a Load modal, where an in-form Clone button competed with the modal's `itemAction`. A **sub-item of a single record** — one with no library of its own, no Load modal, and no `uid` — is outside it, and may carry an in-row Clone action. The reference case is the Location editor's Spots list (`location-section.mjs`), whose rows clone via a `DynamicList` `headerActions` entry (`icon: 'copy'`, `title: 'Clone'`) inserting a deep copy directly below the source. A spot entry now carries its own `name` field (the editor display label, distinct from `referenceTag`, its `{{spot}}` substitution value — see `docs/features/anytale.md`'s "Reserved `{{spot}}` token"), so cloning a spot **does** de-duplicate through `nextCloneName`/`cloneRecordData` exactly like a library record's clone flow (`clone.name = nextCloneName(current.map((s) => s.name || '').filter(Boolean), spot.name || '')`). What still sets a sub-item apart from a library record is that the parent tracks it **positionally** rather than by `uid` — Location's session-only `previewSpotIndex` addresses a spot by array index, so an in-row clone insertion must remap that index or it silently retargets a neighbour. That positional-index point is the carve-out that still stands; the no-name-to-deduplicate reasoning above it does not.

## Testing

- **Custom UI components**: Every new component added to `public/js/custom-ui/` must have a render entry added to `public/js/custom-ui/test.vitest.mjs`. The entry should render the component with minimal props and assert no `console.error` calls.
- **No tautological assertions**: never assert that an element has a class (or attribute) you just selected it by — `querySelector('.reading-panel')` followed by `expect(el.classList.contains('reading-panel'))` proves nothing. Assert behaviour or content instead: the text it renders, the callback a click fires, the state that changes.
- **Passing definition**: At phase boundaries, "passing" means `npx vitest run` (full suite) exits 0 — not just `--changed`. All tests, including pre-existing ones, must be green before a phase is considered complete.
