/**
 * Validate an adapter manifest.json against the expected schema.
 * Used by the CLI `validate` command and the lint-staged hook.
 */

import type { AdapterManifest } from '../types/manifest.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
const REVERSE_DNS_RE = /^[a-z]{2,}(\.[a-z0-9-]+){2,}$/;

export function validateManifest(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: [{ field: 'root', message: 'Manifest must be a JSON object' }] };
  }

  const manifest = raw as Record<string, unknown>;

  // Required string fields
  const requiredStrings: (keyof AdapterManifest)[] = [
    'id',
    'name',
    'version',
    'author',
    'description',
    'homepage',
    'repository',
    'license',
  ];

  for (const field of requiredStrings) {
    if (typeof manifest[field] !== 'string' || (manifest[field] as string).trim() === '') {
      errors.push({ field, message: `"${field}" is required and must be a non-empty string` });
    }
  }

  // ID format: reverse-DNS
  if (typeof manifest['id'] === 'string' && !REVERSE_DNS_RE.test(manifest['id'])) {
    errors.push({
      field: 'id',
      message: 'Must be reverse-DNS format, e.g. "gov.colorado.peak"',
    });
  }

  // Version: semver
  if (typeof manifest['version'] === 'string' && !SEMVER_RE.test(manifest['version'])) {
    errors.push({ field: 'version', message: 'Must be a valid semver string, e.g. "1.0.0"' });
  }

  // Domains: array of valid hostnames
  if (!Array.isArray(manifest['domains']) || manifest['domains'].length === 0) {
    errors.push({ field: 'domains', message: 'Must be a non-empty array of domain strings' });
  } else {
    for (const domain of manifest['domains'] as unknown[]) {
      if (typeof domain !== 'string' || !DOMAIN_RE.test(domain)) {
        errors.push({ field: 'domains', message: `Invalid domain: "${domain}"` });
      }
    }
  }

  // Tools: array with at least one entry
  if (!Array.isArray(manifest['tools']) || manifest['tools'].length === 0) {
    errors.push({ field: 'tools', message: 'Must be a non-empty array of tool summaries' });
  } else {
    for (let i = 0; i < manifest['tools'].length; i++) {
      const tool = manifest['tools'][i] as Record<string, unknown>;
      if (typeof tool['name'] !== 'string' || tool['name'].trim() === '') {
        errors.push({ field: `tools[${i}].name`, message: 'Tool name is required' });
      }
      if (!['read_only', 'write'].includes(tool['securityLevel'] as string)) {
        errors.push({
          field: `tools[${i}].securityLevel`,
          message: 'Must be "read_only" or "write"',
        });
      }
    }
  }

  // Permissions
  const permissions = manifest['permissions'] as Record<string, unknown> | undefined;
  if (!permissions || !Array.isArray(permissions['required'])) {
    errors.push({
      field: 'permissions.required',
      message: 'permissions.required must be an array',
    });
  }

  // Trust level
  const validTrust = ['official', 'verified', 'community'];
  if (!validTrust.includes(manifest['trustLevel'] as string)) {
    errors.push({
      field: 'trustLevel',
      message: `Must be one of: ${validTrust.join(', ')}`,
    });
  }

  // Verified flag must be boolean
  if (typeof manifest['verified'] !== 'boolean') {
    errors.push({ field: 'verified', message: 'Must be a boolean' });
  }

  return { valid: errors.length === 0, errors };
}
