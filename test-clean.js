#!/usr/bin/env node

const { spawn } = require('child_process');

// vitest を実行
const vitest = spawn('npx', ['vitest', 'run', "--coverage"], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// 標準出力をフィルタリング
vitest.stdout.on('data', (data) => {
  const output = data.toString();
  // EBUSY警告を含む行をフィルタリング
  const lines = output.split('\n');
  const filtered = lines.filter(line =>
    !line.includes('Unable to remove temporary directory') &&
    !line.includes('EBUSY: resource busy or locked') &&
    !line.includes('[vpw:debug] Shutting down runtimes') &&
    !line.includes('npm warn Unknown env config')
  );
  if (filtered.join('\n').trim()) {
    process.stdout.write(filtered.join('\n'));
  }
});

// 標準エラー出力をフィルタリング
vitest.stderr.on('data', (data) => {
  const output = data.toString();
  const lines = output.split('\n');
  const filtered = lines.filter(line =>
    !line.includes('Unable to remove temporary directory') &&
    !line.includes('EBUSY: resource busy or locked') &&
    !line.includes('[vpw:debug] Shutting down runtimes') &&
    !line.includes('npm warn Unknown env config')
  );
  if (filtered.join('\n').trim()) {
    process.stderr.write(filtered.join('\n'));
  }
});

// プロセス終了時の処理
vitest.on('close', (code) => {
  process.exit(code);
});