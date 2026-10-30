import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStrategicContext } from '@/hooks/useStrategicContext'
import { updateStrategicContextSection } from '@/api'
import { getStaffById } from '@/lib/staff'
import type { StrategicDoc, StrategicDocKey } from '@/api'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { useToastStore } from '@/stores/toastStore'
import { formatDateTime } from '@/lib/formatters'
import { invalidateOperations } from '@/lib/queryKeys'
import { ErrorState } from '@/components/ErrorState'

// ─── Document configuration ────────────────────────────────────────────────────

type DocConfig = {
  key: StrategicDocKey
  title: string
  description: string
}

const DOCS: DocConfig[] = [
  {
    key: 'icp_justification',
    title: 'ICP Justification',
    description: 'Which NORTHSTAR client archetype — Operador Estancado or Catalizador Digital — this company fits, and why. Used to calibrate report tone.',
  },
  {
    key: 'brand_brief',
    title: 'Brand Brief',
    description: 'Company history, founders, and what motivated them to start the brand.',
  },
  {
    key: 'brand_icp',
    title: 'Brand ICPs',
    description: "This brand's own ideal customer: who they target, their pain points, and buying triggers.",
  },
  {
    key: 'market_research',
    title: 'Market Research',
    description: "Competitive landscape, market sizing, and findings from NORTHSTAR's research process.",
  },
  {
    key: 'product_specifications',
    title: 'Technical Product Specifications',
    description: 'Price, cost, and naming details for key products/SKUs.',
  },
  {
    key: 'product_documentation',
    title: 'Technical Product Documentation',
    description: 'Physical product details — weight, taste, color, and other descriptive attributes.',
  },
]

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Attribution({
  updatedAt,
  updatedByStaffId,
  bordered = true,
}: {
  updatedAt: string | null
  updatedByStaffId: string | null
  bordered?: boolean
}) {
  if (!updatedAt) return null
  const staff = updatedByStaffId ? getStaffById(updatedByStaffId) : null
  return (
    <p className={bordered
      ? 'text-xs text-text-muted mt-4 pt-4 border-t border-border'
      : 'text-sm text-text-muted mt-3'}
    >
      Updated {formatDateTime(updatedAt)}
      {staff ? ` by ${staff.name}` : ''}
    </p>
  )
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocCard({
  config, doc, onView, onEdit,
}: {
  config: DocConfig; doc: StrategicDoc; onView: () => void; onEdit: () => void
}) {
  const hasContent = Boolean(doc.content)

  return (
    <Card
      className="cursor-pointer transition-all hover:border-accent-primary/50 hover:shadow-md"
      onClick={hasContent ? onView : onEdit}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h2 className="text-base font-semibold text-text-primary">{config.title}</h2>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
      </div>

      {!hasContent && (
        <p className="text-sm text-text-muted italic mt-3">Not filled in yet — click Edit to add</p>
      )}

      <Attribution updatedAt={doc.updated_at} updatedByStaffId={doc.updated_by_staff_id} bordered={false} />
    </Card>
  )
}

// ─── View modal (read-only, for long content) ─────────────────────────────────

function DocViewModal({
  onClose, onEdit, config, doc,
}: {
  onClose: () => void; onEdit: () => void; config: DocConfig; doc: StrategicDoc
}) {
  return (
    <Modal open onClose={onClose} title={config.title} size="lg">
      <div className="markdown-body max-h-[65vh] overflow-y-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content ?? ''}</ReactMarkdown>
      </div>
      <Attribution updatedAt={doc.updated_at} updatedByStaffId={doc.updated_by_staff_id} />
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
        >
          Close
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 transition-opacity"
        >
          <Pencil size={14} aria-hidden />
          Edit
        </button>
      </div>
    </Modal>
  )
}

// ─── Edit modal (shared by all six documents) ─────────────────────────────────

const docSchema = z.object({ content: z.string().optional() })
type DocFormValues = z.infer<typeof docSchema>

function DocEditModal({
  onClose, companyId, config, doc,
}: {
  onClose: () => void; companyId: string; config: DocConfig; doc: StrategicDoc
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { register, handleSubmit, control } = useForm<DocFormValues>({
    resolver: zodResolver(docSchema),
    defaultValues: { content: doc.content ?? '' },
  })
  const watchedContent = useWatch({ control, name: 'content' })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: DocFormValues) => updateStrategicContextSection({
      path: { company_id: companyId, section: config.key },
      body: { content: v.content?.trim() || null },
    }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getStrategicContext'])
      addToast(`${config.title} updated`, 'success')
      onClose()
    },
    onError: () => addToast(`Failed to update ${config.title}`, 'error'),
  })

  return (
    <Modal open onClose={onClose} title={`Edit ${config.title}`} size="xl">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <p className="text-sm text-text-muted mb-4">{config.description}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              Markdown
            </label>
            <textarea
              {...register('content')}
              className="w-full h-[420px] px-3 py-2 rounded-md border border-border text-sm text-text-primary bg-surface-card placeholder:text-text-muted font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              placeholder="Write in markdown…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              Preview
            </label>
            <div className="h-[420px] px-3 py-2 rounded-md border border-border bg-surface-base overflow-y-auto">
              {watchedContent ? (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{watchedContent}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-text-muted italic">Preview will appear here as you type…</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Context tab ──────────────────────────────────────────────────────────────

export default function ContextTab() {
  const { companyId } = useParams<{ companyId: string }>()
  const [editingKey, setEditingKey] = useState<StrategicDocKey | null>(null)
  const [viewingKey, setViewingKey] = useState<StrategicDocKey | null>(null)
  const { data: ctx, isLoading, isError, error, refetch } = useStrategicContext(companyId ?? '')

  if (isError) {
    return (
      <Card>
        <ErrorState title="Couldn't load the strategic context" error={error} onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (isLoading || !ctx || !companyId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DOCS.map((d) => (
          <Card key={d.key}>
            <Skeleton className="h-5 w-32 mb-5" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-16 w-full" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const editingConfig = DOCS.find((d) => d.key === editingKey)
  const viewingConfig = DOCS.find((d) => d.key === viewingKey)

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DOCS.map((config) => (
          <DocCard
            key={config.key}
            config={config}
            doc={ctx[config.key]}
            onView={() => setViewingKey(config.key)}
            onEdit={() => setEditingKey(config.key)}
          />
        ))}
      </div>

      {viewingConfig && (
        <DocViewModal
          onClose={() => setViewingKey(null)}
          onEdit={() => { setViewingKey(null); setEditingKey(viewingConfig.key) }}
          config={viewingConfig}
          doc={ctx[viewingConfig.key]}
        />
      )}

      {editingConfig && (
        <DocEditModal
          onClose={() => setEditingKey(null)}
          companyId={companyId}
          config={editingConfig}
          doc={ctx[editingConfig.key]}
        />
      )}
    </div>
  )
}
