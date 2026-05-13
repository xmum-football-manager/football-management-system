'use client'

const STEP_LABELS = ['Basic Info', 'Format', 'Match Rules', 'Points', 'Review'] as const

interface Props {
  currentStep: number
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  children: React.ReactNode
}

export function WizardStepShell({
  currentStep,
  onBack,
  onNext,
  nextLabel = 'Next →',
  nextDisabled,
  children,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-6">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1
          const done = step < currentStep
          const active = step === currentStep
          return (
            <div key={step} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${active ? 'bg-green-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
              >
                {done ? '✓' : step}
              </div>
              <span className={`text-xs text-center ${active ? 'text-green-700 font-medium' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="space-y-5">{children}</div>

      <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          {currentStep === 1 ? '← Dashboard' : '← Back'}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
