/**
 * Manages E2B Desktop Sandbox lifecycle with per-session isolation.
 * Each session gets its own sandbox, keyed by session_id.
 * Includes idle timeout (10 min) to prevent VM cost leaks.
 */
import { Sandbox } from '@e2b/desktop';

// Cost constants (E2B pricing: 2 vCPU = $0.1008/hr, 2GiB RAM = $0.0324/hr)
const COST_PER_SECOND = (0.1008 + 0.0324) / 3600; // ~$0.000037/s
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60s

const DISPLAY_WIDTH = 1024;
const DISPLAY_HEIGHT = 768;

interface SandboxEntry {
  sandbox: Sandbox;
  sandboxId: string;
  createdAt: number;
  lastActivity: number;
  idleTimer: NodeJS.Timeout;
}

export interface SandboxInfo {
  sandbox_id: string;
  stream_url: string;
  display_width_px: number;
  display_height_px: number;
}

export interface SandboxStatus {
  sandbox_id: string;
  status: 'running' | 'stopped';
  uptime_seconds: number;
  idle_seconds: number;
  estimated_cost_usd: number;
}

class SandboxManager {
  private sandboxes = new Map<string, SandboxEntry>();
  private idleCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start global idle checker
    this.idleCheckInterval = setInterval(() => this.checkIdle(), IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Create a new E2B Desktop Sandbox for a session.
   * If one already exists for this session, destroys it first.
   */
  async createSandbox(sessionId: string): Promise<SandboxInfo> {
    // Clean up existing sandbox for this session
    if (this.sandboxes.has(sessionId)) {
      await this.destroySandbox(sessionId);
    }

    console.error(`[sandbox-manager] Creating sandbox for session ${sessionId}`);

    const sandbox = await Sandbox.create({
      timeoutMs: 30 * 60 * 1000, // 30 min max lifetime
    });

    const now = Date.now();
    const idleTimer = setTimeout(() => this.handleIdleTimeout(sessionId), IDLE_TIMEOUT_MS);

    const entry: SandboxEntry = {
      sandbox,
      sandboxId: sandbox.sandboxId,
      createdAt: now,
      lastActivity: now,
      idleTimer,
    };

    this.sandboxes.set(sessionId, entry);

    // Get the stream URL for the frontend desktop view
    const streamUrl = `https://${sandbox.getHost(6080)}`;

    console.error(`[sandbox-manager] Sandbox ${sandbox.sandboxId} created for session ${sessionId}`);

    return {
      sandbox_id: sandbox.sandboxId,
      stream_url: streamUrl,
      display_width_px: DISPLAY_WIDTH,
      display_height_px: DISPLAY_HEIGHT,
    };
  }

  /**
   * Destroy a sandbox for a session.
   */
  async destroySandbox(sessionId: string): Promise<boolean> {
    const entry = this.sandboxes.get(sessionId);
    if (!entry) return false;

    clearTimeout(entry.idleTimer);

    try {
      await entry.sandbox.kill();
      console.error(`[sandbox-manager] Sandbox ${entry.sandboxId} destroyed for session ${sessionId}`);
    } catch (err) {
      console.error(`[sandbox-manager] Error destroying sandbox ${entry.sandboxId}:`, (err as Error).message);
    }

    this.sandboxes.delete(sessionId);
    return true;
  }

  /**
   * Take a screenshot of the current sandbox display.
   * Returns base64-encoded PNG.
   */
  async screenshot(sessionId: string): Promise<{ screenshot_base64: string; mime_type: string }> {
    const entry = this.getSandboxOrThrow(sessionId);
    this.touchActivity(entry);

    const imageData = await entry.sandbox.screenshot();

    // E2B returns a Uint8Array — convert to base64
    const base64 = Buffer.from(imageData).toString('base64');

    return {
      screenshot_base64: base64,
      mime_type: 'image/png',
    };
  }

  /**
   * Execute a computer use action on the sandbox.
   */
  async executeAction(
    sessionId: string,
    action: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const entry = this.getSandboxOrThrow(sessionId);
    this.touchActivity(entry);

    try {
      switch (action) {
        case 'left_click': {
          const [x, y] = params.coordinate || [0, 0];
          await entry.sandbox.leftClick(x, y);
          break;
        }

        case 'right_click': {
          const [x, y] = params.coordinate || [0, 0];
          await entry.sandbox.rightClick(x, y);
          break;
        }

        case 'middle_click': {
          const [x, y] = params.coordinate || [0, 0];
          await entry.sandbox.middleClick(x, y);
          break;
        }

        case 'double_click': {
          const [x, y] = params.coordinate || [0, 0];
          await entry.sandbox.doubleClick(x, y);
          break;
        }

        case 'triple_click': {
          const [x, y] = params.coordinate || [0, 0];
          await entry.sandbox.leftClick(x, y);
          await entry.sandbox.leftClick(x, y);
          await entry.sandbox.leftClick(x, y);
          break;
        }

        case 'type': {
          await entry.sandbox.write(params.text || '');
          break;
        }

        case 'key': {
          // E2B uses press() for key combos
          await entry.sandbox.press(params.text || '');
          break;
        }

        case 'mouse_move': {
          const [mx, my] = params.coordinate || [0, 0];
          await entry.sandbox.moveMouse(mx, my);
          break;
        }

        case 'scroll': {
          const direction = params.scroll_direction || 'down';
          const amount = params.scroll_amount || 3;
          const scrollX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
          const scrollY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
          await entry.sandbox.scroll(scrollX, scrollY);
          break;
        }

        case 'left_click_drag': {
          const [startX, startY] = params.start_coordinate || params.coordinate || [0, 0];
          const [endX, endY] = params.coordinate || [0, 0];
          await entry.sandbox.drag([
            { x: startX, y: startY },
            { x: endX, y: endY },
          ]);
          break;
        }

        case 'wait': {
          const ms = (params.duration || 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, ms));
          break;
        }

        case 'screenshot': {
          // Handled separately via the screenshot tool
          break;
        }

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Get status info for a sandbox.
   */
  getStatus(sessionId: string): SandboxStatus | null {
    const entry = this.sandboxes.get(sessionId);
    if (!entry) return null;

    const now = Date.now();
    const uptimeSeconds = Math.round((now - entry.createdAt) / 1000);
    const idleSeconds = Math.round((now - entry.lastActivity) / 1000);

    return {
      sandbox_id: entry.sandboxId,
      status: 'running',
      uptime_seconds: uptimeSeconds,
      idle_seconds: idleSeconds,
      estimated_cost_usd: Math.round(uptimeSeconds * COST_PER_SECOND * 10000) / 10000,
    };
  }

  /**
   * Check if a session has an active sandbox.
   */
  hasSandbox(sessionId: string): boolean {
    return this.sandboxes.has(sessionId);
  }

  /**
   * Destroy all active sandboxes. Called on process exit.
   */
  async destroyAll(): Promise<void> {
    const sessions = [...this.sandboxes.keys()];
    await Promise.allSettled(sessions.map(s => this.destroySandbox(s)));
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }

  // --- Internal helpers ---

  private getSandboxOrThrow(sessionId: string): SandboxEntry {
    const entry = this.sandboxes.get(sessionId);
    if (!entry) {
      throw new Error(`No active sandbox for session ${sessionId}. Call computer_sandbox_create first.`);
    }
    return entry;
  }

  private touchActivity(entry: SandboxEntry): void {
    entry.lastActivity = Date.now();
    // Reset idle timer
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(
      () => this.handleIdleTimeout(entry.sandboxId),
      IDLE_TIMEOUT_MS
    );
  }

  private async handleIdleTimeout(sessionIdOrSandboxId: string): Promise<void> {
    // Find by session ID or sandbox ID
    for (const [sessionId, entry] of this.sandboxes) {
      if (sessionId === sessionIdOrSandboxId || entry.sandboxId === sessionIdOrSandboxId) {
        console.error(`[sandbox-manager] Idle timeout for session ${sessionId}, destroying sandbox ${entry.sandboxId}`);
        await this.destroySandbox(sessionId);
        return;
      }
    }
  }

  private checkIdle(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.sandboxes) {
      const idleMs = now - entry.lastActivity;
      if (idleMs > IDLE_TIMEOUT_MS) {
        console.error(`[sandbox-manager] Idle check: session ${sessionId} idle for ${Math.round(idleMs / 1000)}s, destroying`);
        this.destroySandbox(sessionId).catch(() => {});
      }
    }
  }
}

// Singleton instance shared across all MCP tool calls
export const sandboxManager = new SandboxManager();
