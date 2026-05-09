import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { requireCurrentLock } from '../engine/gate.js';
import { buildDeployStatusArtifact, buildBuildProgressArtifact } from '../engine/artifacts.js';

export interface SpecDeployInput {
  product_id: string;
  spec_lock_id?: string;
  action?: 'start' | 'stop' | 'status';
}

export function handleSpecDeploy(input: SpecDeployInput) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const action = input.action ?? 'start';

  if (action === 'status') {
    return getDeployStatus(input.product_id);
  }

  if (action === 'stop') {
    return stopDeploy(input.product_id);
  }

  // ─── Start deploy ──────────────────────────────────────────────────
  const lock = requireCurrentLock(input.product_id, input.spec_lock_id);

  // Check react build exists
  const reactBuild = db.prepare(
    "SELECT build_id FROM build_record WHERE spec_lock_id = ? AND phase = 'react_build' AND status = 'success' ORDER BY completed_at DESC LIMIT 1"
  ).get(lock.spec_lock_id) as { build_id: string } | undefined;

  if (!reactBuild) {
    throw new Error(`No successful React build for lock ${lock.spec_lock_id}. Run spec_build_react first.`);
  }

  // Check for existing running deploy
  const runningDeploy = db.prepare(
    "SELECT deploy_id FROM deploy_record WHERE product_id = ? AND status = 'running'"
  ).get(input.product_id) as { deploy_id: string } | undefined;

  if (runningDeploy) {
    throw new Error(`Product "${input.product_id}" already has a running deployment (${runningDeploy.deploy_id}). Stop it first.`);
  }

  const deployId = crypto.randomUUID();

  // In the full pipeline, this would:
  // 1. Run database migrations
  // 2. Start backend GraphQL server
  // 3. Start Vite dev server for UI
  // 4. Configure reverse proxy
  // For now, record the deploy intent.

  const ports = {
    database: 5432 + Math.floor(Math.random() * 1000),
    backend: 4000 + Math.floor(Math.random() * 1000),
    ui: 3000 + Math.floor(Math.random() * 1000),
  };

  db.prepare(`
    INSERT INTO deploy_record (deploy_id, spec_lock_id, build_id, product_id, status, started_at, ports_json)
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `).run(deployId, lock.spec_lock_id, reactBuild.build_id, input.product_id, now, JSON.stringify(ports));

  // NOTE: is_real=false because we don't actually start processes yet.
  // The deploy_status artifact will show servers as "pending" and URLs as null.
  return {
    deploy_id: deployId,
    spec_lock_id: lock.spec_lock_id,
    build_id: reactBuild.build_id,
    product_id: input.product_id,
    status: 'recorded',
    ports,
    artifact: buildDeployStatusArtifact(input.product_id, deployId, lock.spec_lock_id, 'recorded', ports, false),
    progress_artifact: buildBuildProgressArtifact(input.product_id, lock.spec_lock_id, [
      { phase: 'implement', status: 'success' },
      { phase: 'uispec', status: 'success' },
      { phase: 'react_build', status: 'success' },
      { phase: 'deploy', status: 'recorded', details: 'Spec and artifacts saved' },
    ]),
    message: `Deploy recorded for "${input.product_id}". The spec, implementation, UI specification, and React build are all saved and linked to lock ${lock.spec_lock_id.slice(0, 8)}. Full local server deployment (Vite + backend + DB) is coming in Phase B of the pipeline.`,
  };
}

function getDeployStatus(productId: string) {
  const db = getDatabase();

  const deploy = db.prepare(`
    SELECT deploy_id, spec_lock_id, build_id, status, started_at, stopped_at, ports_json, error_message
    FROM deploy_record WHERE product_id = ? ORDER BY started_at DESC LIMIT 1
  `).get(productId) as any | undefined;

  if (!deploy) {
    return {
      product_id: productId,
      status: 'no_deployments',
      message: `No deployments found for "${productId}".`,
    };
  }

  return {
    product_id: productId,
    deploy_id: deploy.deploy_id,
    spec_lock_id: deploy.spec_lock_id,
    build_id: deploy.build_id,
    status: deploy.status,
    ports: JSON.parse(deploy.ports_json || '{}'),
    started_at: deploy.started_at,
    stopped_at: deploy.stopped_at,
    error_message: deploy.error_message,
    message: deploy.status === 'running'
      ? `Deploy ${deploy.deploy_id} is running.`
      : `Last deploy ${deploy.deploy_id} status: ${deploy.status}.`,
  };
}

function stopDeploy(productId: string) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const deploy = db.prepare(
    "SELECT deploy_id FROM deploy_record WHERE product_id = ? AND status = 'running'"
  ).get(productId) as { deploy_id: string } | undefined;

  if (!deploy) {
    return {
      product_id: productId,
      status: 'no_running_deploy',
      message: `No running deployment found for "${productId}".`,
    };
  }

  db.prepare("UPDATE deploy_record SET status = 'stopped', stopped_at = ? WHERE deploy_id = ?")
    .run(now, deploy.deploy_id);

  return {
    product_id: productId,
    deploy_id: deploy.deploy_id,
    status: 'stopped',
    stopped_at: now,
    message: `Deploy ${deploy.deploy_id} stopped.`,
  };
}
