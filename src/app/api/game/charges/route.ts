import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/server'
import { getCharges } from '@/lib/game/charges'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await getCharges(user.id), { headers: { 'Cache-Control': 'private, no-store' } })
}
