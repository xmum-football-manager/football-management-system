'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WizardStepShell } from './WizardStepShell'
import { Step1BasicInfo } from './Step1BasicInfo'
import { Step2Format } from './Step2Format'
import { Step3MatchRules } from './Step3MatchRules'
import { Step4PointsScoring } from './Step4PointsScoring'
import { Step5Review } from './Step5Review'
import { createTournament } from './actions'
import { validateStep, DEFAULT_WIZARD_FORM, type WizardFormValue, type WizardErrors } from '@/lib/wizard-validation'

export function TournamentWizard() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [value, setValue] = useState<WizardFormValue>(DEFAULT_WIZARD_FORM)
  const [errors, setErrors] = useState<WizardErrors>({})

  function patch(p: Partial<WizardFormValue>) {
    setValue(v => ({ ...v, ...p }))
    setErrors(e => {
      const next = { ...e }
      for (const k of Object.keys(p) as (keyof WizardFormValue)[]) delete next[k]
      return next
    })
  }

  function handleNext() {
    if (step < 5) {
      const errs = validateStep(step, value)
      if (Object.keys(errs).length > 0) { setErrors(errs); return }
      setErrors({})
      setStep(s => s + 1)
    } else {
      startTransition(async () => {
        const result = await createTournament(value)
        if (result.errors && result.failedStep) {
          setErrors(result.errors)
          setStep(result.failedStep)
          return
        }
        if (result.serverError || !result.id) {
          return
        }
        router.push(`/admin/tournaments/${result.id}`)
      })
    }
  }

  function handleBack() {
    if (step === 1) { router.push('/admin'); return }
    setErrors({})
    setStep(s => s - 1)
  }

  const stepProps = { value, onChange: patch, errors }

  return (
    <WizardStepShell
      currentStep={step}
      onBack={handleBack}
      onNext={handleNext}
      nextLabel={step === 5 ? (isPending ? 'Creating…' : 'Create Tournament') : 'Next →'}
      nextDisabled={isPending}
    >
      {step === 1 && <Step1BasicInfo {...stepProps} />}
      {step === 2 && <Step2Format {...stepProps} />}
      {step === 3 && <Step3MatchRules {...stepProps} />}
      {step === 4 && <Step4PointsScoring {...stepProps} />}
      {step === 5 && <Step5Review value={value} onEdit={n => { setErrors({}); setStep(n) }} />}
    </WizardStepShell>
  )
}
