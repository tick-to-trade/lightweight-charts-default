import { ChartOptionsImpl } from '../chart-model';
import { HorzScaleOptions } from '../time-scale';
import { TickMarkFormatter } from './horz-scale-behavior-time';
import { Time } from './types';

/**
 * Extended time scale options for time-based horizontal scale
 */
export interface TimeScaleOptions extends HorzScaleOptions {
	/**
	 * Tick marks formatter can be used to customize tick marks labels on the time axis.
	 *
	 * @defaultValue `undefined`
	 */
	tickMarkFormatter?: TickMarkFormatter;

	/**
	 * Custom calculator of the tick mark weight of the time point.
	 * The points with the bigger weight have the bigger priority to be shown on the time scale.
	 *
	 * @defaultValue `undefined`
	 */
	tickMarkWeightCalculator?: (time: Time) => number;
}

/**
 * Options for chart with time at the horizontal scale
 */
export interface TimeChartOptions extends ChartOptionsImpl<Time> {
	/**
	 * Extended time scale options with option to override tickMarkFormatter
	 */
	timeScale: TimeScaleOptions;
}
