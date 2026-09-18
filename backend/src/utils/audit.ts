import { PoolClient } from 'pg';
import { query } from '../config/db.js';

export const audit = async (input: { userId?: string; action: string; entity: string; entityId?: string; details?: unknown; ip?: string }, client?: PoolClient) => {
  const db = client || { query } as any;
  await db.query('INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)', [input.userId || null, input.action, input.entity, input.entityId || null, JSON.stringify(input.details || {}), input.ip || null]);
};
