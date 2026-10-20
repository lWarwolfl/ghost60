import { GoogleSignIn } from '@/components/auth/google-sign-in'
import { ProfileClient } from '@/app/profile/page.client'

export default function ProfilePage() {
  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1">
          <p className="text-spectral-cyan text-[11px] tracking-[0.18em] uppercase">Profile</p>
          <h1 className="font-display font-800 text-3xl">Your haunting</h1>
        </div>
        <GoogleSignIn />
        <ProfileClient />
      </main>
    </div>
  )
}
