#!/usr/bin/env python3
"""Extract tables from a PDF using pdfplumber. Outputs JSON to stdout."""

import json
import sys

import pdfplumber


def extract_tables(pdf_path: str) -> list[dict]:
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_tables = []
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                # First row as headers, rest as data
                headers = [str(cell or '').strip() for cell in table[0]]
                rows = []
                for row in table[1:]:
                    rows.append([str(cell or '').strip() for cell in row])
                page_tables.append({
                    'headers': headers,
                    'rows': rows,
                })
            results.append({
                'page_num': i + 1,
                'tables': page_tables,
            })
    return results


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Usage: extract_tables.py <pdf_path>'}))
        sys.exit(1)

    try:
        tables = extract_tables(sys.argv[1])
        print(json.dumps(tables))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
