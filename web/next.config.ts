import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

const withSerwist = async (config: NextConfig): Promise<NextConfig> => {
  const { default: serwistNext } = await import('@serwist/next')
  return serwistNext({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
  })(config)
}

const nextConfig: NextConfig = {
  experimental: {
    // Required for Supabase SSR cookie handling in Next.js 16
  },
}

export default async (phase: string) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return nextConfig
  }
  return withSerwist(nextConfig)
}
