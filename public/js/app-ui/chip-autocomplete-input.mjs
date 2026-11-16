/**
 * chip-autocomplete-input.mjs – Autocomplete input with inline pills.
 *
 * Composes ContentEditablePillInput so confirmed entries render as dismissible
 * pill spans inside the editor itself (no separate chip row needed). The base
 * hides already-selected values from its dropdown and flags selections that are
 * not in `suggestions` (see `flagUnknown`).
 *
 * A search icon button is rendered inside the input (top-right overlay) whenever
 * there are items to browse. Clicking it opens a SearchSelectModal in multi-select
 * mode; every toggle is reflected immediately in the pill list. An optional
 * `secondaryButtonProps` action stacks below the search button, or takes its
 * place when there is nothing to browse.
 */
import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { useState, useCallback, useMemo } from 'preact/hooks'
import { ContentEditablePillInput } from '../custom-ui/io/content-editable-pill-input.mjs'
import { SearchSelectModal } from '../custom-ui/overlays/search-select.mjs'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalizeSearchItems(items) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  const out = []
  for (const item of items) {
    const normalized =
      typeof item === 'string'
        ? { label: item, value: item }
        : {
            label: String(item?.label ?? item?.value ?? ''),
            value: item?.value ?? item?.label,
          }
    if (
      !normalized.label ||
      normalized.value === undefined ||
      normalized.value === null
    )
      continue
    const key = String(normalized.value).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ChipAutocompleteInput – autocomplete input that renders selections as inline pills.
 *
 * @param {string}   props.label
 * @param {string}   [props.placeholder]
 * @param {string[]} props.suggestions       – autocomplete candidates
 * @param {string[]} props.values            – current selection list
 * @param {Function} props.onValuesChange    – (newValues: string[]) => void
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.flagUnknown=true] – mark a selection that is not in
 *   `suggestions` with a warning icon (forwarded to ContentEditablePillInput)
 * @param {Array<string|{label:string,value:string}>} [props.searchItems]
 *   Optional override for the modal items. Defaults to `suggestions`.
 * @param {string}   [props.searchTitle]     – modal title (defaults to "Select {label}")
 * @param {Object}   [props.secondaryButtonProps] – an extra inline icon button,
 *   same shape as `buttonProps` (`{ icon, onClick, title?, disabled?, loading?, … }`).
 *   Rendered below the search button, or in its place when there are no items
 *   to browse.
 * @example
 * <ChipAutocompleteInput
 *   label="Favorite Outfit Archetypes"
 *   suggestions={pool}
 *   values={values}
 *   onValuesChange={setValues}
 *   secondaryButtonProps={{ icon: 'sparkles-alt', title: 'Generate', onClick: generate }}
 * />
 */
export function ChipAutocompleteInput({
  label,
  placeholder,
  suggestions = [],
  values = [],
  onValuesChange,
  disabled = false,
  flagUnknown = true,
  searchItems,
  searchTitle,
  secondaryButtonProps,
}) {
  const [searchOpen, setSearchOpen] = useState(false)

  const browseItems = useMemo(
    () => normalizeSearchItems(searchItems ?? suggestions),
    [searchItems, suggestions],
  )
  const hasSearch = browseItems.length > 0

  const handleValuesChange = useCallback(
    (newValues) => {
      onValuesChange?.(newValues)
    },
    [onValuesChange],
  )

  const handleModalSelect = useCallback(
    (selectedValues) => {
      onValuesChange?.(selectedValues)
    },
    [onValuesChange],
  )

  const searchButtonProps = hasSearch
    ? {
        icon: 'search',
        title: 'Browse all options',
        disabled,
        onClick: () => setSearchOpen(true),
      }
    : undefined

  return html`
    <${Fragment}>
      <${ContentEditablePillInput}
        label=${label}
        values=${values}
        onValuesChange=${handleValuesChange}
        suggestions=${suggestions}
        flagUnknown=${flagUnknown}
        placeholder=${placeholder}
        disabled=${disabled}
        buttonProps=${searchButtonProps ?? secondaryButtonProps}
        secondaryButtonProps=${searchButtonProps ? secondaryButtonProps : undefined}
      />
      ${
        hasSearch &&
        html`
          <${SearchSelectModal}
            isOpen=${searchOpen}
            title=${searchTitle || (label ? `Select ${label}` : 'Select')}
            items=${browseItems}
            mode="multi"
            initialSelected=${values}
            onSelect=${handleModalSelect}
            onClose=${() => setSearchOpen(false)}
          />
        `
      }
    </${Fragment}>
  `
}
