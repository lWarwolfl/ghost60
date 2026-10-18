import { z } from 'zod'

export function androidAssetLinks(packageName?: string, fingerprints?: string) {
  const parsed = z
    .object({
      packageName: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/),
      fingerprints: z.array(z.string().regex(/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/)).min(1),
    })
    .safeParse({ packageName, fingerprints: fingerprints?.split(',').map((value) => value.trim()) })
  if (!parsed.success) return null
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: parsed.data.packageName,
        sha256_cert_fingerprints: parsed.data.fingerprints.map((fingerprint) =>
          fingerprint.toUpperCase()
        ),
      },
    },
  ]
}
