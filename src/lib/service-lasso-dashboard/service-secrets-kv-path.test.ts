import { describe, expect, it } from 'vitest'
import {
  SERVICE_SECRETS_KV_NAMESPACE,
  serviceSecretsKvBucketFolderPath,
  serviceSecretsKvBucketPath,
} from './service-secrets-kv-path'

describe('service secrets KV bucket path', () => {
  it('builds the default services namespace bucket from a service id', () => {
    expect(serviceSecretsKvBucketPath('node-sample-service')).toBe(
      'services/node-sample-service'
    )
    expect(serviceSecretsKvBucketPath('@serviceadmin')).toBe(
      'services/@serviceadmin'
    )
    expect(serviceSecretsKvBucketFolderPath('node-sample-service')).toBe(
      'services/node-sample-service/'
    )
  })

  it('does not double-prefix an already namespaced path', () => {
    expect(serviceSecretsKvBucketPath('services/node-sample-service')).toBe(
      'services/node-sample-service'
    )
    expect(serviceSecretsKvBucketPath(SERVICE_SECRETS_KV_NAMESPACE)).toBe(
      'services'
    )
    expect(serviceSecretsKvBucketPath('')).toBe('services')
  })
})
