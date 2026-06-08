import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages', 'services', 'scripts'];
const IGNORE_DIRS = new Set(['node_modules', '.git']);

async function collectJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  return {
    filePath,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

const files = [];
for (const dir of SCAN_DIRS) {
  files.push(...await collectJavaScriptFiles(path.join(ROOT, dir)));
}

files.sort();

const failures = [];
for (const filePath of files) {
  const result = runNodeCheck(filePath);
  if (result.status !== 0) {
    failures.push(result);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`Syntax check failed: ${path.relative(ROOT, failure.filePath)}\n`);
    if (failure.stdout) {
      process.stderr.write(failure.stdout);
    }
    if (failure.stderr) {
      process.stderr.write(failure.stderr);
    }
  }

  process.exitCode = 1;
  process.stderr.write(`\n${failures.length} file(s) failed syntax checks.\n`);
} else {
  process.stdout.write(`Checked ${files.length} JavaScript file(s). All passed.\n`);
}
