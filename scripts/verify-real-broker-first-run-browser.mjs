import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const verifier = path.join(root, 'scripts', 'verify-real-broker-browser.mjs')
const child = spawn(process.execPath, [verifier], {
  cwd: root,
  env: { ...process.env, SERVICE_LASSO_REAL_BROWSER_MODE: 'first-run' },
  stdio: 'inherit',
})
const exitCode = await new Promise((resolve) =>
  child.once('exit', (code) => resolve(code ?? 1))
)
process.exitCode = exitCode
