export const CREATE_SWARMS_TABLE = `
  CREATE TABLE IF NOT EXISTS swarms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    objective TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_SWARM_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS swarm_tasks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_agent TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    result TEXT,
    depends_on TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_SWARM_TASKS_SWARM_ID_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_swarm_tasks_swarm_id ON swarm_tasks(swarm_id)
`;

export const CREATE_SWARM_TASKS_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status)
`;

export interface SwarmRow {
  id: string;
  name: string;
  objective: string;
  status: string;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface SwarmTaskRow {
  id: string;
  swarm_id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_agent: string | null;
  priority: number;
  result: string | null;
  depends_on: string;
  created_at: string;
  updated_at: string;
}
