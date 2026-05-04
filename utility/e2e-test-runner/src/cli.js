/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
    const options = {
        subset: '',
        grep: '',
        project: '',
        headed: false,
        ui: false,
        list: false,
        help: false,
        listSuites: false,
        suitesPath: '',
        configPath: '',
        passThrough: []
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--suites') {
            options.subset = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--grep') {
            options.grep = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--project') {
            options.project = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--suites-file') {
            options.suitesPath = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--config') {
            options.configPath = argv[index + 1] || '';
            index += 1;
            continue;
        }

        if (arg === '--headed') {
            options.headed = true;
            continue;
        }

        if (arg === '--ui') {
            options.ui = true;
            continue;
        }

        if (arg === '--list') {
            options.list = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--list-suites') {
            options.listSuites = true;
            continue;
        }

        options.passThrough.push(arg);
    }

    return options;
}

function usage() {
    console.log('Usage: e2e-test-runner [--suites auth,smoke] [--project chromium] [--headed] [--ui] [--grep "text"] [--list] [--suites-file path] [--config path] [extra playwright args]');
    console.log('Example: e2e-test-runner --suites auth --project chromium');
    console.log('Example: E2E_ENV=qa e2e-test-runner --suites smoke --headed');
    console.log('Default: without --suites it runs preconfigured default/active suites');
    console.log('List suites: e2e-test-runner --list-suites');
}

function fail(message) {
    console.error(`Error: ${message}`);
    return 1;
}

function loadSuites(absoluteSuitesPath) {
    if (!fs.existsSync(absoluteSuitesPath)) {
        return { suites: {} };
    }

    const content = fs.readFileSync(absoluteSuitesPath, 'utf8');
    return JSON.parse(content);
}

function parseSubsetList(subsetValue) {
    return (subsetValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function getDefaultSuiteNames(suitesConfig) {
    const suites = suitesConfig.suites || {};
    const configuredDefaults = Array.isArray(suitesConfig.defaults) ? suitesConfig.defaults : [];

    if (configuredDefaults.length) {
        return configuredDefaults;
    }

    const activeDefaults = Object.entries(suites)
        .filter(([, suite]) => Boolean(suite && suite.active))
        .map(([name]) => name);

    if (activeDefaults.length) {
        return activeDefaults;
    }

    return Object.keys(suites);
}

function runCli(argv, runtime = {}) {
    const workspaceRoot = runtime.workspaceRoot || process.cwd();
    const defaultSuitesPath = runtime.defaultSuitesPath || path.join('e2e', 'suites.json');
    const defaultConfigPath = runtime.defaultConfigPath || path.join('e2e', 'playwright.config.ts');
    const options = parseArgs(argv);
    const suitesPath = options.suitesPath || defaultSuitesPath;
    const configPath = options.configPath || defaultConfigPath;
    const absoluteSuitesPath = path.resolve(workspaceRoot, suitesPath);
    const absoluteConfigPath = path.resolve(workspaceRoot, configPath);
    const suitesConfig = loadSuites(absoluteSuitesPath);

    if (options.help) {
        usage();
        return 0;
    }

    if (options.listSuites) {
        const suites = suitesConfig.suites || {};
        const names = Object.keys(suites);

        if (!names.length) {
            console.log('No suites configured.');
            return 0;
        }

        names.forEach((name) => {
            const suite = suites[name];
            const title = suite?.title || '(no title)';
            const why = suite?.why || '(no description)';
            const active = suite?.active ? ' [active]' : '';
            console.log(`- ${name}: ${title}`);
            console.log(`  ${why}`);
            if (active) {
                console.log(`  default: yes${active}`);
            }
        });

        return 0;
    }

    const suites = suitesConfig.suites || {};
    const requestedSuites = parseSubsetList(options.subset);
    const selectedSuiteNames = requestedSuites.length ? requestedSuites : getDefaultSuiteNames(suitesConfig);

    if (!selectedSuiteNames.length) {
        usage();
        return fail(`No suites available in ${suitesPath}`);
    }

    const unknownSuites = selectedSuiteNames.filter((name) => !suites[name]);
    if (unknownSuites.length) {
        const available = Object.keys(suites);
        return fail(`Unknown suites: ${unknownSuites.join(', ')}. Available suites: ${available.join(', ') || '(none)'}`);
    }

    const selectedSuites = selectedSuiteNames.map((name) => ({ name, suite: suites[name] }));
    const suitesDir = path.dirname(absoluteSuitesPath);
    const files = [...new Set(selectedSuites.flatMap(({ suite }) => (Array.isArray(suite.files) ? suite.files.map((f) => path.resolve(suitesDir, f)) : [])))];

    if (!files.length) {
        return fail(`Selected suites have no files configured in ${suitesPath}`);
    }

    const missingFiles = files.filter((file) => !fs.existsSync(file));
    if (missingFiles.length) {
        return fail(`Suite references missing files: ${missingFiles.join(', ')}`);
    }

    if (!fs.existsSync(absoluteConfigPath)) {
        return fail(`Playwright config file not found: ${configPath}`);
    }

    console.log(`Suites: ${selectedSuiteNames.join(', ')}`);
    selectedSuites.forEach(({ name, suite }) => {
        const title = suite?.title || '(no title)';
        const why = suite?.why || '(no description)';
        console.log(`- ${name}: ${title}`);
        console.log(`  ${why}`);
    });
    console.log(`Files: ${files.join(', ')}`);

    const args = ['playwright', 'test', '--config', absoluteConfigPath, ...files];

    if (!options.grep) {
        const suiteGreps = selectedSuites
            .map(({ suite }) => suite?.grep)
            .filter(Boolean);

        if (suiteGreps.length && suiteGreps.length === selectedSuites.length) {
            const combinedGrep = suiteGreps
                .map((pattern) => `(${pattern})`)
                .join('|');
            args.push('-g', combinedGrep);
        }
    }

    if (options.grep) {
        args.push('-g', options.grep);
    }

    if (options.project) {
        args.push('--project', options.project);
    }

    if (options.headed) {
        args.push('--headed');
    }

    if (options.ui) {
        args.push('--ui');
    }

    if (options.list) {
        args.push('--list');
    }

    args.push(...options.passThrough);

    const result = spawnSync('npx', args, {
        cwd: workspaceRoot,
        stdio: 'inherit',
        env: process.env
    });

    if (result.error) {
        return fail(result.error.message);
    }

    return result.status ?? 1;
}

export { runCli };
