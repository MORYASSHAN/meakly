import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  [npmCommand, ['--workspace', '@coldmailai/gateway', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/auth-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/user-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/usage-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/ai-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/email-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/billing-service', 'run', 'dev']],
  [npmCommand, ['--workspace', '@coldmailai/notification-service', 'run', 'dev']],
];

const children = commands.map(([cmd, args]) => {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  });

  const workspaceIndex = args.indexOf('--workspace');
  const label =
    workspaceIndex >= 0 && args[workspaceIndex + 1]
      ? args[workspaceIndex + 1]
      : path.basename(args[args.length - 1] || cmd);
  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
});

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.stdout.write('Started ColdMailAI backend services.\n');
