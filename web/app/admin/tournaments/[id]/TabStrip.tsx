'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

interface TabDef {
  segment: string
  label: string
}

const BASE_TABS: TabDef[] = [
  { segment: '', label: 'Overview' },
  { segment: 'setup/teams', label: 'Teams' },
  { segment: 'setup/fixtures', label: 'Fixtures' },
  { segment: 'setup/settings', label: 'Settings' },
]

const BRACKET_TAB: TabDef = { segment: 'setup/bracket', label: 'Bracket' }

interface Props {
  teamsAlert?: boolean
  showBracketTab?: boolean
}

export function TabStrip({ teamsAlert = false, showBracketTab = false }: Props) {
  const { id } = useParams() as { id: string }
  const pathname = usePathname()
  const basePath = `/admin/tournaments/${id}`
  const tabs = showBracketTab ? [...BASE_TABS, BRACKET_TAB] : BASE_TABS

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto flex">
        {tabs.map(tab => {
          const href = tab.segment ? `${basePath}/${tab.segment}` : basePath
          const isActive = tab.segment === ''
            ? pathname === basePath
            : pathname.endsWith(`/${tab.segment}`)
          return (
            <Link
              key={tab.segment || 'overview'}
              href={href}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-green-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.segment === 'setup/teams' && teamsAlert && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
