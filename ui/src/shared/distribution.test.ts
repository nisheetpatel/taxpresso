import { describe, expect, it } from 'vitest';
import { DISTRIBUTION, showsDonationMenu } from './distribution';

describe('the distribution flag', () => {
  it('is the .mcpb unless a build says plugin', () => {
    expect(DISTRIBUTION).toBe('mcpb');
  });

  it('shows the donation menu in the .mcpb only, never in the Claude plugin', () => {
    expect(showsDonationMenu('mcpb')).toBe(true);
    expect(showsDonationMenu('plugin')).toBe(false);
    expect(showsDonationMenu()).toBe(true);
  });
});
