/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function deepMerge(target, source) {
  if (!isPlainObject(source)) return target;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (isPlainObject(sv) && isPlainObject(tv)) deepMerge(tv, sv);
    else target[key] = sv;
  }
  return target;
}

const patchPath = path.resolve(process.argv[2] || '');
const targetPath = path.resolve(process.argv[3] || '');
if (!patchPath || !targetPath) {
  console.error('Usage: node scripts/deep-merge-messages.cjs <patch.json> <messages/tr.json|en.json>');
  process.exit(1);
}

const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
deepMerge(target, patch);
fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`);
