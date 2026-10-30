import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, ArrowRightLeft } from 'lucide-react'
import { useCompany } from '@/hooks/useCompany'
import { updateCompanyProfile, updateCompanyStatus } from '@/api'
import { getStaffById } from '@/lib/staff'
import { Archetype, CompanyStatus } from '@/api'
import { Badge } from '@/components/Badge'
import { Card, CardHeader } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { Skeleton } from '@/components/Skeleton'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/lib/formatters'
import { COUNTRIES } from '@/lib/countries'
import { invalidateOperations } from '@/lib/queryKeys'
import { ErrorState } from '@/components/ErrorState'
import { inputClass, parseProductLines } from '@/lib/forms'
import { COMPANY_STATUS_LABELS } from '@/lib/labels'

// ─── Lifecycle transition rules ───────────────────────────────────────────────
// §7.1 in the business logic doc is referenced but not expanded. These transitions
// are inferred from §6 (lifecycle states) and §5 (operational flows).
// See docs/DECISIONS.md D-010.
const VALID_TRANSITIONS: Record<CompanyStatus, CompanyStatus[]> = {
  created: ['onboarding', 'suspended', 'churned'],
  onboarding: ['active', 'suspended', 'churned'],
  active: ['suspended', 'churned'],
  suspended: ['active', 'churned'],
  churned: [],
}

const ARCHETYPE_LABELS: Record<Archetype, string> = {
  operador_estancado: 'Operador Estancado',
  catalizador_digital: 'Catalizador Digital',
}

// ─── Shared field display ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  )
}

// ─── Edit Profile modal ───────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  country: z.string().min(1, 'Country is required'),
  industry: z.string().optional(),
  niche: z.string().optional(),
  products: z.string().optional(),
  archetype: z.union([z.literal(''), z.enum(Archetype)]).optional(),
})
type EditFormValues = z.infer<typeof editSchema>

type EditProfileModalProps = {
  open: boolean
  onClose: () => void
  companyId: string
}

