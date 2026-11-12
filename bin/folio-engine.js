#!/usr/bin/env node
/* global process, console */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const distCliPath = path.join(pkgRoot, 'dist', 'migration-doctor.js');
const srcDoctorPath = path.join(pkgRoot, 'src', 'diagnostics', 'migrationDoctor.ts');

async function main() {
  const args = process.argv.slice(2);

  if (fs.existsSync(distCliPath)) {
    const mod = await import(pathToFileURL(distCliPath).href);
    const exitCode = mod.runFolioCli(args);
    process.exit(exitCode);
  }

  // Fallback for local source checkouts before `npm run build:lib` has been executed.
  const tsxBin = path.join(pkgRoot, 'node_modules', '.bin', 'tsx');
  if (fs.existsSync(srcDoctorPath) && fs.existsSync(tsxBin)) {
    const [cmd, ...rest] = args;
    if (!cmd || cmd === 'doctor' || cmd === 'check') {
      const result = spawnSync(tsxBin, [srcDoctorPath, ...rest], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      process.exit(result.status ?? 1);
    }
  }

  console.error(
    '❌ @devcabs/folio-engine CLI bundle not found at dist/migration-doctor.js. Run "npm run build:lib" first.'
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
