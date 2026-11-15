"""Transparent screening metrics, not validated injury or crop-yield predictions."""
from __future__ import annotations
from math import isfinite


def _metric(row, key):
    value = row.get(key)
    return value if isinstance(value, (int, float)) and isfinite(value) else None


def longest_run(rows, predicate):
    """Missing observations interrupt a consecutive-day sequence."""
    best = run = 0
    for row in rows:
        if predicate(row):
            run += 1
            best = max(run, best)
        else:
            run = 0
    return best


def summarize_temperature(rows, cold_threshold=0.0, heat_threshold=35.0):
    mean_values = [_metric(r, 'mean_c') for r in rows]
    mean_values = [v for v in mean_values if v is not None]
    maxima = [_metric(r, 'max_c') for r in rows]
    maxima = [v for v in maxima if v is not None]
    minima = [_metric(r, 'min_c') for r in rows]
    minima = [v for v in minima if v is not None]
    heat = lambda r: _metric(r, 'max_c') is not None and r['max_c'] > heat_threshold
    cold = lambda r: _metric(r, 'min_c') is not None and r['min_c'] < cold_threshold
    return {
        'total_days': len(rows),
        'valid_mean_days': len(mean_values),
        'mean_temperature_c': round(sum(mean_values)/len(mean_values), 2) if mean_values else None,
        'absolute_max_temperature_c': max(maxima) if maxima else None,
        'absolute_min_temperature_c': min(minima) if minima else None,
        'heat_threshold_c': heat_threshold,
        'cold_threshold_c': cold_threshold,
        'heat_exposure_days': sum(bool(heat(r)) for r in rows),
        'cold_exposure_days': sum(bool(cold(r)) for r in rows),
        'max_consecutive_heat_days': longest_run(rows, heat),
        'max_consecutive_cold_days': longest_run(rows, cold),
        'missing_mean_days': len(rows)-len(mean_values),
    }


def compute_gdd(rows, base_temperature=10.0, upper_temperature=30.0):
    """Daily mean-temperature GDD with optional upper cap; nulls stay null."""
    if upper_temperature is not None and upper_temperature <= base_temperature:
        raise ValueError('Upper threshold must be higher than the basal threshold')
    total = 0.0
    valid = 0
    series = []
    for row in rows:
        mean = _metric(row, 'mean_c')
        if mean is None:
            daily = None
        else:
            capped = min(mean, upper_temperature) if upper_temperature is not None else mean
            daily = round(max(0., capped - base_temperature), 3)
            total += daily
            valid += 1
        series.append({'date': row['date'], 'daily_gdd': daily,
                       'cumulative_gdd': round(total, 2) if daily is not None else None})
    return {
        'base_temperature_c': base_temperature,
        'upper_temperature_c': upper_temperature,
        'total_gdd_c_day': round(total, 2) if valid else None,
        'valid_days': valid,
        'daily': series,
        'method': 'max(0, min(T2M, Tupper) - Tbase) per day (daily mean method)',
        'note': 'Thermal development estimate only; upper threshold is not a lethal temperature.'
    }
