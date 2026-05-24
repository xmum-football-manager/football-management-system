import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
import { withSentryConfig } from '@sentry/nextjs'

const withSerwist = async (config: NextConfig): Promise<NextConfig> => {
  const { default: serwistNext } = await import('@serwist/next')
  return serwistNext({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
  })(config)
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
}

export default async (phase: string) => {
  const base = phase === PHASE_DEVELOPMENT_SERVER ? nextConfig : await withSerwist(nextConfig)
  return withSentryConfig(base, {
    silent: true,
    telemetry: false,
  })
}
