import { describe, it, expect } from 'vitest';
import { compactScan } from '../../src/utils/scan-projection.js';

function fakeScan({ componentCount = 0, fileCount = 0 } = {}) {
  return {
    files: Array.from({ length: fileCount }, (_, i) => `src/file${i}.ts`),
    frameworks: ['Next.js'],
    orms: ['Prisma'],
    routes: [{ method: 'GET', path: '/x', file: 'app/x/page.tsx' }],
    components: Array.from({ length: componentCount }, (_, i) => ({
      name: `C${i}`,
      file: `src/components/C${i}.tsx`,
    })),
    models: [{ name: 'User', file: 'prisma/schema.prisma', fields: ['id'] }],
  };
}

describe('compactScan', () => {
  it('keeps frameworks, orms, routes, models intact', () => {
    const scan = fakeScan();
    const out = compactScan(scan);
    expect(out.frameworks).toEqual(['Next.js']);
    expect(out.orms).toEqual(['Prisma']);
    expect(out.routes).toEqual(scan.routes);
    expect(out.models).toEqual(scan.models);
  });

  it('caps components at 50 (oversized inputs)', () => {
    const out = compactScan(fakeScan({ componentCount: 75 }));
    expect(out.components).toHaveLength(50);
    expect(out.components[0].name).toBe('C0');
    expect(out.components[49].name).toBe('C49');
  });

  it('caps sample files at 30 and exposes the full count', () => {
    const out = compactScan(fakeScan({ fileCount: 100 }));
    expect(out.fileCount).toBe(100);
    expect(out.sampleFiles).toHaveLength(30);
    expect(out.sampleFiles[0]).toBe('src/file0.ts');
    expect(out.sampleFiles[29]).toBe('src/file29.ts');
  });

  it('passes through unchanged when inputs are already under the caps', () => {
    const out = compactScan(fakeScan({ componentCount: 5, fileCount: 10 }));
    expect(out.components).toHaveLength(5);
    expect(out.fileCount).toBe(10);
    expect(out.sampleFiles).toHaveLength(10);
  });
});
