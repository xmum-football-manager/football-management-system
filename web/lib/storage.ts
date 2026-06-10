// Shared (server + client) helpers for the public 'media' storage bucket.

export const MEDIA_BUCKET = 'media'

export type MediaFolder =
  | 'tournament-logos'
  | 'tournament-banners'
  | 'team-logos'
  | 'player-photos'

/** Public CDN URL for a file in the media bucket, or null when no path is set. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`
}