function EditProfileModal({ open, onClose, companyId }: EditProfileModalProps) {
  const { data: company } = useCompany(companyId)
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const defaultValues: EditFormValues = {
    name: company?.name ?? '',
    country: company?.country ?? '',
    industry: company?.industry ?? '',
    niche: company?.niche ?? '',
    products: company?.key_products.join('\n') ?? '',
    archetype: (company?.archetype ?? ''),
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: defaultValues,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: EditFormValues) =>
      updateCompanyProfile({
        path: { company_id: companyId },
        body: {
          name: v.name,
          country: v.country,
          industry: v.industry?.trim() || undefined,
          niche: v.niche?.trim() || undefined,
          key_products: parseProductLines(v.products),
          archetype: (v.archetype || null),
        },
      }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getCompany'])
      void invalidateOperations(queryClient, null, ['getCompanies'])
      addToast('Profile updated', 'success')
      onClose()
    },
    onError: () => {
      addToast('Failed to update profile', 'error')
    },
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Edit Profile" size="lg">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-name">
              Company name <span className="text-status-critical">*</span>
            </label>
            <input id="ep-name" {...register('name')} className={inputClass(!!errors.name)} />
            {errors.name && <p className="mt-1 text-xs text-status-critical">{errors.name.message}</p>}
          </div>

          {/* Country */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-country">
              Country <span className="text-status-critical">*</span>
            </label>
            <Select id="ep-country" {...register('country')} className="w-full" hasError={!!errors.country}>
              <option value="">Select a country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </Select>
            {errors.country && <p className="mt-1 text-xs text-status-critical">{errors.country.message}</p>}
          </div>

          {/* Industry */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-industry">
              Industry
            </label>
            <input id="ep-industry" {...register('industry')} className={inputClass()} placeholder="e.g. Food & Beverage" />
          </div>

          {/* Niche */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-niche">
              Niche
            </label>
            <input id="ep-niche" {...register('niche')} className={inputClass()} placeholder="e.g. Yerba mate & infusions" />
          </div>

          {/* Key products */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-products">
              Key products <span className="text-text-muted font-normal">(up to 3, one per line)</span>
            </label>
            <textarea
              id="ep-products"
              {...register('products')}
              rows={3}
              className={`${inputClass()} resize-none`}
              placeholder={'Yerba mate blends\nBombillas\nTermo sets'}
            />
          </div>

          {/* Archetype */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ep-archetype">
              Client archetype
            </label>
            <Select
              id="ep-archetype"
              {...register('archetype')}
              className="w-full"
            >
              <option value="">Not assigned</option>
              <option value="operador_estancado">Operador Estancado</option>
              <option value="catalizador_digital">Catalizador Digital</option>
            </Select>
            <p className="mt-1 text-xs text-text-muted">
              Used to calibrate report tone. Doesn't affect data or KPI computation.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Change Status modal ──────────────────────────────────────────────────────

const changeStatusSchema = z
  .object({
    status: z.enum(CompanyStatus),
    status_note: z.string().optional(),
  })
  .refine(
    (d) => !(d.status === 'suspended' && !d.status_note?.trim()),
    { message: 'An internal note is required when suspending a company', path: ['status_note'] },
  )
type ChangeStatusFormValues = z.infer<typeof changeStatusSchema>

type ChangeStatusModalProps = {
  open: boolean
  onClose: () => void
  companyId: string
  currentStatus: CompanyStatus
}

function ChangeStatusModal({ open, onClose, companyId, currentStatus }: ChangeStatusModalProps) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const validNextStatuses = VALID_TRANSITIONS[currentStatus]

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ChangeStatusFormValues>({
    resolver: zodResolver(changeStatusSchema),
    defaultValues: { status: validNextStatuses[0] ?? 'active', status_note: '' },
  })

  const watchedStatus = useWatch({ control, name: 'status' })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: ChangeStatusFormValues) =>
      updateCompanyStatus({
        path: { company_id: companyId },
        body: { status: v.status, status_note: v.status_note?.trim() || undefined },
      }),
    onSuccess: (updated) => {
      void invalidateOperations(queryClient, companyId, ['getCompany'])
      void invalidateOperations(queryClient, null, ['getCompanies'])
      addToast(`Status changed to ${COMPANY_STATUS_LABELS[updated.status]}`, 'success')
      reset()
      onClose()
    },
    onError: () => {
      addToast('Failed to change status', 'error')
    },
  })

  const handleClose = () => { reset(); onClose() }

  if (validNextStatuses.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Change Status">
        <p className="text-sm text-text-muted">
          <strong className="text-text-primary">Churned</strong> is a terminal status. No further transitions are available.
        </p>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
          >
            Close
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Change Lifecycle Status">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-md bg-surface-base border border-border">
            <span className="text-xs text-text-muted font-medium">Current:</span>
            <Badge value={currentStatus} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="cs-status">
              New status <span className="text-status-critical">*</span>
            </label>
            <Select
              id="cs-status"
              {...register('status')}
              hasError={!!errors.status}
              className="w-full"
            >
              {validNextStatuses.map((s) => (
                <option key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="cs-note">
              Internal note
              {watchedStatus === 'suspended' && (
                <span className="text-status-critical ml-1">*</span>
              )}
            </label>
            <textarea
              id="cs-note"
              {...register('status_note')}
              rows={3}
              className={`${inputClass(!!errors.status_note)} resize-none`}
              placeholder={
                watchedStatus === 'suspended'
                  ? 'e.g. Billing overdue since April 2026'
                  : 'Optional — for internal reference'
              }
            />
            {errors.status_note && (
              <p className="mt-1 text-xs text-status-critical">{errors.status_note.message}</p>
            )}
            <p className="mt-1 text-xs text-text-muted">Never visible to the client.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isPending ? 'Updating…' : 'Change Status'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

export default function ProfileTab() {
  const { companyId } = useParams<{ companyId: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const { data: company, isLoading, isError, error, refetch } = useCompany(companyId ?? '')

  if (isError) {
    return (
      <Card>
        <ErrorState title="Couldn't load this company's profile" error={error} onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (isLoading || !company) {
    return (
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <Skeleton className="h-5 w-24 mb-5" />
            <div className="grid grid-cols-2 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card><Skeleton className="h-24 w-full" /></Card>
        </div>
      </div>
    )
  }

  const createdBy = getStaffById(company.created_by_staff_id)
  const canChangeStatus = VALID_TRANSITIONS[company.status].length > 0

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ── Left: Profile ─────────────────────────────────────── */}
      <div className="col-span-2">
        <Card>
          <CardHeader
            title="Company Profile"
            action={
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
              >
                <Pencil size={14} aria-hidden />
                Edit
              </button>
            }
          />

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Company Name">
              <span className="font-medium">{company.name}</span>
            </Field>

            <Field label="Country">{company.country}</Field>

            <Field label="Industry">
              {company.industry ?? (
                <span className="text-text-muted italic">Not specified</span>
              )}
            </Field>

            <Field label="Niche">
              {company.niche ?? (
                <span className="text-text-muted italic">Not specified</span>
              )}
            </Field>

            <div className="col-span-2">
              <Field label="Key Products">
                {company.key_products.length > 0 ? (
                  <ul className="list-disc pl-5 mt-1 flex flex-col gap-1">
                    {company.key_products.map((p, i) => (
                      <li key={i} className="text-sm text-text-primary">{p}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-text-muted italic">Not specified</span>
                )}
              </Field>
            </div>

            <Field label="Client Archetype">
              {company.archetype ? (
                <span>{ARCHETYPE_LABELS[company.archetype]}</span>
              ) : (
                <span className="text-text-muted italic">Not assigned</span>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 mt-5 pt-5 border-t border-border">
            <Field label="Join Date">
              <span>{formatDate(company.join_date)}</span>
            </Field>

            <Field label="Created By">
              {createdBy ? (
                <span className="text-sm">{createdBy.name}</span>
              ) : (
                <span className="font-mono text-xs text-text-muted">{company.created_by_staff_id}</span>
              )}
            </Field>

            <Field label="Created At">
              <span>{formatDate(company.created_at)}</span>
            </Field>
          </div>

          {(company.industry === null || company.niche === null || company.key_products.length === 0) && (
            <p className="mt-5 text-xs text-status-warning bg-status-warning-bg px-3 py-2 rounded-md">
              Some profile fields are incomplete. Fill them in before generating reports.
            </p>
          )}
        </Card>
      </div>

      {/* ── Right: Status ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Lifecycle Status" />
          <div className="flex flex-col gap-4">
            <div>
              <Badge value={company.status} size="md" />
            </div>

            <Field label="Last Updated">
              <span>{formatDate(company.updated_at)}</span>
            </Field>

            {company.status_note && (
              <Field label="Internal Note">
                <p className="text-sm text-text-muted bg-surface-base border border-border rounded-md px-3 py-2">
                  {company.status_note}
                </p>
              </Field>
            )}

            <button
              onClick={() => setStatusOpen(true)}
              disabled={!canChangeStatus}
              title={!canChangeStatus ? 'Churned is a terminal status' : undefined}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRightLeft size={14} aria-hidden />
              Change Status
            </button>
          </div>
        </Card>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      {companyId && (
        <>
          <EditProfileModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            companyId={companyId}
          />
          <ChangeStatusModal
            open={statusOpen}
            onClose={() => setStatusOpen(false)}
            companyId={companyId}
            currentStatus={company.status}
          />
        </>
      )}
    </div>
  )
}
