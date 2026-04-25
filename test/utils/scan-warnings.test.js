import { describe, it, expect } from 'vitest';
import { describeScanWarnings } from '../../src/utils/scan-warnings.js';

describe('describeScanWarnings', () => {
  it('returns no warnings for a healthy scan', () => {
    expect(
      describeScanWarnings({
        truncated: false,
        frameworks: ['Next.js'],
      }),
    ).toEqual([]);
  });

  it('warns when the scan was truncated', () => {
    const warnings = describeScanWarnings({
      truncated: true,
      maxFiles: 5000,
      frameworks: ['Next.js'],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('5000');
    expect(warnings[0]).toContain('scan.max_files');
  });

  it('warns about no framework only when includeFrameworkHint is set', () => {
    const without = describeScanWarnings({
      truncated: false,
      frameworks: [],
    });
    expect(without).toEqual([]);

    const withHint = describeScanWarnings(
      { truncated: false, frameworks: [] },
      { includeFrameworkHint: true },
    );
    expect(withHint).toHaveLength(1);
    expect(withHint[0]).toContain('no framework detected');
  });

  it('combines truncation and framework warnings when both apply', () => {
    const warnings = describeScanWarnings(
      { truncated: true, maxFiles: 100, frameworks: [] },
      { includeFrameworkHint: true },
    );
    expect(warnings).toHaveLength(2);
  });

  it('handles a missing scan gracefully', () => {
    expect(describeScanWarnings(undefined)).toEqual([]);
    expect(describeScanWarnings({})).toEqual([]);
  });
});
