import { ReplayClient } from '@/app/archive/replay/[id]/page.client'

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReplayClient runId={id} />
}
