/**
 * Portable identity store.
 *
 * Layout (a documented contract — other tools may mount these paths):
 *
 *   ~/.civic-mcp/identities/<name>/
 *   ├── README.txt          warning about sensitive contents
 *   ├── browser-profile/    Chromium user-data dir — point Playwright,
 *   │                       Puppeteer, or `chrome --user-data-dir` at it
 *   ├── profile.json.enc    applicant profile, AES-256-GCM encrypted with a
 *   │                       key held in the OS keychain (service "civic-mcp")
 *   └── storage/            adapter-scoped key/value storage
 *
 * Select the active identity with CIVIC_MCP_IDENTITY (default: "default").
 *
 * Encryption: a random 256-bit key per identity is created on first use and
 * stored in the OS keychain (macOS Keychain, Windows Credential Manager,
 * libsecret on Linux) via @napi-rs/keyring. On systems without a usable
 * keychain (e.g. headless Linux without dbus), profile storage is refused
 * unless CIVIC_MCP_INSECURE_STORE=1, which stores plaintext with 0600 perms
 * and a loud warning.
 */

import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { ApplicantProfile, IdentityAPI } from '@civic-mcp/sdk';

const KEYCHAIN_SERVICE = 'civic-mcp';
const INSECURE_STORE = process.env['CIVIC_MCP_INSECURE_STORE'] === '1';

export interface Identity {
  name: string;
  dir: string;
  browserProfileDir: string;
  storageDir: string;
}

const IDENTITY_README = `This directory is a civic-mcp portable identity.

It contains SENSITIVE PERSONAL DATA:
  browser-profile/   logged-in sessions (cookies) for government websites
  profile.json.enc   the applicant profile (name, DOB, address, income, ...)
  storage/           per-adapter cached data

Do not commit, sync, or share this directory.
The profile decryption key lives in your OS keychain under service "civic-mcp".
`;

/** Validate and resolve the active identity, creating its directories. */
export async function resolveIdentity(name?: string): Promise<Identity> {
  const id = name ?? process.env['CIVIC_MCP_IDENTITY'] ?? 'default';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) {
    throw new Error(
      `Invalid identity name "${id}" — use letters, digits, dots, dashes, underscores`,
    );
  }

  const dir = join(homedir(), '.civic-mcp', 'identities', id);
  const browserProfileDir = join(dir, 'browser-profile');
  const storageDir = join(dir, 'storage');

  await mkdir(browserProfileDir, { recursive: true, mode: 0o700 });
  await mkdir(storageDir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  await writeFile(join(dir, 'README.txt'), IDENTITY_README, { mode: 0o600 });

  return { name: id, dir, browserProfileDir, storageDir };
}

// ---------------------------------------------------------------------------
// Encryption key management (OS keychain)
// ---------------------------------------------------------------------------

interface KeyringEntryLike {
  getPassword(): string | null;
  setPassword(password: string): void;
}

async function keychainEntry(identityName: string): Promise<KeyringEntryLike | null> {
  try {
    const { Entry } = await import('@napi-rs/keyring');
    return new Entry(KEYCHAIN_SERVICE, `identity:${identityName}`);
  } catch {
    return null; // module unavailable on this platform
  }
}

/**
 * Fetch (or create on first use) the identity's 256-bit encryption key.
 * Returns null when no OS keychain is usable.
 */
async function getOrCreateKey(identityName: string): Promise<Buffer | null> {
  const entry = await keychainEntry(identityName);
  if (!entry) return null;

  try {
    const existing = entry.getPassword();
    if (existing) return Buffer.from(existing, 'base64');

    const key = randomBytes(32);
    entry.setPassword(key.toString('base64'));
    return key;
  } catch {
    // Keychain backend not usable (e.g. headless Linux without dbus/libsecret)
    return null;
  }
}

// ---------------------------------------------------------------------------
// Applicant profile (encrypted at rest)
// ---------------------------------------------------------------------------

const ENC_FILE = 'profile.json.enc';
const PLAIN_FILE = 'profile.json'; // insecure fallback only

interface EncryptedBlob {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string; // base64
  tag: string; // base64
  data: string; // base64 ciphertext
}

function encrypt(key: Buffer, plaintext: string): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(key: Buffer, blob: EncryptedBlob): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function loadApplicantProfile(identity: Identity): Promise<ApplicantProfile | null> {
  // Encrypted file first
  try {
    const raw = await readFile(join(identity.dir, ENC_FILE), 'utf8');
    const blob = JSON.parse(raw) as EncryptedBlob;
    const key = await getOrCreateKey(identity.name);
    if (!key) {
      throw new Error(
        `Identity "${identity.name}" has an encrypted profile but no usable OS keychain ` +
          `was found to decrypt it on this machine.`,
      );
    }
    return JSON.parse(decrypt(key, blob)) as ApplicantProfile;
  } catch (err) {
    if ((err as { code?: string }).code !== 'ENOENT') throw err;
  }

  // Insecure plaintext fallback (only if explicitly enabled)
  if (INSECURE_STORE) {
    try {
      const raw = await readFile(join(identity.dir, PLAIN_FILE), 'utf8');
      return JSON.parse(raw) as ApplicantProfile;
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
  }

  return null;
}

export async function saveApplicantProfile(
  identity: Identity,
  profile: ApplicantProfile,
): Promise<void> {
  // Refuse to ever store a full SSN, regardless of where the caller put it
  const serialized = JSON.stringify(profile);
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(serialized) || /"ssn"\s*:/.test(serialized)) {
    throw new Error(
      'Refusing to store what looks like a full SSN. Only ssnLast4 may be saved; ' +
        'full SSNs must be entered by the human directly (use waitForHuman).',
    );
  }

  const key = await getOrCreateKey(identity.name);

  if (key) {
    const blob = encrypt(key, serialized);
    const path = join(identity.dir, ENC_FILE);
    await writeFile(path, JSON.stringify(blob), { mode: 0o600 });
    await chmod(path, 0o600);
    return;
  }

  if (INSECURE_STORE) {
    process.stderr.write(
      `[civic-mcp] WARNING: no OS keychain available — storing applicant profile ` +
        `UNENCRYPTED at ${join(identity.dir, PLAIN_FILE)} (CIVIC_MCP_INSECURE_STORE=1)\n`,
    );
    const path = join(identity.dir, PLAIN_FILE);
    await writeFile(path, serialized, { mode: 0o600 });
    await chmod(path, 0o600);
    return;
  }

  throw new Error(
    'No usable OS keychain found (on Linux this requires libsecret + a running ' +
      'secret service). The applicant profile was NOT saved. To store it unencrypted ' +
      'anyway — protected only by file permissions — restart the server with ' +
      'CIVIC_MCP_INSECURE_STORE=1.',
  );
}

// ---------------------------------------------------------------------------
// Adapter-facing read-only API
// ---------------------------------------------------------------------------

export function makeIdentityAPI(identity: Identity): IdentityAPI {
  return {
    name: () => identity.name,
    getProfile: () => loadApplicantProfile(identity),
  };
}
