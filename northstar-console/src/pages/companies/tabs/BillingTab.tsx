import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil } from 'lucide-react'
import { updateBillingConfig, updateBillingStatus } from '@/api'
import type { CompanyBillingConfig } from '@/api'
import { Badge } from '@/components/Badge'
import { Card, CardHeader } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { useToastStore } from '@/stores/toastStore'
import { formatCurrency, formatPct, formatPeriodMonth } from '@/lib/formatters'
import { getBillingConfigOptions, getBillingRecordOptions } from '@/api/@tanstack/react-query.gen'
import { invalidateOperations } from '@/lib/queryKeys'
import { isNotFound } from '@/lib/errors'
import { ErrorState } from '@/components/ErrorState'
import { inputClass } from '@/lib/forms'

// ─── Month selector helper ────────────────────────────────────────────────────

function currentPeriodMonth() {
  // Show the previous month's billing since current month isn't complete. Day 1 avoids
  // setMonth overflow (Mar 31 − 1 month would land on Mar 3).
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  )
}

// ─── Edit config modal ────────────────────────────────────────────────────────

const configSchema = z.object({
  platform_fee_amount: z.number({ message: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  revenue_share_pct: z.number({ message: 'Enter a number' }).min(0).max(100, 'Must be 0–100'),
})
type ConfigFormValues = z.infer<typeof configSchema>

type EditConfigModalProps = {
  open: boolean
  onClose: () => void
  companyId: string
  // null = no agreement configured yet; the form then starts blank rather than at 0.
  config: CompanyBillingConfig | null
}

function EditConfigModal({ open, onClose, companyId, config }: EditConfigModalProps) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    values: config
      ? { platform_fee_amount: Number(config.platform_fee_amount), revenue_share_pct: Number(config.revenue_share_pct) }
      : undefined,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: ConfigFormValues) => updateBillingConfig({
      path: { company_id: companyId },
      body: { platform_fee_amount: v.platform_fee_amount, revenue_share_pct: v.revenue_share_pct },
    }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getBillingRecord', 'getBillingConfig'])
      addToast('Billing config updated', 'success')
      onClose()
    },
    onError: () => addToast('Failed to update billing config', 'error'),
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Edit Billing Configuration">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="bc-fee">
              Monthly platform fee (USD)
            </label>
            <input
              id="bc-fee"
              type="number"
              step="0.01"
              min="0"
              {...register('platform_fee_amount', { valueAsNumber: true })}
              className={inputClass(!!errors.platform_fee_amount)}
            />
            {errors.platform_fee_amount && <p className="mt-1 text-xs text-status-critical">{errors.platform_fee_amount.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="bc-pct">
              Revenue share (%)
            </label>
            <input
              id="bc-pct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              {...register('revenue_share_pct', { valueAsNumber: true })}
              className={inputClass(!!errors.revenue_share_pct)}
            />
            {errors.revenue_share_pct && <p className="mt-1 text-xs text-status-critical">{errors.revenue_share_pct.message}</p>}
            <p className="mt-1 text-xs text-text-muted">Applied to net sales on the channels NORTHSTAR operates.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
            {isPending ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Confirm status change modal ─────────────────────────────────────────────

type ConfirmStatusModalProps = {
  status: 'invoiced' | 'paid' | null
  periodLabel: string
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmStatusModal({ status, periodLabel, isPending, onCancel, onConfirm }: ConfirmStatusModalProps) {
  const label = status === 'paid' ? 'Paid' : 'Invoiced'

  return (
    <Modal open={status !== null} onClose={onCancel} title={`Mark as ${label}?`}>
      <p className="text-sm text-text-primary">
        This marks {periodLabel} billing as <span className="font-medium">{label}</span>. This status can't be reverted once set.
      </p>
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
          {isPending ? 'Saving…' : `Mark as ${label}`}
        </button>
      </div>
    </Modal>
  )
}

// ─── Billing tab ──────────────────────────────────────────────────────────────

export default function BillingTab() {
  const { companyId } = useParams<{ companyId: string }>()
  const [periodMonth] = useState(currentPeriodMonth)
  const [configOpen, setConfigOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<'invoiced' | 'paid' | null>(null)
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const recordOptions = getBillingRecordOptions({ path: { company_id: companyId ?? '' }, query: { period_month: periodMonth } })
  const { data: record, isLoading, isError, error, refetch } = useQuery({ ...recordOptions, enabled: Boolean(companyId), retry: false })

  const configQuery = useQuery({
    ...getBillingConfigOptions({ path: { company_id: companyId ?? '' } }),
    enabled: Boolean(companyId),
    retry: false,
  })
  // 404 means no agreement yet; any other failure must block editing so it can't be overwritten blind.
  const configMissing = configQuery.isError && isNotFound(configQuery.error)
  const config = configQuery.data ?? null
  const canEditConfig = Boolean(config) || configMissing

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: (status: 'invoiced' | 'paid') => updateBillingStatus({
      path: { company_id: companyId!, billing_record_id: record!.id },
      body: { status },
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(recordOptions.queryKey, updated)
      addToast(`Billing marked as ${updated.status}`, 'success')
      setConfirmTarget(null)
    },
    onError: () => addToast('Failed to update billing status', 'error'),
  })

  const nextStatus = record?.status === 'pending' ? 'invoiced' : record?.status === 'invoiced' ? 'paid' : null

  if (!companyId) return null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Billing config (always shown, even without a record) ─── */}
      <Card>
        <CardHeader
          title="Commercial Agreement"
          action={
            <button
              onClick={() => setConfigOpen(true)}
              disabled={!canEditConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil size={14} />
              Edit
            </button>
          }
        />
        {configQuery.isLoading ? (
          <Skeleton className="h-5 w-48" />
        ) : config ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Field label="Platform fee / mo" value={formatCurrency(config.platform_fee_amount)} />
            <Field label="Revenue share" value={formatPct(config.revenue_share_pct)} />
          </div>
        ) : configMissing ? (
          <p className="text-sm text-text-muted italic">No commercial agreement configured yet.</p>
        ) : (
          <ErrorState title="Couldn't load the commercial agreement" error={configQuery.error} onRetry={() => void configQuery.refetch()} compact />
        )}
      </Card>

      {/* ── Most recent completed month ───────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {formatPeriodMonth(periodMonth)}
            </h2>
            <p className="text-sm text-text-muted mt-0.5">Most recent completed billing month</p>
          </div>
          {record && (
            <div className="flex items-center gap-3">
              <Badge value={record.status} />
              {nextStatus && (
                <button
                  onClick={() => setConfirmTarget(nextStatus)}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as {nextStatus === 'invoiced' ? 'Invoiced' : 'Paid'}
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
        )}

        {isError && isNotFound(error) && (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">No billing record for this period yet.</p>
          </div>
        )}
        {isError && !isNotFound(error) && (
          <ErrorState title="Couldn't load this month's billing" error={error} onRetry={() => void refetch()} compact />
        )}

        {record && (
          <div className="grid grid-cols-2 gap-6 mb-6">
            <Field label="Period revenue" value={formatCurrency(record.period_revenue)} />
            <Field label="Revenue share amount" value={formatCurrency(record.revenue_share_amount)} />
          </div>
        )}
      </Card>

      <EditConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        companyId={companyId}
        config={config}
      />

      <ConfirmStatusModal
        status={confirmTarget}
        periodLabel={formatPeriodMonth(periodMonth)}
        isPending={isUpdatingStatus}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && updateStatus(confirmTarget)}
      />
    </div>
  )
}
