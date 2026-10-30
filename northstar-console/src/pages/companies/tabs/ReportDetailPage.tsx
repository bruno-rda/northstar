import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Pencil, Trash2, Circle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useReport } from '@/hooks/useReport'
import { createActionItem, updateActionItem, deleteActionItem } from '@/api'
import { ActionItemOwner, ActionItemPriority, ActionItemStatus } from '@/api'
import type { ActionItem } from '@/api'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { Skeleton } from '@/components/Skeleton'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { invalidateOperations } from '@/lib/queryKeys'
import { getErrorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/ErrorState'
import { isNotFound } from '@/lib/errors'
import { inputClass } from '@/lib/forms'
import { AREA_LABELS, PERIOD_LABELS } from '@/lib/labels'

const PRIORITY_DOT = { high: 'bg-status-warning', medium: 'bg-text-muted', low: 'bg-accent-neutral' }

// ─── Add / Edit form ──────────────────────────────────────────────────────────

const itemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  owner: z.enum(ActionItemOwner),
  status: z.enum(ActionItemStatus),
  priority: z.enum(ActionItemPriority),
})
type ItemFormValues = z.infer<typeof itemSchema>

function ActionItemModal({
  open, onClose, companyId, reportId, item,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  reportId: string
  item?: ActionItem
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const isEdit = Boolean(item)

  const defaults: ItemFormValues = {
    title: item?.title ?? '',
    description: item?.description ?? '',
    owner: item?.owner ?? 'client',
    status: item?.status ?? 'pending',
    priority: item?.priority ?? 'medium',
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    values: defaults,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: ItemFormValues) =>
      isEdit
        ? updateActionItem({ path: { company_id: companyId, action_item_id: item!.id }, body: v })
        : createActionItem({ path: { company_id: companyId, report_id: reportId }, body: v }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getReport'])
      addToast(isEdit ? 'Action item updated' : 'Action item created', 'success')
      reset()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to save action item')
      addToast(msg, 'error')
    },
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Action Item' : 'New Action Item'}>
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ai-title">
              Title <span className="text-status-critical">*</span>
            </label>
            <input id="ai-title" {...register('title')} className={inputClass(!!errors.title)} placeholder="e.g. Restock best-selling SKU" />
            {errors.title && <p className="mt-1 text-xs text-status-critical">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ai-description">
              Description <span className="text-status-critical">*</span>
            </label>
            <textarea id="ai-description" {...register('description')} rows={3} className={inputClass(!!errors.description)} placeholder="Why this matters" />
            {errors.description && <p className="mt-1 text-xs text-status-critical">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ai-owner">Owner</label>
              <Select id="ai-owner" {...register('owner')} className="w-full">
                <option value="client">Client (needs them)</option>
                <option value="northstar">NORTHSTAR (we do it)</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ai-status">Status</label>
              <Select id="ai-status" {...register('status')} className="w-full">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="ai-priority">Priority</label>
              <Select id="ai-priority" {...register('priority')} className="w-full">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteActionItemModal({
  open, onClose, companyId, item,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  item: ActionItem
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteActionItem({ path: { company_id: companyId, action_item_id: item.id } }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getReport'])
      addToast('Action item deleted', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to delete action item')
      addToast(msg, 'error')
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Delete Action Item">
      <p className="text-sm text-text-primary mb-2">
        Delete <strong>{item.title}</strong>?
      </p>
      <p className="text-sm text-text-muted">This cannot be undone.</p>
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="px-4 py-2 rounded-md text-sm font-medium bg-status-critical text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isPending ? 'Deleting…' : 'Delete Item'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Action item row + panel ──────────────────────────────────────────────────

function StatusIndicator({ status }: { status: ActionItem['status'] }) {
  if (status === 'done') return <CheckCircle2 size={15} className="text-status-success shrink-0 mt-0.5" />
  if (status === 'in_progress') return <Loader2 size={15} className="text-status-info shrink-0 mt-0.5 animate-spin" />
  return <Circle size={15} className="text-text-muted shrink-0 mt-0.5" />
}

function ActionRow({
  item, onEdit, onDelete,
}: {
  item: ActionItem
  onEdit: () => void
  onDelete: () => void
}) {
  const done = item.status === 'done'
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <StatusIndicator status={item.status} />
        <div className="min-w-0">
          <p className={`text-sm font-medium text-text-primary ${done ? 'line-through text-text-muted' : ''}`}>{item.title}</p>
          <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
          {!done && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`} />
                {item.priority}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-base rounded transition-colors"
          aria-label={`Edit ${item.title}`}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-text-muted hover:text-status-critical hover:bg-status-critical-bg rounded transition-colors"
          aria-label={`Delete ${item.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function ActionPanel({
  title, subtitle, items, onEdit, onDelete,
}: {
  title: string
  subtitle: string
  items: ActionItem[]
  onEdit: (item: ActionItem) => void
  onDelete: (item: ActionItem) => void
}) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">Nothing here yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <ActionRow key={item.id} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Report detail page ───────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { companyId, reportId } = useParams<{ companyId: string; reportId: string }>()
  const { data: report, isLoading, isError, error, refetch } = useReport(companyId ?? '', reportId ?? '')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ActionItem | null>(null)
  const [deleting, setDeleting] = useState<ActionItem | null>(null)

  if (!companyId || !reportId) return null

  const backLink = (
    <Link to={`/companies/${companyId}/reports`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-5">
      <ArrowLeft size={14} /> Reports
    </Link>
  )

  if (isLoading) {
    return (
      <div>
        {backLink}
        <Skeleton className="h-6 w-64 mb-6" />
        <Card><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-3/4" /></Card>
      </div>
    )
  }

  if (isError && !isNotFound(error)) {
    return (
      <div>
        {backLink}
        <ErrorState title="Couldn't load this report" error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  if (!report) {
    return (
      <div>
        {backLink}
        <div className="flex flex-col items-center gap-3 py-24">
          <AlertCircle size={32} className="text-status-critical" />
          <p className="text-sm text-text-muted">Report not found.</p>
        </div>
      </div>
    )
  }

  const northstarItems = report.action_items.filter((a) => a.owner === 'northstar')
  const clientItems = report.action_items.filter((a) => a.owner === 'client')

  return (
    <div>
      {backLink}

      {/* Report header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {AREA_LABELS[report.area]} · {PERIOD_LABELS[report.period_type]} report
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {formatDate(report.period_start)} – {formatDate(report.period_end)} · Generated {formatDateTime(report.generated_at)}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={15} aria-hidden />
          New Action Item
        </button>
      </div>

      {/* Report content */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Report</h2>
        <div className="flex flex-col gap-4">
          {report.sections.map((s) => (
            <div key={s.key}>
              <h3 className="text-sm font-semibold text-text-primary mb-1">{s.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Action items */}
      <div className="grid gap-4 md:grid-cols-2">
        <ActionPanel
          title="What NORTHSTAR is doing"
          subtitle="Items the NORTHSTAR team owns"
          items={northstarItems}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
        <ActionPanel
          title="What needs the client"
          subtitle="Items the client owns"
          items={clientItems}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      </div>

      <ActionItemModal open={addOpen} onClose={() => setAddOpen(false)} companyId={companyId} reportId={reportId} />
      {editing && (
        <ActionItemModal
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          companyId={companyId}
          reportId={reportId}
          item={editing}
        />
      )}
      {deleting && (
        <DeleteActionItemModal
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          companyId={companyId}
          item={deleting}
        />
      )}
    </div>
  )
}
