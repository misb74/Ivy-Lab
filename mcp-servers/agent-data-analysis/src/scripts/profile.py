#!/usr/bin/env python3
"""Dataset profiling script. Outputs JSON to stdout."""
import sys
import json
import pandas as pd

def profile(file_path: str) -> dict:
    ext = file_path.rsplit('.', 1)[-1].lower()
    if ext == 'csv':
        df = pd.read_csv(file_path)
    elif ext in ('xlsx', 'xls'):
        df = pd.read_excel(file_path)
    elif ext == 'json':
        df = pd.read_json(file_path)
    else:
        return {"error": f"Unsupported file type: {ext}"}

    profile_data = {
        "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "columns": [],
        "missing_values": {},
        "descriptive_stats": {},
        "head": df.head(5).to_dict(orient='records'),
        "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
    }

    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "non_null_count": int(df[col].count()),
            "null_count": int(df[col].isnull().sum()),
            "null_percentage": round(float(df[col].isnull().mean() * 100), 2),
            "unique_count": int(df[col].nunique()),
        }
        if df[col].dtype in ('int64', 'float64'):
            desc = df[col].describe()
            col_info["stats"] = {k: round(float(v), 4) for k, v in desc.items()}
        elif df[col].dtype == 'object':
            col_info["top_values"] = df[col].value_counts().head(5).to_dict()
        profile_data["columns"].append(col_info)

    missing = df.isnull().sum()
    profile_data["missing_values"] = {
        col: int(count) for col, count in missing.items() if count > 0
    }

    numeric_cols = df.select_dtypes(include=['number'])
    if not numeric_cols.empty:
        desc = numeric_cols.describe()
        profile_data["descriptive_stats"] = {
            col: {k: round(float(v), 4) for k, v in desc[col].items()}
            for col in desc.columns
        }

    return profile_data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: profile.py <file_path>"}))
        sys.exit(1)
    result = profile(sys.argv[1])
    print(json.dumps(result, default=str))
