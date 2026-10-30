import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Info } from 'lucide-react'
import { Select } from '@/components/Select'
import { useSubmitAccessRequest } from '@/hooks/useAccessRequest'
import { useToastStore } from '@/stores/toastStore'
import { RevenueRange } from '@/api'
import type { AccessRequest } from '@/api'
import { getErrorStatus } from '@/lib/errors'

const COUNTRIES = [
  'Argentina',
  'Mexico',
  'Colombia',
  'Chile',
  'Peru',
  'Uruguay',
  'Brazil',
  'United States',
  'Other',
]

const REVENUE_OPTIONS: { value: RevenueRange; label: string }[] = [
  { value: 'lt_10k', label: 'Under $10k / month' },
  { value: '10k_50k', label: '$10k – $50k / month' },
  { value: '50k_200k', label: '$50k – $200k / month' },
  { value: '200k_plus', label: '$200k+ / month' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  company_name: z.string().trim().min(1, 'Please enter your company name'),
  country: z.string().optional(),
  website: z.string().trim().url('Enter a valid URL (include https://)').optional().or(z.literal('')),
  monthly_revenue: z
    .enum(RevenueRange)
    .optional()
    .or(z.literal('')),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const inputCls = (hasError?: boolean) =>
  `w-full px-3 py-2 rounded-md border text-sm text-text-primary bg-surface-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors ${
    hasError ? 'border-status-critical' : 'border-border'
  }`

export default function RequestAccessPage() {
  const location = useLocation()
  const prefilledEmail = (location.state as { email?: string } | null)?.email ?? ''
  const { addToast } = useToastStore()
  const [submitted, setSubmitted] = useState<AccessRequest | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefilledEmail },
  })

  const { mutate, isPending } = useSubmitAccessRequest()

  const onSubmit = (values: FormValues) => {
    mutate(
      {
        body: {
          name: values.name,
          email: values.email,
          company_name: values.company_name,
          country: values.country || undefined,
          website: values.website || undefined,
          monthly_revenue: values.monthly_revenue || undefined,
          note: values.note?.trim() || undefined,
        },
      },
      {
        onSuccess: (req) => setSubmitted(req ?? null),
        onError: (err) => {
          if (getErrorStatus(err) === 409) {
            setAlreadyRegistered(true)
          } else {
            addToast('Something went wrong. Please try again.', 'error')
          }
        },
      },
    )
  }

  if (alreadyRegistered) {
    return (
      <div className="w-full max-w-md bg-surface-card rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary mb-2">You already have access</h1>
        <p className="text-sm text-text-muted mb-6">
          This email is already linked to a NORTHSTAR account — no need to fill this out. Head to sign in to
          access the platform.
        </p>
        <Link
          to="/login"
          className="inline-block w-full px-4 py-2.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 transition-all"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  if (submitted) {
    const firstName = submitted.name.trim().split(' ')[0]
    return (
      <div className="w-full max-w-md bg-surface-card rounded-lg shadow-xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
            <CheckCircle2 size={24} className="text-status-success" aria-hidden />
          </span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Thanks, {firstName}!</h1>
        <p className="text-sm text-text-muted mb-4">
          We've got your details. A NORTHSTAR team member will reach out to schedule a short intro
          call and see if we're a good fit.
        </p>
        <p className="text-sm font-medium text-text-primary mb-6">
          This doesn't grant platform access — it just gets the conversation started.
        </p>
        <Link
          to="/login"
          className="text-sm font-medium text-status-info hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-surface-card rounded-lg shadow-xl p-8">
      <img src="/logo-main-black.png" alt="NORTHSTAR" className="h-8 w-auto mb-6" />
      <h1 className="text-xl font-semibold text-text-primary mb-1">Request access</h1>
      <p className="text-sm text-text-muted mb-5">
        Tell us a bit about your business and we'll set up a short intro call.
      </p>

      <div className="flex gap-2.5 rounded-md bg-status-info-bg px-3.5 py-3 mb-6">
        <Info size={16} className="text-status-info shrink-0 mt-0.5" aria-hidden />
        <p className="text-xs text-status-info leading-relaxed">
          Submitting this form doesn't create an account or grant access. We'll review your
          details and get in touch to set up an intro call to see if we're a good fit.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-text-muted mb-1.5">
            Full name <span className="text-status-critical">*</span>
          </label>
          <input id="name" {...register('name')} className={inputCls(!!errors.name)} placeholder="Jane Doe" />
          {errors.name && <p className="mt-1 text-xs text-status-critical">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-medium text-text-muted mb-1.5">
            Work email <span className="text-status-critical">*</span>
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className={inputCls(!!errors.email)}
            placeholder="you@company.com"
          />
          {errors.email && <p className="mt-1 text-xs text-status-critical">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="company_name" className="block text-xs font-medium text-text-muted mb-1.5">
            Company name <span className="text-status-critical">*</span>
          </label>
          <input
            id="company_name"
            {...register('company_name')}
            className={inputCls(!!errors.company_name)}
            placeholder="Acme Inc."
          />
          {errors.company_name && (
            <p className="mt-1 text-xs text-status-critical">{errors.company_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="country" className="block text-xs font-medium text-text-muted mb-1.5">
            Country
          </label>
          <Select id="country" {...register('country')} className="w-full">
            <option value="">Select a country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="website" className="block text-xs font-medium text-text-muted mb-1.5">
            Website / online store
          </label>
          <input
            id="website"
            {...register('website')}
            className={inputCls(!!errors.website)}
            placeholder="https://yourstore.com"
          />
          {errors.website && <p className="mt-1 text-xs text-status-critical">{errors.website.message}</p>}
        </div>

        <div>
          <label htmlFor="monthly_revenue" className="block text-xs font-medium text-text-muted mb-1.5">
            Approximate monthly online revenue (USD)
          </label>
          <Select id="monthly_revenue" {...register('monthly_revenue')} className="w-full">
            <option value="">Select a range</option>
            {REVENUE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="note" className="block text-xs font-medium text-text-muted mb-1.5">
            Anything else? <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="note"
            {...register('note')}
            rows={3}
            className={`${inputCls(false)} resize-none`}
            placeholder={
              'e.g. "We sell skincare to women 25–40," "We\'re on Tiendanube + Meta Ads + Amazon," or "We\'ve grown ~30% over the past year."'
            }
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? 'Sending…' : 'Request access'}
        </button>
      </form>

      <p className="mt-4 text-xs text-text-muted text-center">
        Already have access?{' '}
        <Link to="/login" className="font-medium text-status-info hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
