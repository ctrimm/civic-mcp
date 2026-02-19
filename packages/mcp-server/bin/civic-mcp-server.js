#!/usr/bin/env node
// Thin shim: re-executes this process under tsx so TypeScript source is
// loaded directly — no compilation step required.
// When deployed as a compiled npm package, replace this with the built index.js.

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry     = resolve(__dirname, '../src/index.ts');

const child = spawn(
  process.execPath,
  ['--import', 'tsx', entry],
  { stdio: 'inherit', env: process.env },
);

child.on('exit', (code) => process.exit(code ?? 0));
