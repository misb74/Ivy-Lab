---
name: customer-data
description: Customer Data — Upload, Map & Query Skill. Use when the user wants to upload or import their own data (employee roster, org hierarchy, headcount, comp/compensation/salary data, department data), import CSV/Excel/spreadsheet files, query previously uploaded workforce data, or reference "my data", "our data", "my org", or "our headcount".
---

# Customer Data — Upload, Map & Query Skill

## When to use
When the user wants to upload their own workforce data (employee rosters, org hierarchies, comp bands, headcount files) or query data they've previously uploaded.

## MCP Server
`agent-customer-data` — tenant-scoped SQLite databases, one per organization.

## Tools

| Tool | Purpose |
|------|---------|
| `customer_data_ingest` | Upload + ingest a dataset (CSV/XLSX) into queryable storage |
| `customer_data_list` | List all datasets for the current tenant |
| `customer_data_query` | Query a dataset with structured filters, grouping, ordering |
| `customer_data_schema` | Get dataset schema, column mappings, and sample data |
| `customer_data_stats` | Aggregate statistics (count, sum, avg by dimension) |
| `customer_data_delete` | Remove a dataset and all its records |

## Workflow

### Upload Flow
1. User uploads a file via the Datasets page (frontend handles upload to `/api/datasets/upload`)
2. Schema auto-detected — columns mapped to Ivy concepts (JOB_TITLE, DEPARTMENT, SALARY, etc.)
3. User reviews/adjusts mappings in the UI
4. User clicks "Save & Ingest" — data loaded into tenant-scoped SQLite

### Query Flow (in chat)
When the user asks about their data:
1. Call `customer_data_list` to see available datasets
2. Call `customer_data_schema` to understand the columns
3. Call `customer_data_query` or `customer_data_stats` with structured params
4. Present results, optionally as an artifact

### Cross-Source Analysis
Customer data can be combined with external sources:
- Query customer roles → enrich with O*NET/Lightcast data
- Feed customer headcount into workforce simulation
- Compare customer comp bands against BLS wage data

## Query Examples

Headcount by department:
```json
{
  "dataset_id": "...",
  "group_by": ["_department"],
  "metrics": [{ "field": "id", "agg": "count" }]
}
```

Software engineers earning over 100K:
```json
{
  "dataset_id": "...",
  "filters": [
    { "field": "_job_title", "op": "like", "value": "%Software Engineer%" },
    { "field": "_salary", "op": "gt", "value": 100000 }
  ],
  "limit": 50
}
```

## Denormalized Fields
These fields are indexed for fast querying:
`_job_title`, `_department`, `_location`, `_job_level`, `_job_family`, `_salary`, `_fte`, `_hire_date`, `_soc_code`

All original columns are preserved in `data_json` and queryable via `json_extract()`.
