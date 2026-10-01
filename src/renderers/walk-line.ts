import { BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { Coordinate } from '../model/coordinate';
import { MarkerType } from '../model/series-options';
import { SeriesItemsIndexesRange } from '../model/time-data';

import { LinePoint, LineType } from './draw-line';

function distanceByCoordinates(p1x: number, p1y: number, p2x: number, p2y: number): number {
	return Math.hypot(p2x - p1x, p2y - p1y);
}

/**
 * Additional (fork specific) options of the line walking
 */
export interface WalkLineExtraOptions {
	/** Break the line on the points with invalid (empty) coordinate */
	withBreaks?: boolean;
	/** Marker to draw on each point of the line */
	markerType?: MarkerType;
}

// eslint-disable-next-line max-params
export function walkLine<TItem extends LinePoint, TStyle extends CanvasRenderingContext2D['fillStyle' | 'strokeStyle']>(
	renderingScope: BitmapCoordinatesRenderingScope,
	items: readonly TItem[],
	lineType: LineType,
	visibleRange: SeriesItemsIndexesRange,
	barWidth: number,
	// the values returned by styleGetter are compared using the operator !==,
	// so if styleGetter returns objects, then styleGetter should return the same object for equal styles
	styleGetter: (renderingScope: BitmapCoordinatesRenderingScope, item: TItem) => TStyle,
	finishStyledArea: (renderingScope: BitmapCoordinatesRenderingScope, style: TStyle, areaFirstItem: LinePoint, newAreaFirstItem: LinePoint) => void,
	dashPatternLength: number = 0,
	extraOptions: WalkLineExtraOptions = {}
): void {
	if (items.length === 0 || visibleRange.from >= items.length || visibleRange.to <= 0) {
		return;
	}

	const markerType = extraOptions.markerType ?? MarkerType.None;
	if (extraOptions.withBreaks) {
		const groups = breakIntoGroups(items, visibleRange);
		for (const group of groups) {
			walkLineImpl(renderingScope, items, lineType, group, barWidth, styleGetter, finishStyledArea, dashPatternLength, markerType);
		}
		return;
	}

	walkLineImpl(renderingScope, items, lineType, visibleRange, barWidth, styleGetter, finishStyledArea, dashPatternLength, markerType);
}

// eslint-disable-next-line max-params, complexity
function walkLineImpl<TItem extends LinePoint, TStyle extends CanvasRenderingContext2D['fillStyle' | 'strokeStyle']>(
	renderingScope: BitmapCoordinatesRenderingScope,
	items: readonly TItem[],
	lineType: LineType,
	visibleRange: SeriesItemsIndexesRange,
	barWidth: number,
	styleGetter: (renderingScope: BitmapCoordinatesRenderingScope, item: TItem) => TStyle,
	finishStyledArea: (renderingScope: BitmapCoordinatesRenderingScope, style: TStyle, areaFirstItem: LinePoint, newAreaFirstItem: LinePoint) => void,
	dashPatternLength: number,
	markerType: MarkerType
): void {
	const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;

	const firstItem = items[visibleRange.from];
	let currentStyle = styleGetter(renderingScope, firstItem);
	let currentStyleFirstItem = firstItem;

	if (lineType === LineType.Circle || lineType === LineType.Cross) {
		ctx.beginPath();
		for (let i = visibleRange.from; i < visibleRange.to; ++i) {
			const currentItem = items[i];
			const itemStyle = styleGetter(renderingScope, currentItem);
			if (itemStyle !== currentStyle) {
				finishStyledArea(renderingScope, currentStyle, currentStyleFirstItem, currentItem);
				ctx.beginPath();
				currentStyle = itemStyle;
				currentStyleFirstItem = currentItem;
			}
			const x = currentItem.x * horizontalPixelRatio;
			const y = currentItem.y * verticalPixelRatio;
			ctx.moveTo(x, y);
			if (lineType === LineType.Circle) {
				ctx.fillStyle = currentStyle;
				ctx.arc(x, y, ctx.lineWidth / 2, 0, 2 * Math.PI);
				ctx.fill();
			} else {
				const halfBoxSize = (3 * ctx.lineWidth) / 2;

				ctx.beginPath();
				ctx.moveTo(x - halfBoxSize, y);
				ctx.lineTo(x + halfBoxSize, y);
				ctx.strokeStyle = currentStyle;
				ctx.stroke();

				ctx.beginPath();
				ctx.moveTo(x, y - halfBoxSize);
				ctx.lineTo(x, y + halfBoxSize);
				ctx.strokeStyle = currentStyle;
				ctx.stroke();
			}
		}
	} else if (visibleRange.to - visibleRange.from < 2) {
		const halfBarWidth = barWidth / 2;

		ctx.beginPath();

		const item1: LinePoint = { x: firstItem.x - halfBarWidth as Coordinate, y: firstItem.y };
		const item2: LinePoint = { x: firstItem.x + halfBarWidth as Coordinate, y: firstItem.y };

		ctx.moveTo(item1.x * horizontalPixelRatio, item1.y * verticalPixelRatio);
		ctx.lineTo(item2.x * horizontalPixelRatio, item2.y * verticalPixelRatio);

		finishStyledArea(renderingScope, currentStyle, item1, item2);
	} else {
		const shouldTrackDashOffset = dashPatternLength > 0;
		let accumulatedDistance = 0;

		const changeStyle = (newStyle: TStyle, currentItem: TItem) => {
			finishStyledArea(renderingScope, currentStyle, currentStyleFirstItem, currentItem);

			ctx.beginPath();
			currentStyle = newStyle;
			currentStyleFirstItem = currentItem;

			if (shouldTrackDashOffset) {
				const offset = accumulatedDistance % dashPatternLength;
				ctx.lineDashOffset = offset;
				// reset to the remainder to avoid floating-point precision drift over very long series.
				accumulatedDistance = offset;
			}
		};

		let currentItem = currentStyleFirstItem;
		// step lines are shifted to the left by the half of the bar, so the step happens on the bar's edge
		const stepShift = lineType === LineType.WithSteps ? barWidth / 2 : 0;

		ctx.beginPath();
		ctx.moveTo((firstItem.x - stepShift) * horizontalPixelRatio, firstItem.y * verticalPixelRatio);

		for (let i = visibleRange.from + 1; i < visibleRange.to; ++i) {
			currentItem = items[i];
			const currentX = currentItem.x * horizontalPixelRatio;
			const currentY = currentItem.y * verticalPixelRatio;
			const itemStyle = styleGetter(renderingScope, currentItem);

			switch (lineType) {
				case LineType.Simple: {
					ctx.lineTo(currentX, currentY);
					if (shouldTrackDashOffset) {
						const prevItem = items[i - 1];
						const prevX = prevItem.x * horizontalPixelRatio;
						const prevY = prevItem.y * verticalPixelRatio;
						accumulatedDistance += distanceByCoordinates(prevX, prevY, currentX, currentY);
					}
					break;
				}
				case LineType.WithSteps: {
					const prevItem = items[i - 1];
					const prevY = prevItem.y * verticalPixelRatio;
					const stepX = (currentItem.x - stepShift) * horizontalPixelRatio;
					ctx.lineTo(stepX, prevY);
					if (shouldTrackDashOffset) {
						accumulatedDistance += Math.abs(currentItem.x - prevItem.x) * horizontalPixelRatio;
					}

					if (itemStyle !== currentStyle) {
						changeStyle(itemStyle, currentItem);
						ctx.lineTo(stepX, prevY);
					}

					ctx.lineTo(stepX, currentY);
					if (shouldTrackDashOffset) {
						accumulatedDistance += Math.abs(currentItem.y - prevItem.y) * verticalPixelRatio;
					}
					if (i === visibleRange.to - 1) {
						ctx.lineTo(currentX, currentY);
					}
					break;
				}
				case LineType.Curved: {
					const [cp1, cp2] = getControlPoints(items, i - 1, i);
					const cp1x = cp1.x * horizontalPixelRatio;
					const cp1y = cp1.y * verticalPixelRatio;
					const cp2x = cp2.x * horizontalPixelRatio;
					const cp2y = cp2.y * verticalPixelRatio;
					ctx.bezierCurveTo(
						cp1x,
						cp1y,
						cp2x,
						cp2y,
						currentX,
						currentY
					);

					if (shouldTrackDashOffset) {
						const prevItem = items[i - 1];
						const prevX = prevItem.x * horizontalPixelRatio;
						const prevY = prevItem.y * verticalPixelRatio;
						const chord = distanceByCoordinates(prevX, prevY, currentX, currentY);
						const controlPolygon = distanceByCoordinates(prevX, prevY, cp1x, cp1y) +
							distanceByCoordinates(cp1x, cp1y, cp2x, cp2y) +
							distanceByCoordinates(cp2x, cp2y, currentX, currentY);
						accumulatedDistance += (chord + controlPolygon) / 2;
					}
					break;
				}
			}

			if (lineType !== LineType.WithSteps && itemStyle !== currentStyle) {
				changeStyle(itemStyle, currentItem);
				ctx.moveTo(currentX, currentY);
			}
		}

		if (currentStyleFirstItem !== currentItem || currentStyleFirstItem === currentItem && lineType === LineType.WithSteps) {
			finishStyledArea(renderingScope, currentStyle, currentStyleFirstItem, currentItem);
		}

		if (shouldTrackDashOffset) {
			ctx.lineDashOffset = 0;
		}
	}

	if (markerType !== MarkerType.None) {
		const markerShift = lineType === LineType.WithSteps ? barWidth / 2 : 0;
		const markerSize = ctx.lineWidth * 3;
		for (let i = visibleRange.from; i < visibleRange.to; ++i) {
			const item = items[i];
			drawMarker(renderingScope, styleGetter(renderingScope, item), markerType, (item.x - markerShift) as Coordinate, item.y, markerSize);
		}
	}
}

function drawMarker(
	renderingScope: BitmapCoordinatesRenderingScope,
	style: CanvasRenderingContext2D['fillStyle'],
	markerType: MarkerType,
	x: Coordinate,
	y: Coordinate,
	size: number
): void {
	if (markerType !== MarkerType.Diamond) {
		return;
	}

	const { context: ctx, horizontalPixelRatio, verticalPixelRatio } = renderingScope;
	const centerX = x * horizontalPixelRatio;
	const centerY = y * verticalPixelRatio;
	ctx.beginPath();
	ctx.moveTo(centerX, centerY - size);
	ctx.lineTo(centerX + size, centerY);
	ctx.lineTo(centerX, centerY + size);
	ctx.lineTo(centerX - size, centerY);
	ctx.closePath();
	ctx.fillStyle = style;
	ctx.fill();
}

function isLinePointValid(point: LinePoint): boolean {
	// note that zero coordinate is treated as an empty value as well (as it was in the previous versions of the fork)
	return Boolean(point.y) && !Number.isNaN(point.y as number);
}

function breakIntoGroups<TItem extends LinePoint>(items: readonly TItem[], visibleRange: SeriesItemsIndexesRange): SeriesItemsIndexesRange[] {
	const ranges: SeriesItemsIndexesRange[] = [];
	let lastRange: SeriesItemsIndexesRange | null = null;
	const to = Math.min(visibleRange.to, items.length);
	for (let i = Math.max(0, visibleRange.from); i < to; i++) {
		if (isLinePointValid(items[i])) {
			if (lastRange === null) {
				lastRange = { from: i, to: i + 1 };
			} else {
				lastRange.to = i + 1;
			}
		} else if (lastRange !== null) {
			ranges.push(lastRange);
			lastRange = null;
		}
	}
	if (lastRange !== null) {
		ranges.push(lastRange);
	}
	return ranges;
}

const curveTension = 6;

function subtract(p1: LinePoint, p2: LinePoint): LinePoint {
	return { x: p1.x - p2.x as Coordinate, y: p1.y - p2.y as Coordinate };
}

function add(p1: LinePoint, p2: LinePoint): LinePoint {
	return { x: p1.x + p2.x as Coordinate, y: p1.y + p2.y as Coordinate };
}

function divide(p1: LinePoint, n: number): LinePoint {
	return { x: p1.x / n as Coordinate, y: p1.y / n as Coordinate };
}

/**
 * @returns Two control points that can be used as arguments to {@link CanvasRenderingContext2D.bezierCurveTo} to draw a curved line between `points[fromPointIndex]` and `points[toPointIndex]`.
 */
export function getControlPoints(points: readonly LinePoint[], fromPointIndex: number, toPointIndex: number): [LinePoint, LinePoint] {
	const beforeFromPointIndex = Math.max(0, fromPointIndex - 1);
	const afterToPointIndex = Math.min(points.length - 1, toPointIndex + 1);
	const cp1 = add(points[fromPointIndex], divide(subtract(points[toPointIndex], points[beforeFromPointIndex]), curveTension));
	const cp2 = subtract(points[toPointIndex], divide(subtract(points[afterToPointIndex], points[fromPointIndex]), curveTension));

	return [cp1, cp2];
}
