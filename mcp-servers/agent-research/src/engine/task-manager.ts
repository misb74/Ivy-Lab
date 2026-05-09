export type TaskStatus = 'planning' | 'researching' | 'synthesizing' | 'complete' | 'error';

export interface ResearchTask {
  id: string;
  query: string;
  depth: 'quick' | 'standard' | 'deep';
  status: TaskStatus;
  progress: number;
  subQuestions: string[];
  sources: Array<{ url: string; title: string; snippet: string }>;
  synthesis: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

const tasks = new Map<string, ResearchTask>();
let taskCounter = 0;

export function createTask(query: string, depth: 'quick' | 'standard' | 'deep'): ResearchTask {
  const id = `research_${++taskCounter}_${Date.now()}`;
  const task: ResearchTask = {
    id,
    query,
    depth,
    status: 'planning',
    progress: 0,
    subQuestions: [],
    sources: [],
    synthesis: '',
    created_at: new Date().toISOString(),
  };
  tasks.set(id, task);
  return task;
}

export function getTask(id: string): ResearchTask | undefined {
  return tasks.get(id);
}

export function updateTask(id: string, updates: Partial<ResearchTask>): void {
  const task = tasks.get(id);
  if (task) {
    Object.assign(task, updates);
  }
}

export function listTasks(): ResearchTask[] {
  return Array.from(tasks.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
