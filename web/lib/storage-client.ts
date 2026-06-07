'use client'

import { createClient } from '@/lib/supabase/client'
import { MEDIA_BUCKET, type MediaFolder } from '@/lib/storage'

/** Downscale to maxDim (longest side) and re-encode as webp. */
async function resizeToWebp(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  )
  if (!blob) throw new Error('Could not encode image.')
  return blob
}

/**
 * Resize an image client-side and upload it straight to Supabase Storage
 * (browser → bucket, so Vercel request-body limits never apply).
 * Files get unique names; replaced files are cleaned up via removeImage.
 */
export async function uploadImage(
  file: File,
  folder: MediaFolder,
  maxDim: number,
): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Please choose an image file.' }
  let blob: Blob
  try {
    blob = await resizeToWebp(file, maxDim)
  } catch {
    return { error: 'Could not process that image. Try a different file.' }
  }
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/webp' })
  if (error) return { error: error.message }
  return { path }
}

/** Best-effort delete of a replaced or abandoned image. Failures are ignored. */
export async function removeImage(path: string): Promise<void> {
  try {
    await createClient().storage.from(MEDIA_BUCKET).remove([path])
  } catch {
    // Orphaned files are harmless; admins can prune them in the dashboard.
  }
}
