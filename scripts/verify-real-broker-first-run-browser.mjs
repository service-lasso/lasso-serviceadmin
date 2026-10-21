import { execFileSync, spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { admitFirstRunInputs, captureFirstRunChild, commitmentDigest } from './first-run-terminal-diagnostic.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wrapper = fileURLToPath(import.meta.url)
const verifier = path.join(root, 'scripts', 'verify-real-broker-browser.mjs')
const harness = path.join(root, 'cypress', 'e2e', 'secrets-broker', 'real-first-run.cy.js')
const requiredDigest = async (target) => commitmentDigest(await readFile(target))
const projectFailure = (error) => {
  // Admission fails before spawn. Keep the detailed error in the local caller;
  // projection is deliberately bounded and has no path, command or raw content.
  return { diagnostic: { schema: 'service-admin.first-run-admission.v1', state: 'not_admitted', platform: process.platform, safeDiagnosticCode: 'runner_start_failed' }, error }
}
let result
try {
  const candidate = { wrapperSha256: await requiredDigest(wrapper), verifierSha256: await requiredDigest(verifier), harnessSha256: await requiredDigest(harness) }
  const admission = admitFirstRunInputs({
    workspaceRoot: process.env.SERVICE_LASSO_WORKSPACE_ROOT,
    instanceRegistryPath: process.env.SERVICE_LASSO_INSTANCE_REGISTRY_PATH,
    hostPortRegistryPath: process.env.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH,
    coreProjectionPath: process.env.SERVICE_LASSO_TEST_CORE_INITIAL_PROJECTION,
    platform: process.platform,
  })
  const adminHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const adminTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim()
  const run = commitmentDigest(`${adminHead}:${adminTree}:${candidate.wrapperSha256}:${candidate.verifierSha256}:${candidate.harnessSha256}:${admission.core.projectionSha256}:${process.platform}:first-run`)
  result = await captureFirstRunChild({
    spawnChild: spawn, command: process.execPath, args: [verifier], platform: process.platform, run, candidate,
    coreCandidate: { head: admission.core.candidate.head, tree: admission.core.candidate.tree, run: admission.core.projectionSha256 }, admission,
    options: { cwd: root, env: { ...process.env, SERVICE_LASSO_REAL_BROWSER_MODE: 'first-run' }, stdio: ['ignore', 'pipe', 'pipe'] },
  })
} catch (error) { result = { ...projectFailure(error), exitCode: 1 } }
process.stderr.write(`${JSON.stringify(result.diagnostic)}\n`)
process.exitCode = result.exitCode
