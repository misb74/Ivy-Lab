#!/usr/bin/env python3
"""Dataset visualization script. Generates charts and outputs JSON with file paths."""
import sys
import json
import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

def visualize(file_path: str, output_dir: str) -> dict:
    ext = file_path.rsplit('.', 1)[-1].lower()
    if ext == 'csv':
        df = pd.read_csv(file_path)
    elif ext in ('xlsx', 'xls'):
        df = pd.read_excel(file_path)
    elif ext == 'json':
        df = pd.read_json(file_path)
    else:
        return {"error": f"Unsupported file type: {ext}"}

    os.makedirs(output_dir, exist_ok=True)
    charts = []
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()

    # Histograms for numeric columns
    if numeric_cols:
        fig, axes = plt.subplots(1, min(len(numeric_cols), 4), figsize=(4 * min(len(numeric_cols), 4), 4))
        if len(numeric_cols) == 1:
            axes = [axes]
        for i, col in enumerate(numeric_cols[:4]):
            axes[i].hist(df[col].dropna(), bins=30, edgecolor='black', alpha=0.7)
            axes[i].set_title(col)
            axes[i].set_xlabel(col)
            axes[i].set_ylabel('Frequency')
        plt.tight_layout()
        hist_path = os.path.join(output_dir, 'histograms.png')
        plt.savefig(hist_path, dpi=100)
        plt.close()
        charts.append({"type": "histograms", "path": hist_path})

    # Correlation heatmap
    if len(numeric_cols) >= 2:
        fig, ax = plt.subplots(figsize=(8, 6))
        corr = df[numeric_cols].corr()
        sns.heatmap(corr, annot=True, fmt='.2f', cmap='coolwarm', ax=ax)
        ax.set_title('Correlation Heatmap')
        plt.tight_layout()
        corr_path = os.path.join(output_dir, 'correlation_heatmap.png')
        plt.savefig(corr_path, dpi=100)
        plt.close()
        charts.append({"type": "correlation_heatmap", "path": corr_path})

    # Scatter plot (first two numeric columns)
    if len(numeric_cols) >= 2:
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.scatter(df[numeric_cols[0]], df[numeric_cols[1]], alpha=0.5)
        ax.set_xlabel(numeric_cols[0])
        ax.set_ylabel(numeric_cols[1])
        ax.set_title(f'{numeric_cols[0]} vs {numeric_cols[1]}')
        plt.tight_layout()
        scatter_path = os.path.join(output_dir, 'scatter.png')
        plt.savefig(scatter_path, dpi=100)
        plt.close()
        charts.append({"type": "scatter", "path": scatter_path})

    return {"charts": charts, "chart_count": len(charts)}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: visualize.py <file_path> <output_dir>"}))
        sys.exit(1)
    result = visualize(sys.argv[1], sys.argv[2])
    print(json.dumps(result, default=str))
