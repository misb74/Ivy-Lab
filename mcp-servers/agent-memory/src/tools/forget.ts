import { getDb } from '../db/database.js';
import { getIndex } from '../index-manager.js';

export interface ForgetParams {
  id: number;
}

export async function memoryForget(params: ForgetParams): Promise<{
  success: boolean;
  message: string;
}> {
  const { id } = params;
  const db = getDb();

  const row = db.prepare('SELECT id FROM memories WHERE id = ?').get(id);
  if (!row) {
    return { success: false, message: `Memory with ID ${id} not found` };
  }

  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  getIndex().removeDocument(id);

  return { success: true, message: `Memory ${id} deleted successfully` };
}
