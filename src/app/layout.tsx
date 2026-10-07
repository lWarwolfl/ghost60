import type { Metadata, Viewport } from 'next'
import { Archivo, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { WrappedProviders } from '@/components/providers/wrapped-providers'

const display = Archivo({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['700', '800']
})

const body = Space_Grotesk({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Ghost60 — One minute. One run.',
  description: 'Everyone gets the same game. You get one ranked attempt. Leave a ghost. Send it to a friend.',
  applicationName: 'Ghost60',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Ghost60' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' }
}

export const viewport: Viewport = {
  themeColor: '#070912',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} flex min-h-dvh flex-col antialiased`}>
        <WrappedProviders>{children}</WrappedProviders>
      </body>
    </html>
  )
}
