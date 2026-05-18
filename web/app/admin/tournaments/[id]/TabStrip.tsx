'use client'

export type TabId = 'overview' | 'teams' | 'fixtures' | 'settings'

interface TabDef {
  id: TabId
  label: string
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  active: TabId
  onChange: (id: TabId) => void
  teamsAlert: boolean
}

export function TabStrip({ active, onChange, teamsAlert }: Props) {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto flex">
        {TABS.map(tab => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-green-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.id === 'teams' && teamsAlert && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
