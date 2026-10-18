import { androidAssetLinks } from '@/lib/android'

export async function GET() {
  const links = androidAssetLinks(
    process.env.ANDROID_PACKAGE_NAME,
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS
  )
  if (!links)
    return Response.json(
      { error: 'android-association-not-configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  return Response.json(links, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
