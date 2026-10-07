import { Toaster } from 'sonner'
import type { PropsWithChildren } from 'react'
import { AnonymousBootstrap } from '@/components/providers/anonymous-bootstrap'
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
        <Toaster richColors closeButton />
      </ReactQueryProvider>
    </ThemeProvider>
  )
}
