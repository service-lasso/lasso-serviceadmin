import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  captureFirstRunChild,
  commitmentDigest,
} from './first-run-terminal-diagnostic.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const verifier = path.join(root, 'scripts', 'verify-real-broker-browser.mjs')
const harness = path.join(
  root,
  'cypress',
  'e2e',
  'secrets-broker',
  'real-first-run.cy.js'
)
const wrapper = fileURLToPath(import.meta.url)
async function safeFileDigest(target) {
  try {
    return commitmentDigest(await readFile(target))
  } catch {
    return commitmentDigest('unavailable')
  }
}

const candidate = {
  wrapperSha256: await safeFileDigest(wrapper),
  verifierSha256: await safeFileDigest(verifier),
  harnessSha256: await safeFileDigest(harness),
}
const run = commitmentDigest(
  `${candidate.wrapperSha256}:${candidate.verifierSha256}:${candidate.harnessSha256}:${process.platform}:first-run`
)
const safeCoreRevision = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)
    ? value.toLowerCase()
    : 'unavailable'
const result = await captureFirstRunChild({
  spawnChild: spawn,
  command: process.execPath,
  args: [verifier],
  platform: process.platform,
  run,
  candidate,
  coreCandidate: {
    head: safeCoreRevision(process.env.SERVICE_LASSO_TEST_CORE_REVISION),
    tree: safeCoreRevision(process.env.SERVICE_LASSO_TEST_CORE_TREE),
    run: 'unavailable',
  },
  options: {
    cwd: root,
    env: { ...process.env, SERVICE_LASSO_REAL_BROWSER_MODE: 'first-run' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
})
process.stderr.write(`${JSON.stringify(result.diagnostic)}\n`)
process.exitCode = result.exitCode
