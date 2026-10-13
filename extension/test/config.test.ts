import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultVaultPath, displayPath, readConfig } from '../src/config.js';

describe('readConfig', () => {
  it('uses the defaults when Claude Desktop leaves a placeholder unsubstituted', () => {
    const config = readConfig({
      TAXPRESSO_VAULT_PATH: '${user_config.vault_path}',
      TAXPRESSO_UI_LANGUAGE: '${user_config.ui_language}',
    });
    expect(config.vaultPath).toBe(defaultVaultPath());
    expect(config.uiLanguage).toBe('en');
    expect(config.taxYear).toBe(2026);
  });

  it('accepts a supported language in any case and ignores others', () => {
    expect(readConfig({ TAXPRESSO_UI_LANGUAGE: 'FR' }).uiLanguage).toBe('fr');
    expect(readConfig({ TAXPRESSO_UI_LANGUAGE: 'de' }).uiLanguage).toBe('en');
  });

  it('shows paths under the home folder with ~', () => {
    expect(displayPath(path.join(os.homedir(), 'Documents', 'Taxpresso'))).toBe(
      `~${path.sep}Documents${path.sep}Taxpresso`,
    );
  });
});
