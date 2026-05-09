export interface Alert {
  type: 'above_threshold' | 'below_threshold' | 'significant_change';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export interface ThresholdConfig {
  [metric: string]: {
    min?: number;
    max?: number;
    changePercent?: number;
  };
}

export function generateAlerts(
  currentData: Record<string, unknown>,
  thresholds: ThresholdConfig,
  delta?: { changes: Array<{ field: string; percentChange?: number }> }
): Alert[] {
  const alerts: Alert[] = [];

  for (const [metric, config] of Object.entries(thresholds)) {
    const value = currentData[metric];

    if (typeof value !== 'number') {
      continue;
    }

    // Check above threshold
    if (config.max !== undefined && value > config.max) {
      alerts.push({
        type: 'above_threshold',
        metric,
        value,
        threshold: config.max,
        message: `${metric} (${value}) is above maximum threshold of ${config.max}`,
      });
    }

    // Check below threshold
    if (config.min !== undefined && value < config.min) {
      alerts.push({
        type: 'below_threshold',
        metric,
        value,
        threshold: config.min,
        message: `${metric} (${value}) is below minimum threshold of ${config.min}`,
      });
    }

    // Check significant change
    if (config.changePercent !== undefined && delta) {
      const fieldDelta = delta.changes.find((c) => c.field === metric);
      if (
        fieldDelta &&
        fieldDelta.percentChange !== undefined &&
        Math.abs(fieldDelta.percentChange) >= config.changePercent
      ) {
        alerts.push({
          type: 'significant_change',
          metric,
          value,
          threshold: config.changePercent,
          message: `${metric} changed by ${fieldDelta.percentChange}% (threshold: ${config.changePercent}%)`,
        });
      }
    }
  }

  return alerts;
}
