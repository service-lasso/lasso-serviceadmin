// Actual data observation only. Output is UNADMITTED, never load permission.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const fail = () => { throw new Error('FIXTURE_SENDER_ARTIFACT_EVIDENCE') }
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const [inputPath, inputSHA, output, nodeImage, destination] = process.argv.slice(2)
for (const name of [inputPath, output, nodeImage, destination]) {
  if (!path.isAbsolute(name ?? '')) fail()
}
if (!/^[a-f0-9]{64}$/.test(inputSHA ?? '') || fs.existsSync(destination)) fail()
const raw = fs.readFileSync(inputPath)
if (raw.length > 4194304 || sha(raw) !== inputSHA) fail()
const input = JSON.parse(raw)
if (!['sa-sender-build.v1', 'sa-sender-linux-build.v1'].includes(input.schema) ||
    !['win32', 'linux'].includes(input.platform) || input.nodeVersion !== '22.23.2' ||
    input.outputRoot !== output || input.deadlineMs !== 120000) fail()
const members = new Map()
function observe(file, expected) {
  if (!path.isAbsolute(file) || members.has(file)) fail()
  const size = fs.statSync(file).size
  if (!Number.isSafeInteger(size) || size < 0 || size > 134217728) fail()
  const bytes = fs.readFileSync(file)
  const row = { path: file, size: bytes.length, sha256: sha(bytes) }
  if (expected && (row.size !== expected.size || row.sha256 !== expected.sha256)) fail()
  members.set(file, row)
}
if (!Array.isArray(input.members) || input.members.length > 20000) fail()
for (const row of input.members) observe(row.path, row)
if (!members.has(nodeImage)) fail()
observe(inputPath)
const stages = input.platform === 'win32' ? ['compiler', 'linker'] :
  ['frontend', 'assembler', 'linker']
for (const stage of stages) {
  const resultPath = path.join(output, `${stage}.RESULT.json`)
  const retirementPath = path.join(output, `${stage}.RETIREMENT.json`)
  observe(resultPath)
  observe(retirementPath)
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
  const retirement = JSON.parse(fs.readFileSync(retirementPath, 'utf8'))
  if (result.stage !== stage || retirement.stage !== stage ||
      !Number.isSafeInteger(result.originalPID) || result.originalPID <= 0 ||
      retirement.originalPID !== result.originalPID || result.exitCode !== 0 ||
      result.nativeAcceptance !== false || result.descendantClosureProven !== false ||
      result.sourceRootSHA256 !== inputSHA || result.elapsedMs >= 120000 ||
      retirement.failed !== false) fail()
  if (input.platform === 'win32') {
    if (!result.kernelStartUTC || !result.kernelEndUTC || result.failures.length ||
        !result.stdout.copy.eof || !result.stderr.copy.eof) fail()
    const roles = ['stdoutReadPipe', 'stderrReadPipe', 'stdoutReader', 'stderrReader',
      'stdoutDestination', 'stderrDestination', 'process']
    for (const role of roles) {
      const facts = retirement.resources[role]
      if (!facts?.present || !facts.disposeAttempted || !facts.disposeReturned || facts.errorClass) fail()
    }
    for (const facts of [result.stdout, result.stderr]) observe(facts.path,
      { size: facts.bytes, sha256: facts.sha256 })
  } else {
    if (result.failed || result.exitSignal !== null || result.outputs.length !== 2) fail()
    for (const role of ['process', 'stdoutPipe', 'stderrPipe']) {
      if (!retirement[role]?.nativeCallback || retirement[role].callbackFailed) fail()
    }
    for (const role of ['stdoutReader', 'stderrReader']) {
      if (!retirement[role]?.readerClosed || retirement[role].failed) fail()
    }
    if (retirement.destinations.length !== 2 || retirement.destinations.some((row) => !row.closed)) fail()
    for (const facts of result.outputs) {
      if (!facts.eof || !facts.readbackClosed || facts.failed) fail()
      observe(facts.path, { size: facts.bytes, sha256: facts.sha256 })
    }
  }
}
for (const name of input.platform === 'win32' ? ['sender.obj', 'source-admission-sender.node'] :
  ['sender.s', 'sender.o', 'source-admission-sender.node']) observe(path.join(output, name))
for (const name of fs.readdirSync(output)) {
  const file = path.join(output, name)
  if (fs.statSync(file).isFile() && !members.has(file)) observe(file)
}
const addon = path.join(output, 'source-admission-sender.node')
if (!members.get(addon).size || !members.has(input.nativeSource) || !members.has(input.runtimeSource)) fail()
const projection = { schema: 'sa-sender-artifact.v1', state: 'UNADMITTED_ACTUAL_OUTPUT_OBSERVATION',
  platform: input.platform, nodeVersion: '22.23.2', nodeImage, addon,
  nativeSource: input.nativeSource, runtimeSource: input.runtimeSource,
  sourceRootSHA256: inputSHA, nativeAcceptance: false, members: [...members.values()] }
const bytes = Buffer.from(JSON.stringify(projection))
if (members.size < 2 || members.size > 20000 || bytes.length > 4194304) fail()
fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 })
// Independent actual image/tool/output review and a NEW runtime admission remain required.
