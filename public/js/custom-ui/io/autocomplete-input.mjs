/**
 * autocomplete-input.mjs – Plain-text input with autocomplete dropdown.
 *
 * Wraps `Input` and composes `useAutocomplete` + `AutocompleteDropdown` so a
 * caller gets a filtered suggestion dropdown on an ordinary controlled text
 * field — unlike `ChipAutocompleteInput`, confirming a suggestion here never
 * converts the value into a pill; it stays plain editable text.
 *
 * `Input` is a class component wrapping a goober-styled `<input>` — a `ref`
 * on it yields the Preact instance, not the DOM node, so the anchor rect for
 * the dropdown is captured event-drivenly (via onFocus/onInput) instead.
 *
 * @module custom-ui/io/autocomplete-input
 */
import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { useCallback, useMemo, useRef, useState } from 'preact/hooks'
import { Input } from './input.mjs'
import { useAutocomplete } from './use-autocomplete.mjs'
import { AutocompleteDropdown } from './autocomplete-dropdown.mjs'
import { normalizeSearchItems } from '../../app-ui/chip-autocomplete-input.mjs'
import { SearchSelectModal } from '../overlays/search-select.mjs'
import { CONTROL_SIZES } from '../theme.mjs'
import { resolveFieldSize, resolveWidthScale } from '../util.mjs'

/**
 * AutocompleteInput – themed text input with an autocomplete dropdown and
 * an optional "browse all options" search modal.
 *
 * @param {Object}   props
 * @param {string}   [props.label]
 * @param {string}   [props.placeholder]
 * @param {string[]} [props.suggestions=[]]     – autocomplete candidates
 * @param {string}   props.value                – current field value (controlled)
 * @param {Function} props.onValueChange        – (newValue: string) => void; called for both typed input and confirmed suggestions
 * @param {boolean}  [props.disabled=false]
 * @param {'compact'|'normal'|'wide'|'full'} [props.widthScale='normal'] – Width: compact 80px | normal 160px | wide 320px | full 100% + flex-grow. Default `normal`; `auto` not accepted (warns and falls back to the default). Forwarded to the inner `Input`.
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] – control size step, forwarded to the
 *   inner `Input` (its embedded browse button renders one size down). The removed `heightScale`
 *   prop logs a warning and is ignored.
 * @param {Array<string|{label:string,value:string}>} [props.searchItems] – optional override for the browse-all modal; defaults to `suggestions`
 * @param {string}   [props.searchTitle]        – modal title (defaults to "Select {label}")
 * @param {{ status: 'idle'|'validating'|'valid'|'warning'|'invalid', message?: string }} [props.validation]
 *   – forwarded to the inner `Input`'s `validation` prop
 * @param {boolean}  [props.showSearch=true]    – when false, never render the "Browse all options"
 *   button or its modal, even with non-empty suggestions (dropdown autocomplete still works)
 *
 * @example
 * <${AutocompleteInput}
 *   label="Section"
 *   value=${section}
 *   onValueChange=${setSection}
 *   suggestions=${knownSections}
 * />
 */
export function AutocompleteInput({
  label,
  placeholder,
  suggestions = [],
  value,
  onValueChange,
  disabled = false,
  widthScale,
  size: sizeProp,
  heightScale,
  searchItems,
  searchTitle,
  showSearch = true,
  validation,
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  // Memoised on the props so a re-render does not repeat a size warning.
  const size = useMemo(
    () =>
      resolveFieldSize(
        'autocomplete-input',
        sizeProp,
        heightScale,
        CONTROL_SIZES,
      ),
    [sizeProp, heightScale],
  )
  // Validated here (and memoised) so a bad value warns once under this
  // component's own source; the inner Input then only sees a valid value.
  const resolvedWidthScale = useMemo(
    () =>
      resolveWidthScale('autocomplete-input', widthScale, { allowAuto: false }),
    [widthScale],
  )
  const anchorRectRef = useRef(null)

  const {
    dropdownState,
    showDropdownRef,
    closeDropdownRef,
    handleDropdownKeyDownRef,
    handleDropdownClick,
  } = useAutocomplete({
    suggestions,
    getAnchorRect: () => anchorRectRef.current,
    onConfirm: (item) => {
      onValueChange?.(item)
      closeDropdownRef.current()
    },
    showEmptyOnNoResults: false,
  })

  const captureAnchorRect = useCallback((e) => {
    anchorRectRef.current = e.currentTarget.getBoundingClientRect()
  }, [])

  const handleInput = useCallback(
    (e) => {
      captureAnchorRect(e)
      onValueChange?.(e.target.value)
      showDropdownRef.current(e.target.value)
    },
    [captureAnchorRect, onValueChange, showDropdownRef],
  )

  const handleKeyDown = useCallback(
    (e) => {
      handleDropdownKeyDownRef.current(e)
    },
    [handleDropdownKeyDownRef],
  )

  const handleBlur = useCallback(() => {
    closeDropdownRef.current()
  }, [closeDropdownRef])

  const browseItems = useMemo(
    () => normalizeSearchItems(searchItems ?? suggestions),
    [searchItems, suggestions],
  )
  const hasSearch = showSearch && browseItems.length > 0

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
      <${Input}
        label=${label}
        placeholder=${placeholder}
        value=${value}
        disabled=${disabled}
        widthScale=${resolvedWidthScale}
        size=${size}
        buttonProps=${searchButtonProps}
        validation=${validation}
        onFocus=${captureAnchorRect}
        onInput=${handleInput}
        onKeyDown=${handleKeyDown}
        onBlur=${handleBlur}
      />
      <${AutocompleteDropdown}
        dropdownState=${dropdownState}
        onItemClick=${handleDropdownClick}
      />
      ${
        hasSearch &&
        html`
          <${SearchSelectModal}
            isOpen=${searchOpen}
            title=${searchTitle || (label ? `Select ${label}` : 'Select')}
            items=${browseItems}
            mode="single"
            onSelect=${(v) => onValueChange?.(v)}
            onClose=${() => setSearchOpen(false)}
          />
        `
      }
    </${Fragment}>
  `
}
