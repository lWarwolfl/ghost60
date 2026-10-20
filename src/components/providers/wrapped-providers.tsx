import { Toaster } from 'sonner'
import type { PropsWithChildren } from 'react'
import { AnonymousBootstrap } from '@/components/providers/anonymous-bootstrap'
import { BottomNav } from '@/components/layout/bottom-nav'
import { PwaRegister } from '@/components/providers/pwa-register'
import { ReactQueryProvider } from '@/components/providers/react-query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

export async function WrappedProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <ReactQueryProvider>
        <PwaRegister />
        <AnonymousBootstrap />
        {children}
        <BottomNav />
        <Toaster position="top-center" closeButton />
      </ReactQueryProvider>
    </ThemeProvider>
  )
}
