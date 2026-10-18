import { describe, expect, it } from 'vitest'
import { androidAssetLinks } from '@/lib/android'

const fingerprint = Array.from({ length: 32 }, () => 'AB').join(':')

describe('Android app association', () => {
  it('fails closed until real package and signing certificates are configured', () => {
    expect(androidAssetLinks()).toBeNull()
    expect(androidAssetLinks('com.ghost60.app', 'invalid')).toBeNull()
    expect(androidAssetLinks('../app', fingerprint)).toBeNull()
  })
  it('supports certificate rotation without changing configured identifiers', () => {
    expect(
      androidAssetLinks('com.ghost60.app', `${fingerprint}, ${fingerprint.toLowerCase()}`)
    ).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.ghost60.app',
          sha256_cert_fingerprints: [fingerprint, fingerprint],
        },
      },
    ])
  })
})
