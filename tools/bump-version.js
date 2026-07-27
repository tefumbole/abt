#!/usr/bin/env node
/**
 * Increment ERP patch version (ABT_ERP_V.x.y.z -> z+1) in frontend + API constants.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const VERSION_FILES = [
  path.join(ROOT, 'src/constants/appVersion.js'),
  path.join(ROOT, 'apps/api/src/constants/appVersion.js'),
];

const VERSION_RE = /ABT_ERP_V\.(\d+)\.(\d+)\.(\d+)/;
const APP_VERSION_READ_RE = /export const APP_VERSION = '(ABT_ERP_V\.\d+\.\d+\.\d+)';/;
const APP_VERSION_REPLACE_RE = /export const APP_VERSION = 'ABT_ERP_V\.\d+\.\d+\.\d+';/;

function readVersion(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(APP_VERSION_READ_RE);
  if (!match) throw new Error(`Could not read APP_VERSION from ${filePath}`);
  return match[1];
}

function bumpVersionString(version) {
  const match = version.match(VERSION_RE);
  if (!match) throw new Error(`Invalid version format: ${version}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `ABT_ERP_V.${major}.${minor}.${patch}`;
}

function shortLabel(nextVersion) {
  const m = nextVersion.match(VERSION_RE);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : nextVersion;
}

function replaceVersionInFile(filePath, nextVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!APP_VERSION_REPLACE_RE.test(content)) {
    throw new Error(`Could not replace APP_VERSION in ${filePath}`);
  }
  content = content.replace(
    APP_VERSION_REPLACE_RE,
    `export const APP_VERSION = '${nextVersion}';`
  );

  // Keep restore-point metadata in sync when present (frontend file).
  const label = shortLabel(nextVersion);
  const today = new Date().toISOString().slice(0, 10);
  content = content.replace(
    /name:\s*'Alpha Bridge ERP v[\d.]+'/,
    `name: 'Alpha Bridge ERP v${label}'`
  );
  content = content.replace(/created:\s*'[\d-]+'/, `created: '${today}'`);

  fs.writeFileSync(filePath, content);
}

function main() {
  const current = readVersion(VERSION_FILES[0]);
  const next = bumpVersionString(current);

  for (const filePath of VERSION_FILES) {
    replaceVersionInFile(filePath, next);
  }

  console.log(`${current} -> ${next}`);
  return next;
}

main();
