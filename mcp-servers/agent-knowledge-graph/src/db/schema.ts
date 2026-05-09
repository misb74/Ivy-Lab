export const CREATE_ENTITIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    properties TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_RELATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES entities(id),
    target_id TEXT NOT NULL REFERENCES entities(id),
    type TEXT NOT NULL,
    properties TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, target_id, type)
  )
`;

export const CREATE_ENTITIES_TYPE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)
`;

export const CREATE_ENTITIES_NAME_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)
`;

export const CREATE_RELATIONS_SOURCE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id)
`;

export const CREATE_RELATIONS_TARGET_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id)
`;

export interface EntityRow {
  id: string;
  name: string;
  type: string;
  properties: string;
  created_at: string;
  updated_at: string;
}

export interface RelationRow {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: string;
  created_at: string;
}
