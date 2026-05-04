#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('node:path');
const { runCli } = require('../tools/playwright-subset-runner/src/cli');

const packageRoot = path.resolve(__dirname, '..', 'tools', 'playwright-subset-runner');

const exitCode = runCli(process.argv.slice(2), {
    workspaceRoot: path.resolve(__dirname, '..'),
    defaultSuitesPath: path.join(packageRoot, 'suites.json'),
    defaultConfigPath: path.join(packageRoot, 'playwright.config.js')
});

process.exit(exitCode);
