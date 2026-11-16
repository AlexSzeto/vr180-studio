/**
 * stacked-meter.mjs – Horizontal bar of stacked segments against a maximum,
 * with an optional peak tick.
 *
 * Layout-agnostic: it takes the full width of its parent and the meter height
 * from the theme. The fill shows the current value; a thin vertical tick marks
 * a remembered value (a peak) and shows its tooltip on hover.
 *
 * @module custom-ui/msg/stacked-meter
 */
import { html } from 'htm/preact'
import { useContext } from 'preact/hooks'
import { styled } from '../goober-setup.mjs'
import { currentTheme } from '../theme.mjs'
import { TooltipContext } from '../overlays/tooltip.mjs'

const MeterTrack = styled('div')`
  position: relative;
  width: 100%;
  height: ${() => currentTheme.value.meter.height};
  border-radius: ${() => currentTheme.value.border.radius.small};
  background: ${() => currentTheme.value.colors.meter.track};
`
MeterTrack.className = 'stacked-meter-track'

const MeterFill = styled('div')`
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: ${() => currentTheme.value.border.radius.small};
`
MeterFill.className = 'stacked-meter-fill'

// The hit area is wider than the drawn line so a 2px tick can be hovered.
const PeakTick = styled('div')`
  position: absolute;
  top: calc(-1 * ${() => currentTheme.value.meter.tickOverhang});
  bottom: calc(-1 * ${() => currentTheme.value.meter.tickOverhang});
  width: calc(
    ${() => currentTheme.value.meter.tickWidth} + 4 *
      ${() => currentTheme.value.meter.tickOverhang}
  );
  transform: translateX(-50%);
  cursor: default;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: ${() => currentTheme.value.meter.tickWidth};
    transform: translateX(-50%);
    background: ${() => currentTheme.value.colors.meter.tick};
  }
`
PeakTick.className = 'stacked-meter-peak'

/**
 * A theme colour group name (`primary`, `danger`, …) resolves to that group's
 * background; anything else is used as a CSS colour as-is.
 */
function resolveColor(theme, color) {
  return theme.colors[color]?.background ?? color
}

const clampFraction = (value, max) =>
  max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0

/**
 * StackedMeter - Segmented bar against a maximum, with an optional peak tick.
 *
 * When the segments sum past `max`, the fill is clamped to the full bar and
 * drawn in `overColor` instead of the segment colours.
 *
 * @param {Object} props
 * @param {Array<{ value: number, color: string, label: string }>} [props.segments=[]] - Drawn left to right.
 *   `color` is a theme colour group name or a CSS colour; `label` is the segment's hover tooltip.
 * @param {number} props.max - Value the full bar length represents.
 * @param {{ value: number, tooltip?: string }} [props.marker] - Peak tick position and its hover tooltip.
 * @param {string} [props.overColor='danger'] - Fill colour when the total exceeds `max`.
 * @returns {preact.VNode}
 *
 * @example
 * <StackedMeter
 *   max=${8192}
 *   segments=${[
 *     { value: 6074, color: 'primary', label: 'ComfyUI 5.9 GB' },
 *     { value: 1326, color: 'secondary', label: 'llama.cpp 1.3 GB' },
 *   ]}
 *   marker=${{ value: 7900, tooltip: 'Peak 7.7 GB' }}
 * />
 */
export function StackedMeter({
  segments = [],
  max,
  marker,
  overColor = 'danger',
  ...rest
}) {
  const theme = currentTheme.value
  const tooltip = useContext(TooltipContext)
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0)
  const over = total > max

  const hoverProps = (text) =>
    tooltip && text
      ? {
          onMouseEnter: (e) =>
            tooltip.show(text, e.clientX, e.clientY, e.currentTarget),
          onMouseLeave: () => tooltip.hide(),
        }
      : {}

  return html`
    <${MeterTrack}
      role="meter"
      aria-valuemin="0"
      aria-valuemax=${max}
      aria-valuenow=${total}
      data-over=${over ? 'true' : undefined}
      ...${rest}
    >
      <${MeterFill}>
        ${
          over
            ? html`<div
                class="stacked-meter-segment"
                style=${{ width: '100%', background: resolveColor(theme, overColor) }}
                ...${hoverProps(segments.map((s) => s.label).join('\n'))}
              />`
            : segments.map(
                (seg, i) =>
                  html`<div
                    key=${i}
                    class="stacked-meter-segment"
                    style=${{
                      width: `${clampFraction(seg.value, max) * 100}%`,
                      background: resolveColor(theme, seg.color),
                    }}
                    ...${hoverProps(seg.label)}
                  />`,
              )
        }
      </${MeterFill}>
      ${
        marker &&
        html`<${PeakTick}
          style=${{ left: `${clampFraction(marker.value, max) * 100}%` }}
          ...${hoverProps(marker.tooltip)}
        />`
      }
    </${MeterTrack}>
  `
}
