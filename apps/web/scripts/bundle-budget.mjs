/**
 * Fails the build when the JavaScript needed for the first paint grows past the budget.
 * The initial set is what dist/index.html loads up front (the module entry plus its
 * modulepreloads); lazily loaded route and feature chunks are not counted.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 240);
const dist = path.resolve(import.meta.dirname, '../dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(
  (match) => match[1],
);

let total = 0;
const rows = initial.map((file) => {
  const gz = gzipSync(readFileSync(path.join(dist, file))).length;
  total += gz;
  return `  ${file}  ${(gz / 1024).toFixed(1)} kB gz`;
});
console.log(
  `Initial JavaScript (${initial.length} files): ${(total / 1024).toFixed(1)} kB gz, budget ${BUDGET_KB} kB`,
);
console.log(rows.join('\n'));
if (total > BUDGET_KB * 1024) {
  console.error(
    `Bundle budget exceeded by ${((total - BUDGET_KB * 1024) / 1024).toFixed(1)} kB gz`,
  );
  process.exit(1);
}
