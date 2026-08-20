/** Default Broker namespace for per-service KV buckets. */
export const SERVICE_SECRETS_KV_NAMESPACE = 'services'

/**
 * KV folder path for a service secrets bucket.
 * Lands the Path pane on `services/<serviceId>` (or the default namespace).
 */
export function serviceSecretsKvBucketPath(serviceId: string): string {
  const trimmed = serviceId.trim()
  if (!trimmed) {
    return SERVICE_SECRETS_KV_NAMESPACE
  }

  const namespacePrefix = `${SERVICE_SECRETS_KV_NAMESPACE}/`
  if (
    trimmed === SERVICE_SECRETS_KV_NAMESPACE ||
    trimmed.startsWith(namespacePrefix)
  ) {
    return trimmed.replace(/\/+$/gu, '')
  }

  return `${SERVICE_SECRETS_KV_NAMESPACE}/${trimmed}`
}

/**
 * Folder form used by paste-to-navigate: trailing slash browses the bucket.
 */
export function serviceSecretsKvBucketFolderPath(serviceId: string): string {
  return `${serviceSecretsKvBucketPath(serviceId)}/`
}
