/* eslint-disable unicorn/no-process-exit */
// 让 preinstall 脚本兼容 Windows（PowerShell）和类 Unix（sh）
const { spawnSync } = require('node:child_process');

const isWin = process.platform === 'win32';
if (isWin) {
  // PowerShell 执行 ps1
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/preinstall.ps1'], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
} else {
  // Unix-like 执行 sh
  const result = spawnSync('sh', ['scripts/preinstall.sh'], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
