/**
 * Registry types — the shape of registry/registry.json and registry/verified.json.
 */

import type { TrustLevel } from './manifest.js';

// ---------------------------------------------------------------------------
// registry.json
// ---------------------------------------------------------------------------

export type PluginCategory =
  | 'state_benefits'
  | 'federal'
  | 'local_government'
  | 'healthcare'
  | 'housing'
  | 'employment'
  | 'education';

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  category: PluginCategory;
  tags: string[];
  trustLevel: TrustLevel;
  verified: boolean;
  /** URL to download the plugin zip from the registry releases */
  downloadUrl: string;
  /** Raw URL to the manifest.json for metadata fetching */
  manifestUrl: string;
  /** ISO 8601 date of last update */
  updatedAt: string;
  installs: number;
  rating: number;
  /** Which US state this adapter covers, if applicable. Two-letter code. */
  state?: string;
  /** Which federal agency, if applicable */
  agency?: string;
}

export interface CategoryMeta {
  id: PluginCategory;
  name: string;
  count: number;
}

export interface RegistryIndex {
  version: string;
  updatedAt: string; // ISO 8601
  plugins: RegistryEntry[];
  categories: CategoryMeta[];
}

// ---------------------------------------------------------------------------
// verified.json
// ---------------------------------------------------------------------------

export interface VerifiedPublisher {
  name: string;
  url: string;
  /** GPG key fingerprint or GitHub username used for signing */
  signingKey: string;
  verifiedAt: string; // ISO 8601
  type: 'civic_tech' | 'government' | 'nonprofit' | 'academic';
}

export interface VerifiedRegistry {
  version: string;
  updatedAt: string;
  publishers: VerifiedPublisher[];
}
