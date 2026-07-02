/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readAsset(path: string) {
  return readFileSync(join(repoRoot, path))
}

function readText(path: string) {
  return readAsset(path).toString('utf8')
}

describe('Service Lasso branding assets', () => {
  it('uses the supplied Service Lasso mark for favicons and app logos', () => {
    const canonicalSvg = readAsset('public/images/service-lasso-icon.svg')

    expect(readAsset('public/images/favicon.svg')).toEqual(canonicalSvg)
    expect(readAsset('public/images/favicon_light.svg')).toEqual(canonicalSvg)
    expect(readAsset('public/images/services/service-admin.svg')).toEqual(
      canonicalSvg
    )
    expect(readAsset('public/services/@serviceadmin/logo.svg')).toEqual(
      canonicalSvg
    )
  })

  it('keeps browser and installed-app metadata pointed at the checked-in assets', () => {
    const indexHtml = readText('index.html')
    const manifest = JSON.parse(readText('public/site.webmanifest')) as {
      name: string
      short_name: string
      icons: Array<{ src: string; sizes: string; type: string }>
    }

    expect(indexHtml).toContain('href="/images/favicon.svg"')
    expect(indexHtml).toContain('href="/apple-touch-icon.png"')
    expect(indexHtml).toContain('href="/site.webmanifest"')
    expect(manifest.name).toBe('Service Admin UI')
    expect(manifest.short_name).toBe('Service Admin')
    expect(manifest.icons).toEqual([
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ])
  })
})
