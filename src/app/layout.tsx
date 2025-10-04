import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'Japanese Proofreading App',
    template: '%s | Japanese Proofreading App'
  },
  description: 'AI-powered Japanese text proofreading and correction tool. Detect and fix grammar, style, and consistency issues in Japanese documents.',
  keywords: ['Japanese', 'proofreading', 'correction', 'grammar', 'style', 'AI', 'text analysis'],
  authors: [{ name: 'Japanese Proofreading Team' }],
  creator: 'Japanese Proofreading App',
  publisher: 'Japanese Proofreading App',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://japanese-proofreading.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://japanese-proofreading.app',
    title: 'Japanese Proofreading App',
    description: 'AI-powered Japanese text proofreading and correction tool',
    siteName: 'Japanese Proofreading App',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Japanese Proofreading App',
    description: 'AI-powered Japanese text proofreading and correction tool',
    creator: '@japanese_proofreading',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        <div id="root">
          {children}
        </div>
        <Toaster position="top-right" richColors />

        {/* Skip to main content for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-lg z-50 focus-ring"
        >
          メインコンテンツにスキップ
        </a>
      </body>
    </html>
  )
}



