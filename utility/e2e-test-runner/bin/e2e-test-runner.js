#!/usr/bin/env node

/* eslint-disable no-console */

const path = require('node:path');
const { runCli } = require('../src/cli');

const packageRoot = path.resolve(__dirname, '..');

const exitCode = runCli(process.argv.slice(2), {
    workspaceRoot: process.cwd(),
    defaultSuitesPath: path.join(packageRoot, 'suites.json'),
    defaultConfigPath: path.join(packageRoot, 'playwright.config.js')
});

process.exit(exitCode);
