import { describe, it, expect } from 'vitest';
import { filterScanForFlow } from '../../src/utils/flow-filter.js';

const SAMPLE = {
  files: ['src/checkout/index.ts', 'src/auth/login.ts'],
  routes: [
    { method: 'POST', path: '/checkout', file: 'src/checkout/index.ts' },
    { method: 'POST', path: '/login', file: 'src/auth/login.ts' },
  ],
  components: [
    { name: 'CheckoutForm', file: 'src/checkout/Form.tsx' },
    { name: 'LoginPage', file: 'src/auth/Login.tsx' },
  ],
  models: [
    { name: 'Cart', file: 'prisma/schema.prisma', fields: ['id'] },
    { name: 'User', file: 'prisma/schema.prisma', fields: ['id'] },
  ],
};

describe('filterScanForFlow', () => {
  it('keeps only items matching the flow tokens', () => {
    const out = filterScanForFlow(SAMPLE, 'checkout');
    expect(out.routes.map((r) => r.path)).toEqual(['/checkout']);
    expect(out.components.map((c) => c.name)).toEqual(['CheckoutForm']);
    // No model with "checkout" matches; falls back to original (Cart, User).
    expect(out.models).toHaveLength(2);
    expect(out.flowFilter.tokens).toEqual(['checkout']);
  });

  it('matches by file path too', () => {
    const out = filterScanForFlow(SAMPLE, 'auth');
    expect(out.routes.map((r) => r.path)).toEqual(['/login']);
    expect(out.components.map((c) => c.name)).toEqual(['LoginPage']);
  });

  it('handles multi-word flows and case-insensitive matching', () => {
    const out = filterScanForFlow(SAMPLE, 'User Login');
    const routes = out.routes.map((r) => r.path);
    expect(routes).toContain('/login');
    expect(out.components.some((c) => c.name === 'LoginPage')).toBe(true);
  });

  it('falls back to the unfiltered category when filtering wipes it', () => {
    const out = filterScanForFlow(SAMPLE, 'nonexistent-flow-name');
    // No matches at all, so each non-empty category falls back to the original.
    expect(out.routes).toHaveLength(2);
    expect(out.components).toHaveLength(2);
    expect(out.models).toHaveLength(2);
  });

  it('returns the scan unchanged when flow has no usable tokens', () => {
    const out = filterScanForFlow(SAMPLE, '!!');
    expect(out).toBe(SAMPLE);
  });

  it('returns the scan unchanged when flow is empty', () => {
    expect(filterScanForFlow(SAMPLE, '')).toBe(SAMPLE);
    expect(filterScanForFlow(SAMPLE, undefined)).toBe(SAMPLE);
  });

  it('passes through when scan is null', () => {
    expect(filterScanForFlow(null, 'checkout')).toBe(null);
  });
});
