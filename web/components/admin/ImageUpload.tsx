'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { mediaUrl, type MediaFolder } from '@/lib/storage'
import { uploadImage } from '@/lib/storage-client'

interface ImageUploadProps {
  /** Current storage path (e.g. 'team-logos/abc.webp') or null when unset. */
  value: string | null
  folder: MediaFolder
  /** Longest side in px the image is downscaled to before upload. */
  maxDim: number
  /** Called with the new storage path after a successful upload. */
  onUploaded: (path: string) => void | Promise<void>
  /** When set, a × button appears on the current image to delete it. */
  onRemove?: () => void | Promise<void>
  label?: string
  shape?: 'avatar' | 'banner'
  /** Avatar size; 'sm' fits inline rows, 'md' fits form fields. */
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
}

export function ImageUpload({
  value,
  folder,
  maxDim,
  onUploaded,
  onRemove,
  label,
  shape = 'avatar',
  size = 'md',
  disabled,
  title,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const url = mediaUrl(value)

  async function handleRemove() {
    if (!onRemove) return
    setUploading(true)
    try {
      await onRemove()
    } finally {
      setUploading(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadImage(file, folder, maxDim)
      if ('error' in result) toast.error(result.error)
      else await onUploaded(result.path)
    } finally {
      setUploading(false)
    }
  }

  const iconClass = shape === 'avatar' && size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  const buttonClass =
    shape === 'banner'
      ? 'relative flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60'
      : `relative flex ${size === 'sm' ? 'h-8 w-8' : 'h-16 w-16'} shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/30 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60`

  return (
    <div className={label ? 'space-y-1.5' : undefined}>
      {label && <Label>{label}</Label>}
      <div className={shape === 'banner' ? 'relative' : 'relative inline-block'}>
        <button
          type="button"
          title={title ?? (label ? `Upload ${label.toLowerCase()}` : 'Upload image')}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className={buttonClass}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label ?? 'Uploaded image'} className="absolute inset-0 h-full w-full object-cover" />
          )}
          {uploading ? (
            <Loader2 className={`relative z-10 animate-spin drop-shadow ${iconClass}`} />
          ) : (
            !url && <ImagePlus className={`text-muted-foreground ${iconClass}`} />
          )}
        </button>
        {url && onRemove && !uploading && !disabled && (
          <button
            type="button"
            title="Remove image"
            onClick={handleRemove}
            className={
              shape === 'banner'
                ? 'absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow hover:text-foreground'
                : 'absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow hover:text-foreground'
            }
          >
            <X className={shape === 'banner' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
