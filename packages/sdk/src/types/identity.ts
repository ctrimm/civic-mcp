/**
 * Portable identity — a named, on-disk bundle of everything needed to act
 * on someone's behalf across government sites:
 *
 *   ~/.civic-mcp/identities/<name>/
 *   ├── browser-profile/    Chromium user-data dir (cookies, logins, localStorage)
 *   ├── profile.json.enc    Encrypted applicant profile (this schema)
 *   └── storage/            Adapter-scoped key/value storage
 *
 * The layout is a documented contract: any Chromium-driving tool (Playwright,
 * Puppeteer, plain Chrome with --user-data-dir) can mount the same
 * browser-profile/ directory, and any program can read the applicant profile
 * if the user grants it access to the decryption key.
 *
 * This is deliberate, user-owned PII storage — adapters use it to prefill
 * forms so applicants don't have to repeat themselves for every agency.
 */

export interface ApplicantAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ApplicantHouseholdMember {
  firstName?: string;
  lastName?: string;
  relationship?: string;
  dateOfBirth?: string; // ISO 8601 date
}

export interface ApplicantHousehold {
  /** Total number of people in the household, including the applicant */
  size?: number;
  hasElderlyMember?: boolean;
  hasDisabledMember?: boolean;
  members?: ApplicantHouseholdMember[];
}

export interface ApplicantIncome {
  /** Total monthly gross income in dollars, before taxes */
  monthlyGross?: number;
  monthlyRent?: number;
  monthlyUtilities?: number;
  monthlyChildCare?: number;
  monthlyMedicalCosts?: number;
}

export interface ApplicantProfile {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO 8601 date
  /**
   * Last 4 digits of SSN only. Full SSNs must never be stored —
   * adapters that need one must ask the human via waitForHuman().
   */
  ssnLast4?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  address?: ApplicantAddress;
  household?: ApplicantHousehold;
  income?: ApplicantIncome;
  /** Free-form adapter-readable extras, keyed by adapter id */
  extra?: Record<string, Record<string, unknown>>;
}

/**
 * Read-only identity access exposed to adapters via SandboxContext.
 * Writing the profile is reserved for the host (MCP server tools / UI),
 * so a misbehaving adapter cannot poison the shared profile.
 */
export interface IdentityAPI {
  /** Name of the active identity (e.g. "default", "mom") */
  name(): string;
  /** The applicant profile, or null if none has been saved */
  getProfile(): Promise<ApplicantProfile | null>;
}
