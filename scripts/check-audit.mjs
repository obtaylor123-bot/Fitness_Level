import { spawnSync } from 'node:child_process';

const allowlist = new Map([
  ['GHSA-86w9-cpqp-85rv', { expires: '2026-11-26', review: 'node-forge signature verification' }],
  ['GHSA-mrhx-c7xc-m3w5', { expires: '2026-11-26', review: 'Zod oversized collection validation' }],
]);

const npmCli = process.env.npm_execpath;
const result = spawnSync(
  npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm',
  npmCli ? [npmCli, 'audit', '--json'] : ['audit', '--json'],
  {
  encoding: 'utf8',
  shell: process.platform === 'win32' && !npmCli,
  },
);
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || 'npm audit did not return valid JSON.\n');
  process.exit(2);
}

if (result.error || result.status !== 0 && audit.error) {
  console.error('npm audit could not reach the registry; security:audit cannot pass without an audit result.');
  process.stderr.write(result.stderr || '');
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);
const findings = [];
const unknown = [];
for (const [name, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;
  const advisories = (vulnerability.via ?? []).filter((entry) => typeof entry === 'object');
  if (!advisories.length) continue; // Aggregate packages inherit the direct advisories listed below.
  for (const advisory of advisories) {
    const match = String(advisory.url ?? '').match(/GHSA-[\w-]+/);
    const id = match?.[0];
    const allowance = id && allowlist.get(id);
    if (!allowance || allowance.expires < today) {
      unknown.push(`${id ?? 'unidentified advisory'} (${name}, ${vulnerability.severity})`);
    } else {
      findings.push(`${id} (${name}, allowed until ${allowance.expires})`);
    }
  }
}

for (const [id, entry] of allowlist) {
  if (entry.expires < today) unknown.push(`${id} allowlist expired ${entry.expires}`);
}

if (unknown.length) {
  console.error('New, unrecognized, or expired high/critical npm audit findings:');
  for (const item of unknown) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`No new high/critical npm advisories. Reviewed allowlist: ${[...new Set(findings)].join('; ') || 'none'}`);
if (result.status !== 0 && findings.length === 0) process.exit(result.status ?? 1);
