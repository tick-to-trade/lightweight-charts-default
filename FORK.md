# tick2trade fork of Lightweight Charts

This repository is a fork of [tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts).
It is based on the upstream **v5.2.1** and adds the features listed below.
`dist/` is committed, because the package is installed directly from git.

Please keep the attribution requirements of the upstream license (see `NOTICE`):
the attribution logo is disabled by default in this fork (`layout.attributionLogo`).

## Panes

Panes are **not** changed by the fork, the API and the behavior are the upstream ones:
`chart.addPane()`, `chart.panes()`, `chart.removePane()`, `chart.swapPanes()`, `IPaneApi`,
`chart.addSeries(definition, options, paneIndex)`, `series.moveToPane()`, `chart.priceScale(id, paneIndex)`.

Things to remember when working with them:

- a pane is removed automatically when its last series is removed, unless `preserveEmptyPane` is set;
- `chart.removePane()` does not remove the series of the pane, remove them first;
- every pane has its own price scales, `leftPriceScale` / `rightPriceScale` chart options are applied to all of them;
- `chart.priceScale(id)` without the pane index is the price scale of the first pane.

## Fork features

### Series

- `LineType.Cross`, `LineType.Circle` - markers on each point instead of the line.
- `markerType: MarkerType.Diamond` (line series) - diamonds on each point.
- `withBreaks` (line and area series) - the line is broken on `NaN` values. `NaN` values are allowed by data validators.
- `LineType.WithSteps` - steps are shifted to the bar's edge.
- `columns`, `columnWidth` (histogram series) - thin columns instead of bars.
- The base of the histogram is included to the autoscale for overlay price scales only
  (use `autoscaleInfoProvider` to include it on the other price scales).
- The first value (percentage / indexed to 100 modes) of bar and candlestick series is the open price.

### Price scale

- `percentageModeReferenceSourceIndex` - the source used as the shared base of percentage and indexed to 100 modes.

### Time scale

- `minimumVisibleBarsFromRight`, `skipZeroWeightTicks`, `tickMarkWeightCalculator` options.
- `timeScale().formatDateTime(time)`.

### Scroll

- `handleScroll.pressedHorizontalMouseMove`, `handleScroll.pressedVerticalMouseMove`.

### Defaults which differ from the upstream

- `layout.attributionLogo` is `false`.

## Build

```bash
npm ci
npm run build:release
```
