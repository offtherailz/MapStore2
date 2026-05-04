#!/usr/bin/env node

/* eslint-disable no-console */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

const exitCode = runCli(process.argv.slice(2), {
    workspaceRoot: process.cwd(),
    defaultSuitesPath: path.join(packageRoot, 'suites.json'),
    defaultConfigPath: path.join(packageRoot, 'playwright.config.js')
});

process.exit(exitCode);
