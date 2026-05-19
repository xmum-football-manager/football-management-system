'use client'

import { useParams, redirect } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupIndexPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  useEffect(() => {
    router.replace(`/admin/tournaments/${id}/setup/teams`)
  }, [id, router])

  return null
}
