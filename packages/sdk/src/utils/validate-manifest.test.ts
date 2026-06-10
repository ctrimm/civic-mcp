import { describe, it, expect } from 'vitest';
import { validateManifest } from './validate-manifest.js';

function validManifest() {
  return {
    id: 'gov.example.portal',
    name: 'Example Portal',
    version: '0.1.0',
    author: 'civic-mcp contributors',
    description: 'Test manifest',
    homepage: 'https://portal.example.gov',
    repository: 'https://github.com/ctrimm/civic-mcp',
    license: 'MIT',
    domains: ['portal.example.gov'],
    tools: [{ name: 'check_status', securityLevel: 'read_only' }],
    permissions: { required: ['read:forms'] },
    trustLevel: 'community',
    verified: false,
  };
}

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest(validManifest());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest([]).valid).toBe(false);
    expect(validateManifest('{}').valid).toBe(false);
  });

  it('requires non-empty string fields', () => {
    const m = { ...validManifest(), name: '' };
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('enforces reverse-DNS adapter ids', () => {
    const result = validateManifest({ ...validManifest(), id: 'my-adapter' });
    expect(result.errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('enforces semver versions', () => {
    const result = validateManifest({ ...validManifest(), version: 'v1' });
    expect(result.errors.some((e) => e.field === 'version')).toBe(true);
  });

  it('requires at least one domain and valid domain syntax', () => {
    expect(validateManifest({ ...validManifest(), domains: [] }).valid).toBe(false);
    expect(validateManifest({ ...validManifest(), domains: ['not a domain'] }).valid).toBe(false);
  });

  it('requires each tool to declare a securityLevel of read_only or write', () => {
    const m = { ...validManifest(), tools: [{ name: 'do_thing', securityLevel: 'admin' }] };
    const result = validateManifest(m);
    expect(result.errors.some((e) => e.field === 'tools[0].securityLevel')).toBe(true);
  });

  it('rejects unknown trust levels', () => {
    const result = validateManifest({ ...validManifest(), trustLevel: 'platinum' });
    expect(result.errors.some((e) => e.field === 'trustLevel')).toBe(true);
  });
});
