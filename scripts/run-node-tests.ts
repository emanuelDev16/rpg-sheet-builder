import { spawnSync } from 'node:child_process';
import { NODE_TEST_FILES } from '../vitest.config.ts';

/** Executes all core `node:test` suites registered alongside Vitest exclusions. */
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...NODE_TEST_FILES],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
