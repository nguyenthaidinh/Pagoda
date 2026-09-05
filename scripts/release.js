#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(root, 'package.json');
const packageLockPath = path.join(root, 'package-lock.json');
const chartPath = path.join(root, 'chart', 'Chart.yaml');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function nextVersion(current, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`Unsupported version: ${current}`);

  const [, majorText, minorText, patchText] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);

  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function updateChart(source, appVersion) {
  let chartVersionUpdated = false;
  let appVersionUpdated = false;

  const result = source
    .replace(/^version:\s*(\d+)\.(\d+)\.(\d+)\s*$/m, (_, a, b, c) => {
      chartVersionUpdated = true;
      return `version: ${a}.${b}.${Number(c) + 1}`;
    })
    .replace(/^appVersion:\s*['"]?[^'"\r\n]+['"]?\s*$/m, () => {
      appVersionUpdated = true;
      return `appVersion: '${appVersion}'`;
    });

  if (!chartVersionUpdated || !appVersionUpdated) {
    throw new Error('Could not update chart/Chart.yaml versions');
  }
  return result;
}

function main() {
  const type = process.argv[2] || 'patch';
  if (!['major', 'minor', 'patch'].includes(type)) {
    throw new Error('Version type must be major, minor, or patch');
  }

  const packageJson = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);
  const version = nextVersion(packageJson.version, type);

  packageJson.version = version;
  packageLock.version = version;
  if (packageLock.packages?.['']) packageLock.packages[''].version = version;

  const chart = updateChart(fs.readFileSync(chartPath, 'utf8'), version);
  writeJson(packageJsonPath, packageJson);
  writeJson(packageLockPath, packageLock);
  fs.writeFileSync(chartPath, chart);

  console.log(`Prepared PagodaPDF v${version}.`);
  console.log('Review the changed files, run checks, then commit and tag manually.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
