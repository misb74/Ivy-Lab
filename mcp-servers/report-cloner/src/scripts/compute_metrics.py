#!/usr/bin/env python3
"""Execute metric computations against Excel files using pandas. Reads JSON spec from stdin, outputs JSON to stdout."""

import json
import sys

import pandas as pd


def load_sheet(source_file: str, sheet: str) -> pd.DataFrame:
    return pd.read_excel(source_file, sheet_name=sheet)


def apply_filters(df: pd.DataFrame, filters: list[dict]) -> pd.DataFrame:
    for f in filters:
        col = f['column']
        op = f['operator']
        val = f['value']

        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found. Available: {list(df.columns)}")

        if op == 'eq':
            df = df[df[col] == val]
        elif op == 'neq':
            df = df[df[col] != val]
        elif op == 'gt':
            df = df[df[col] > val]
        elif op == 'gte':
            df = df[df[col] >= val]
        elif op == 'lt':
            df = df[df[col] < val]
        elif op == 'lte':
            df = df[df[col] <= val]
        elif op == 'between':
            df = df[df[col].between(val[0], val[1])]
        elif op == 'in':
            df = df[df[col].isin(val)]
        elif op == 'is_null':
            df = df[df[col].isna()]
        elif op == 'not_null':
            df = df[df[col].notna()]
        else:
            raise ValueError(f"Unknown operator: {op}")

    return df


def aggregate(series: pd.Series, method: str):
    if method == 'count':
        return int(series.count())
    elif method == 'sum':
        return float(series.sum())
    elif method == 'mean':
        return float(series.mean())
    elif method == 'median':
        return float(series.median())
    elif method == 'min':
        return float(series.min()) if pd.api.types.is_numeric_dtype(series) else str(series.min())
    elif method == 'max':
        return float(series.max()) if pd.api.types.is_numeric_dtype(series) else str(series.max())
    else:
        raise ValueError(f"Unknown aggregation: {method}")


def execute_computation(spec: dict) -> dict:
    comp_id = spec['computation_id']
    try:
        df = load_sheet(spec['source_file'], spec['sheet'])
        operation = spec['operation']

        # Apply filters
        if spec.get('filters'):
            df = apply_filters(df, spec['filters'])

        rows_matched = len(df)

        if operation == 'count':
            return {'computation_id': comp_id, 'value': rows_matched, 'rows_matched': rows_matched}

        elif operation == 'sum':
            col = spec.get('aggregation_column')
            if not col:
                raise ValueError("sum requires aggregation_column")
            return {'computation_id': comp_id, 'value': float(df[col].sum()), 'rows_matched': rows_matched}

        elif operation == 'mean':
            col = spec.get('aggregation_column')
            if not col:
                raise ValueError("mean requires aggregation_column")
            return {'computation_id': comp_id, 'value': float(df[col].mean()), 'rows_matched': rows_matched}

        elif operation == 'filter_count':
            return {'computation_id': comp_id, 'value': rows_matched, 'rows_matched': rows_matched}

        elif operation == 'group_aggregate':
            group_by = spec.get('group_by', [])
            agg_col = spec.get('aggregation_column')
            agg_method = spec.get('aggregation', 'count')

            if not group_by:
                raise ValueError("group_aggregate requires group_by")

            if agg_col and agg_method != 'count':
                grouped = df.groupby(group_by)[agg_col].agg(agg_method)
            else:
                grouped = df.groupby(group_by).size()

            # Convert to dict with string keys
            grouped_values = {}
            for key, val in grouped.items():
                str_key = str(key) if not isinstance(key, tuple) else ' | '.join(str(k) for k in key)
                grouped_values[str_key] = float(val) if isinstance(val, (int, float)) else str(val)

            return {'computation_id': comp_id, 'grouped_values': grouped_values, 'rows_matched': rows_matched}

        elif operation == 'derived':
            formula = spec.get('formula')
            if not formula:
                raise ValueError("derived requires formula")
            # Execute formula in pandas context
            result = eval(formula, {'df': df, 'pd': pd, 'len': len})
            if isinstance(result, pd.Series):
                result = result.to_dict()
            elif isinstance(result, (int, float)):
                result = float(result)
            return {'computation_id': comp_id, 'value': result, 'rows_matched': rows_matched}

        else:
            raise ValueError(f"Unknown operation: {operation}")

    except Exception as e:
        return {'computation_id': comp_id, 'error': str(e)}


if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        computations = input_data.get('computations', [])
        results = [execute_computation(spec) for spec in computations]
        print(json.dumps({'results': results}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
