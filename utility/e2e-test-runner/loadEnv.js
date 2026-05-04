/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(contents) {
    return contents.split(/\r?\n/).reduce((variables, rawLine) => {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
            return variables;
        }

        const separatorIndex = line.indexOf('=');

        if (separatorIndex <= 0) {
            return variables;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        variables[key] = value.replace(/^(["'])(.*)\1$/, '$2');

        return variables;
    }, {});
}

function loadEnvFile(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    const variables = parseEnvFile(contents);

    Object.entries(variables).forEach(([key, value]) => {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    });
}

function loadE2EEnv() {
    const envName = process.env.E2E_ENV ?? 'local';
    const explicitEnvFile = process.env.E2E_ENV_FILE
        ? path.resolve(process.cwd(), process.env.E2E_ENV_FILE)
        : undefined;
    const defaultProfile = path.resolve(__dirname, `.env.${envName}`);
    const fallbackProfile = path.resolve(__dirname, '.env');
    const candidates = [explicitEnvFile, defaultProfile, fallbackProfile].filter(Boolean);
    const envFile = candidates.find((candidate) => fs.existsSync(candidate));

    if (envFile) {
        loadEnvFile(envFile);
    }

    return { envName, envFile };
}

export { loadE2EEnv };
