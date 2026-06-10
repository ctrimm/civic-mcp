import { describe, it, expect } from 'vitest';
import {
  pluginStorageKey,
  namespacedToolName,
  isUrlAllowed,
  jsonByteSize,
  sanitizeFieldValue,
  formatDuration,
} from './selector-helpers.js';

describe('pluginStorageKey', () => {
  it('namespaces keys by plugin id', () => {
    expect(pluginStorageKey('gov.colorado.peak', 'session')).toBe(
      'civic-mcp:plugin:gov.colorado.peak:session',
    );
  });
});

describe('namespacedToolName', () => {
  it('joins plugin id and tool name', () => {
    expect(namespacedToolName('gov.colorado.peak', 'check_eligibility')).toBe(
      'gov.colorado.peak.check_eligibility',
    );
  });
});

describe('isUrlAllowed', () => {
  it('allows exact hostname matches', () => {
    expect(isUrlAllowed('https://peak.my.site.com/apply', ['peak.my.site.com'])).toBe(true);
  });

  it('rejects other hostnames', () => {
    expect(isUrlAllowed('https://evil.example.com/', ['peak.my.site.com'])).toBe(false);
  });

  it('rejects lookalike suffix hostnames (no endsWith matching)', () => {
    expect(isUrlAllowed('https://evilpeak.my.site.com/', ['peak.my.site.com'])).toBe(false);
    expect(isUrlAllowed('https://notgetcalfresh.org/', ['getcalfresh.org'])).toBe(false);
  });

  it('enforces path prefixes when the domain entry includes one', () => {
    expect(isUrlAllowed('https://colorado.gov/peak/apply', ['colorado.gov/peak'])).toBe(true);
    expect(isUrlAllowed('https://colorado.gov/other', ['colorado.gov/peak'])).toBe(false);
  });

  it('rejects unparseable URLs', () => {
    expect(isUrlAllowed('not a url', ['example.gov'])).toBe(false);
  });
});

describe('jsonByteSize', () => {
  it('measures UTF-8 bytes of the serialized value', () => {
    expect(jsonByteSize('ab')).toBe(4); // "ab" with quotes
    expect(jsonByteSize({ a: 1 })).toBe(7); // {"a":1}
  });
});

describe('sanitizeFieldValue', () => {
  it('strips null bytes and control characters', () => {
    expect(sanitizeFieldValue('ab\x00c\x07d')).toBe('abcd');
  });

  it('preserves tabs, newlines, and carriage returns', () => {
    expect(sanitizeFieldValue('a\tb\nc\rd')).toBe('a\tb\nc\rd');
  });

  it('leaves normal text untouched', () => {
    expect(sanitizeFieldValue('Jane Doe, 123 Main St.')).toBe('Jane Doe, 123 Main St.');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds, seconds, and minutes', () => {
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(90_000)).toBe('1.5m');
  });
});
