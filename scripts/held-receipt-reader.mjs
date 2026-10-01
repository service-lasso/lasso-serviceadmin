import { open, lstat } from 'node:fs/promises'
import path from 'node:path'

function safeFailure(label) {
  return new Error(`${label} could not be read from its held descriptor.`)
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino
}

export function absoluteOwnedPath(root, literalPath, label) {
  if (!path.isAbsolute(root) || typeof literalPath !== 'string' || literalPath.length === 0) {
    throw new Error(`${label} must use an absolute owner root and a literal relative path.`)
  }
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, literalPath)
  const relative = path.relative(resolvedRoot, resolved)
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`${label} was outside its caller-owned root.`)
  }
  return resolved
}

export async function requireRealDirectoryChain(root, label) {
  const resolved = path.resolve(root)
  const parsed = path.parse(resolved)
  let current = parsed.root
  const rootInfo = await lstat(current).catch(() => null)
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) throw safeFailure(label)
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    const info = await lstat(current).catch(() => null)
    if (!info?.isDirectory() || info.isSymbolicLink()) throw safeFailure(label)
  }
  return resolved
}

export async function readHeldRegularFile({ root, literalPath, label, maxBytes, allowEmpty = false }) {
  const ownerRoot = await requireRealDirectoryChain(root, label)
  const filePath = absoluteOwnedPath(ownerRoot, literalPath, label)
  const parent = path.dirname(filePath)
  await requireRealDirectoryChain(parent, label)
  let handle
  try {
    const before = await lstat(filePath)
    if (!before.isFile() || before.isSymbolicLink() || (!allowEmpty && before.size === 0) || before.size > maxBytes) {
      throw safeFailure(label)
    }
    handle = await open(filePath, 'r')
    const held = await handle.stat()
    const after = await lstat(filePath)
    if (!held.isFile() || !sameIdentity(before, held) || !sameIdentity(held, after) || after.isSymbolicLink() || held.size !== before.size || (!allowEmpty && held.size === 0) || held.size > maxBytes) {
      throw safeFailure(label)
    }
    const bytes = await handle.readFile()
    if (bytes.length !== held.size || (!allowEmpty && bytes.length === 0) || bytes.length > maxBytes) throw safeFailure(label)
    return bytes
  } catch (error) {
    if (error?.message === `${label} could not be read from its held descriptor.`) throw error
    throw safeFailure(label)
  } finally {
    await handle?.close().catch(() => {})
  }
}

export async function readHeldJsonFile(options) {
  const bytes = await readHeldRegularFile(options)
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) }
  } catch {
    throw new Error(`${options.label} was not valid bounded JSON.`)
  }
}
