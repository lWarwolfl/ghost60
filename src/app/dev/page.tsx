import { notFound } from 'next/navigation'
import { DevClient } from '@/app/dev/page.client'

export default function DevPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DevClient />
}
