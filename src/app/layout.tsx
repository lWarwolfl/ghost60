import type { Metadata, Viewport } from 'next'
import { Archivo, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { WrappedProviders } from '@/components/providers/wrapped-providers'

const display = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['700', '800'],
})

const body = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3104'
  ),
  title: 'Ghost60 — Five runs. One ghost.',
  description:
    'Everyone gets the same game. Five runs a day free, unlimited with Ghost+. Every run races your best ghost.',
  applicationName: 'Ghost60',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Ghost60' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#070912',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
