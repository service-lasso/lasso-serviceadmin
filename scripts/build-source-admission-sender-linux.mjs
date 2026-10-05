// Source-only until separate complete input admission. Never activates a namespace.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runOriginalStage } from './source-admission-linux-owned-process.mjs'

const fail = () => { throw new Error('FIXTURE_SENDER_LINUX_INPUT') }
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const prefix = '/opt/service-lasso/admin683-linux-candidate'
const rootPath = process.argv[2]
const pin = process.argv[3]
if (process.platform !== 'linux' || process.arch !== 'x64' || process.version !== 'v22.23.2' ||
    !path.isAbsolute(rootPath ?? '') || !/^[a-f0-9]{64}$/.test(pin ?? '')) fail()
const raw = fs.readFileSync(rootPath)
if (raw.length > 4194304 || hash(raw) !== pin) fail()
const root = JSON.parse(raw)
if (root.schema !== 'sa-sender-linux-build.v1' || root.nodeVersion !== '22.23.2' ||
    root.platform !== 'linux' || root.deadlineMs !== 120000 ||
    !Array.isArray(root.members) || root.members.length < 2 || root.members.length > 20000) fail()
const members = new Map()
for (const row of root.members) {
  if (!path.isAbsolute(row.path) || members.has(row.path) || !Number.isSafeInteger(row.size) ||
      row.size < 0 || row.size > 134217728 || !/^[a-f0-9]{64}$/.test(row.sha256)) fail()
  const bytes = fs.readFileSync(row.path)
  if (bytes.length !== row.size || hash(bytes) !== row.sha256) fail()
  members.set(row.path, row)
}
const own = fileURLToPath(import.meta.url)
for (const file of [process.execPath, own, path.join(path.dirname(own),
  'source-admission-linux-owned-process.mjs'), `${prefix}/source/tests/native/source-admission-sender.c`,
  `${prefix}/source/runtime/server.js`, '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2',
  '/usr/lib/gcc/x86_64-linux-gnu/12/cc1', '/usr/bin/x86_64-linux-gnu-as',
  '/usr/bin/x86_64-linux-gnu-ld.bfd', '/lib/x86_64-linux-gnu/libc.so.6',
  '/usr/lib/gcc/x86_64-linux-gnu/12/libgcc.a', '/lib/x86_64-linux-gnu/libgcc_s.so.1']) {
  if (!members.has(file)) fail()
}
if (fs.readlinkSync('/lib64/ld-linux-x86-64.so.2') !==
    '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2' ||
    fs.existsSync('/etc/ld.so.cache') || fs.existsSync('/etc/ld.so.preload')) fail()
if (root.outputRoot !== `${prefix}/output` || fs.existsSync(root.outputRoot)) fail()
if (root.nativeSource !== `${prefix}/source/tests/native/source-admission-sender.c` ||
    root.runtimeSource !== `${prefix}/source/runtime/server.js`) fail()
// Namespace/kernel/mount/source choices are parent admission inputs, not inferred here.
if (root.namespaceRoot !== '/' || root.namespaceInputSHA256 !==
    'e450374857db3acf6135235b28b03638c0fe1df1ac40c059adbcc4d38adf89bd') fail()
const output = root.outputRoot
fs.mkdirSync(output, { mode: 0o700 })
fs.mkdirSync(`${output}/temp`, { mode: 0o700 })
const start = process.hrtime.bigint()
const stages = [
  ['frontend', '/usr/lib/gcc/x86_64-linux-gnu/12/cc1', [
    '-quiet', '-m64', '-march=x86-64', '-mtune=generic', '-std=c17', '-O2',
    '-Wall', '-Wextra', '-Werror', '-fPIC', '-fstack-protector-strong',
    '-fasynchronous-unwind-tables', '-D_GNU_SOURCE', '-DNAPI_VERSION=2',
    '-DNODE_GYP_MODULE_NAME=source_admission_sender', '-nostdinc',
    '-isystem', '/usr/lib/gcc/x86_64-linux-gnu/12/include',
    '-isystem', '/usr/include/x86_64-linux-gnu', '-isystem', '/usr/include',
    '-I', `${prefix}/node-source/src`, '-I', `${prefix}/node-source/deps/uv/include`,
    '-o', `${output}/sender.s`, `${prefix}/source/tests/native/source-admission-sender.c`,
  ]],
  ['assembler', '/usr/bin/x86_64-linux-gnu-as', [
    '--64', '--fatal-warnings', '-o', `${output}/sender.o`, `${output}/sender.s`,
  ]],
  ['linker', '/usr/bin/x86_64-linux-gnu-ld.bfd', [
    '-m', 'elf_x86_64', '-shared', '--build-id=sha1', '-z', 'noexecstack',
    '-z', 'relro', '-z', 'now', '-o', `${output}/source-admission-sender.node`,
    `${output}/sender.o`, '/lib/x86_64-linux-gnu/libc.so.6',
    '/usr/lib/gcc/x86_64-linux-gnu/12/libgcc.a', '--as-needed',
    '/lib/x86_64-linux-gnu/libgcc_s.so.1',
  ]],
]
for (const [stage, image, args] of stages) {
  if (Number((process.hrtime.bigint() - start) / 1000000n) >= 120000) fail()
  await runOriginalStage(stage, { image, arguments: args }, output, start, pin)
}
if (!fs.statSync(`${output}/source-admission-sender.node`).size) fail()
// No artifact ROOT, load permission, native or descendant acceptance is issued.
