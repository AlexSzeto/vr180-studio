/**
 * themed-base.mjs - Themed base components
 *
 * Provides consistent, themed heading (h1, h2, h3) and layout elements
 * (header, vertical, horizontal) using goober
 */

import { styled } from 'goober'
import { currentTheme, getSpacing, getRowTitleSize } from './theme.mjs'

/** Resolves a layout `gap` prop to CSS; 'none' is 0, otherwise the spacing scale. */
const layoutGap = (source, gap) =>
  gap === 'none' ? '0' : getSpacing(currentTheme.value, source, 'gap', gap).gap

/**
 * Label - A simple text label
 * Usage: Form labels, section labels
 */
export const Label = styled('label')`
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.secondary};
`
Label.className = 'themed-label'

/**
 * Caption - Small text label
 * Usage: Tiny text for explanations and instructions
 */
export const Caption = styled('p')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.secondary};
`
Caption.className = 'themed-caption'

/**
 * H1 - Large page heading
 * Size: 2rem (32px)
 * Weight: 600 (bold)
 * Usage: Main page titles
 */
export const H1 = styled('h1')`
  font-size: 2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.2;

  small {
    font-size: 0.5em;
    opacity: 0.6;
  }
`
H1.className = 'themed-h1'

/**
 * H2 - Section heading
 * Size: 1.5rem (24px)
 * Weight: 600 (bold)
 * Usage: Section titles
 */
export const H2 = styled('h2')`
  font-size: 1.2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.3;
`
H2.className = 'themed-h2'

/**
 * H3 - Subsection heading
 * Size: 1rem (16px)
 * Weight: 500 (medium)
 * Usage: Component titles, subsection headings
 */
export const H3 = styled('h3')`
  font-size: 1rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.4;
`
H3.className = 'themed-h3'

/**
 * RowTitle - Size-aware title for a title + control row
 * Its box is exactly the height of a Button/Input of the same `size` (read
 * from `theme.controlSize`), with a matching line-height, so it sits
 * vertically centred beside those controls. Single line: long titles
 * truncate with an ellipsis rather than wrap. Change the rendered element
 * with goober's `as` prop (e.g. `as="h2"`) to keep heading semantics.
 * Usage: The left edge of a row whose right edge holds controls. A status
 * Pill in the same row goes one size down from the title.
 * @param {Object} props
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - Match the `size` of the row's controls
 * @param {'title'|'text'} [props.variant='title'] - `title`: bold primary text on its own title font scale; `text`: normal-weight secondary text at the control font size
 * @example
 * html`
 *   <${HorizontalEdgesLayout}>
 *     <${RowTitle} as="h2" size="small">Parts</${RowTitle}>
 *     <${Button} size="small" icon="plus">Add</${Button}>
 *   </${HorizontalEdgesLayout}>
 * `
 */
export const RowTitle = styled('div')`
  ${({ size = 'medium', variant = 'title' }) => {
    const theme = currentTheme.value
    const { height, titleFontSize, textFontSize } = getRowTitleSize(theme, size)
    const isText = variant === 'text'
    return `
      height: ${height};
      line-height: ${height};
      font-size: ${isText ? textFontSize : titleFontSize};
      font-weight: ${isText ? theme.typography.fontWeight.normal : theme.typography.fontWeight.bold};
      color: ${isText ? theme.colors.text.secondary : theme.colors.text.primary};
    `
  }}
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`
RowTitle.className = 'themed-row-title'

/**
 * UnorderedList - A bulleted list with its marker indent restored.
 * The app-wide CSS reset (see `custom-ui/layout/page.mjs`) zeroes every
 * element's margin and padding, which strips the browser's default `<ul>`
 * indent and leaves bullets flush against the container edge. Use this in
 * place of a raw `<ul>` for any bulleted content list.
 * Usage: Bulleted content lists (not dropdown/menu lists, which manage their
 * own list-style and spacing).
 */
export const UnorderedList = styled('ul')`
  margin-left: 20px;
`
UnorderedList.className = 'themed-unordered-list'

/**
 * HorizontalEdgesLayout - A horizontal flex container that split two children to the left and right edges
 * Usage: Commonly used for headers with a title on the left and actions on the right
 * @param {Object} props
 */
export const HorizontalEdgesLayout = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`
HorizontalEdgesLayout.className = 'horizontal-edges-layout'

/**
 * HorizontalLayout - A horizontal flex container with themed gap
 * Usage: Layout elements in a row with consistent spacing
 * @param {Object} props
 * @param {'none'|'tiny'|'small'|'medium'|'large'} [props.gap='medium'] - Spacing size (2/4/8/16px); match the `size` of the controls in the row. 'none' renders 0 gap; an unknown value warns and falls back to 'medium'
 * @param {'flex-start'|'center'|'flex-end'} [props.justifyContent='flex-start'] - Horizontal alignment of children; use 'flex-end' to right-align
 * @param {boolean} [props.fitContent=false] - When true, children keep their natural width instead of being flex-compressed to fill the row
 */
export const HorizontalLayout = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: ${(props) => props.alignItems || 'flex-end'};
  justify-content: ${(props) => props.justifyContent || 'flex-start'};
  gap: ${(props) => layoutGap('horizontal-layout', props.gap)};

  ${(props) => (props.fitContent ? '& > * { flex: none; }' : '')}
`
HorizontalLayout.className = 'horizontal-layout'

/**
 * VerticalLayout - A vertical flex container with themed gap
 * Usage: Layout elements in a column with consistent spacing
 * @param {Object} props
 * @param {'none'|'tiny'|'small'|'medium'|'large'} [props.gap='medium'] - Spacing size (2/4/8/16px); match the `size` of the controls in the row. 'none' renders 0 gap; an unknown value warns and falls back to 'medium'
 * @param {'flex-start'|'center'|'flex-end'} [props.justifyContent='flex-start'] - Vertical alignment of children; use 'flex-end' to bottom-align
 */
export const VerticalLayout = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: ${(props) => props.justifyContent || 'flex-start'};
  gap: ${(props) => layoutGap('vertical-layout', props.gap)};
  overflow: ${(props) => props.overflow || 'visible'};
`
VerticalLayout.className = 'vertical-layout'
