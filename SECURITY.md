# Security Policy

## Reporting a Vulnerability

Please **do not open public GitHub issues for security vulnerabilities.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/ctrimm/civic-mcp/security/advisories/new) ("Report a vulnerability" on the Security tab).

You should receive an acknowledgement within 7 days. Please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected package(s) and version(s)

## Scope

Reports are especially welcome for:

- **Adapter sandbox escapes** — an adapter reading data outside its scoped storage, navigating outside its declared domains, or accessing APIs it shouldn't
- **PII exposure** — applicant data (SSN digits, DOB, income, addresses) leaking into logs, caches, telemetry, or tool output where it shouldn't be
- **Identity store weaknesses** — flaws in how `~/.civic-mcp/identities/` material is stored or protected
- **Registry integrity** — ways a malicious adapter could be installed while appearing trusted

## Supported Versions

This project is pre-release (`0.x`). Only the latest `main` is supported; there are no security backports.

## Threat Model Notes

civic-mcp drives real government websites with real personal data. Until a formal audit exists, assume:

- Adapters are **not** strongly isolated from the page they run on (see `CONCERNS.md` §2)
- The on-disk identity store protects data with OS keychain-held keys and file permissions, **not** hardware-backed encryption
- Trust levels in the registry are self-declared; no adapter has been independently verified yet
