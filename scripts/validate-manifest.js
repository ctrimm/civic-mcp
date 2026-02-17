#!/usr/bin/env node
/**
 * scripts/validate-manifest.js
 *
 * Validates one or more adapter manifest.json files.
 * Called by lint-staged on every commit that touches adapters/*/manifest.json.
 *
 * Usage:
 *   node scripts/validate-manifest.js adapters/gov.colorado.peak/manifest.json [...]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
const REVERSE_DNS_RE = /^[a-z]{2,}(\.[a-z0-9-]+){2,}$/;

const VALID_TRUST = ['official', 'verified', 'community'];
const VALID_SECURITY = ['read_only', 'write'];
const VALID_PERMS = ['read:forms', 'write:forms', 'storage:local', 'notifications', 'navigate'];

function validateManifest(raw) {
  const errors = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return [{ field: 'root', message: 'Manifest must be a JSON object' }];
  }

  const required = ['id', 'name', 'version', 'author', 'description', 'homepage', 'repository', 'license'];
  for (const field of required) {
    if (typeof raw[field] !== 'string' || raw[field].trim() === '') {
      errors.push({ field, message: `"${field}" is required and must be a non-empty string` });
    }
  }

  if (typeof raw.id === 'string' && !REVERSE_DNS_RE.test(raw.id)) {
    errors.push({ field: 'id', message: 'Must be reverse-DNS format, e.g. "gov.colorado.peak"' });
  }

  if (typeof raw.version === 'string' && !SEMVER_RE.test(raw.version)) {
    errors.push({ field: 'version', message: 'Must be a valid semver string, e.g. "1.0.0"' });
  }

  if (!Array.isArray(raw.domains) || raw.domains.length === 0) {
    errors.push({ field: 'domains', message: 'Must be a non-empty array of domain strings' });
  } else {
    raw.domains.forEach((d, i) => {
      if (typeof d !== 'string' || !DOMAIN_RE.test(d)) {
        errors.push({ field: `domains[${i}]`, message: `Invalid domain: "${d}"` });
      }
    });
  }

  if (!Array.isArray(raw.tools) || raw.tools.length === 0) {
    errors.push({ field: 'tools', message: 'Must be a non-empty array of tool summaries' });
  } else {
    raw.tools.forEach((t, i) => {
      if (!t.name) errors.push({ field: `tools[${i}].name`, message: 'Required' });
      if (!VALID_SECURITY.includes(t.securityLevel)) {
        errors.push({ field: `tools[${i}].securityLevel`, message: `Must be one of: ${VALID_SECURITY.join(', ')}` });
      }
    });
  }

  if (!raw.permissions || !Array.isArray(raw.permissions.required)) {
    errors.push({ field: 'permissions.required', message: 'Must be an array' });
  } else {
    raw.permissions.required.forEach((p, i) => {
      if (!VALID_PERMS.includes(p)) {
        errors.push({ field: `permissions.required[${i}]`, message: `Unknown permission: "${p}"` });
      }
    });
  }

  if (!VALID_TRUST.includes(raw.trustLevel)) {
    errors.push({ field: 'trustLevel', message: `Must be one of: ${VALID_TRUST.join(', ')}` });
  }

  if (typeof raw.verified !== 'boolean') {
    errors.push({ field: 'verified', message: 'Must be a boolean' });
  }

  return errors;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: validate-manifest.js <manifest.json> [...]');
  process.exit(1);
}

let anyErrors = false;

for (const file of files) {
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`NOT FOUND: ${file}`);
    anyErrors = true;
    continue;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    console.error(`INVALID JSON: ${file}\n  ${err.message}`);
    anyErrors = true;
    continue;
  }

  const errors = validateManifest(raw);
  if (errors.length === 0) {
    console.log(`  PASS  ${file}`);
  } else {
    console.error(`  FAIL  ${file}`);
    for (const { field, message } of errors) {
      console.error(`        ${field}: ${message}`);
    }
    anyErrors = true;
  }
}

process.exit(anyErrors ? 1 : 0);
