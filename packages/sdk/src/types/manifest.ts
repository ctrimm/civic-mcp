/**
 * Adapter manifest — the source of truth for a plugin's identity,
 * capabilities, and trust metadata. Lives at adapters/<id>/manifest.json.
 */

export type TrustLevel = 'official' | 'verified' | 'community';

export type PermissionId =
  | 'read:forms'
  | 'write:forms'
  | 'storage:local'
  | 'notifications'
  | 'navigate';

export interface ToolSummary {
  /** Matches the `name` field in the full ToolDefinition */
  name: string;
  /** Whether the tool only reads data or also mutates state */
  securityLevel: 'read_only' | 'write';
  /** Human-readable category label */
  category: 'application' | 'eligibility' | 'status' | 'documents' | 'info';
}

export interface AdapterPermissions {
  required: PermissionId[];
  optional?: PermissionId[];
}

export interface AdapterStatistics {
  installs: number;
  rating: number;
  lastUpdated: string; // ISO 8601 date string
}

export interface AdapterSignature {
  /** SHA-256 fingerprint of the adapter bundle */
  signature: string;
  signer: string;
  signedAt: string; // ISO 8601
  verified: boolean;
}

export interface AdapterManifest {
  /** Reverse-DNS style unique ID. e.g. "gov.colorado.peak" */
  id: string;
  name: string;
  version: string; // semver
  author: string;
  authorUrl?: string;
  description: string;
  homepage: string;
  repository: string;
  license: string;
  icon?: string; // relative path to icon file

  /** Hostnames this adapter is permitted to interact with */
  domains: string[];

  /** Summary list of tools this adapter exposes */
  tools: ToolSummary[];

  permissions: AdapterPermissions;

  /** Whether the adapter is purely declarative JSON (no JS execution) */
  declarative?: boolean;

  trustLevel: TrustLevel;
  verified: boolean;
  officialPartner?: string;

  /** Code-signing info — required for verified and official plugins */
  signature?: AdapterSignature;

  statistics?: AdapterStatistics;

  /** Minimum civic-mcp core extension version required */
  minCoreVersion?: string;
}
