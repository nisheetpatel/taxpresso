// The build flag that tells the desktop extension (.mcpb) from the Claude plugin
// (extension/scripts/build-common.mjs, docs/spikes/S4.md).
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CantonRegistry } from '../src/cantons.js';
import { DISTRIBUTION, readConfig } from '../src/config.js';
import { buildStatus, statusText } from '../src/status.js';
import { Workspace } from '../src/workspace.js';

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'taxpresso-dist-'));
  const ws = new Workspace(
    readConfig({ TAXPRESSO_VAULT_PATH: path.join(root, 'Taxpresso') }),
    new CantonRegistry(2026),
  );
  await ws.ready();
  return ws;
}

describe('the distribution flag on the server', () => {
  it('is the .mcpb unless the build says plugin', () => {
    expect(DISTRIBUTION).toBe('mcpb');
  });

  it("get_status's detail names the Claude plugin, and leaves the .mcpb's as it was", async () => {
    const ws = await workspace();
    const plugin = buildStatus(ws, {
      dashboardRunning: false,
      detail: true,
      distribution: 'plugin',
    });
    expect(plugin.runtime?.distribution).toBe('plugin');
    expect(statusText(plugin)).toMatch(/^Runtime: Node v\d+.*, Claude plugin$/m);

    const mcpb = buildStatus(ws, { dashboardRunning: false, detail: true, distribution: 'mcpb' });
    expect(mcpb.runtime).not.toHaveProperty('distribution');
    expect(statusText(mcpb)).not.toMatch(/Claude plugin/);
    expect(buildStatus(ws, { dashboardRunning: false, detail: true }).runtime).toEqual(
      mcpb.runtime,
    );
  });
});
