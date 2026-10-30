import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useAddCompanyMember, useCompanyMembers, useRemoveCompanyMember, useUpdateMemberAccess } from '@/hooks/useTeam'
import { usePermissions } from '@/hooks/usePermissions'
import { Permission } from '@/api'
import type { MembershipWithUser, PermissionDefinition } from '@/api'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/lib/formatters'
import { getErrorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/ErrorState'

function inputClass(hasError?: boolean) {
  return `w-full px-3 py-2 rounded-md border text-sm text-text-primary bg-surface-card placeholder:text-text-muted
    focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors
    ${hasError ? 'border-status-critical' : 'border-border'}`
}

// Groups catalog entries by their `group`, preserving first-seen order.
function groupDefinitions(definitions: PermissionDefinition[]) {
  const order: string[] = []
  const byGroup = new Map<string, PermissionDefinition[]>()
  for (const def of definitions) {
    if (!byGroup.has(def.group)) {
      byGroup.set(def.group, [])
      order.push(def.group)
    }
    byGroup.get(def.group)!.push(def)
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }))
}

function PermissionChecklist({
  value,
  onChange,
  error,
}: {
  value: Permission[]
  onChange: (permissions: Permission[]) => void
  error?: string
}) {
  const { data: definitions, isLoading, isError, error: loadError, refetch } = usePermissions()
  const toggle = (perm: Permission) =>
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm])

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        Permissions <span className="text-status-critical">*</span>
      </label>
      {isLoading ? (
        <p className="text-sm text-text-muted">Loading permissions…</p>
      ) : isError || !definitions ? (
        <ErrorState title="Couldn't load permissions" error={loadError} onRetry={() => void refetch()} compact />
      ) : (
        <div className="flex flex-col gap-3">
          {groupDefinitions(definitions).map(({ group, items }) => (
            <div key={group}>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">{group}</p>
              <div className="flex flex-col gap-1.5">
                {items.map((def) => (
                  <label key={def.key} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.includes(def.key)}
                      onChange={() => toggle(def.key)}
                      className="rounded border-border text-accent-primary focus:ring-accent-primary/50"
                    />
                    {def.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-status-critical">{error}</p>}
    </div>
  )
}

const permissionsField = z
  .array(z.enum(Object.values(Permission) as [Permission, ...Permission[]]))
  .min(1, 'Select at least one permission')
  .refine((perms) => perms.includes(Permission.VIEW_GENERAL) || perms.includes(Permission.VIEW_MARKETING), {
    message: 'Select at least one area to view',
  })

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  permissions: permissionsField,
})
type InviteFormValues = z.infer<typeof inviteSchema>

function InviteModal({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const addToast = useToastStore((s) => s.addToast)
  const addMember = useAddCompanyMember(companyId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', permissions: [Permission.VIEW_GENERAL] },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (v: InviteFormValues) => {
    addMember.mutate(
      { email: v.email, permissions: v.permissions },
      {
        onSuccess: () => {
          addToast('Invite sent', 'success')
          handleClose()
        },
        onError: (err) => {
          addToast(getErrorMessage(err, 'Failed to invite'), 'error')
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Invite">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="invite-email">
              Email <span className="text-status-critical">*</span>
            </label>
            <input
              id="invite-email"
              type="email"
              {...register('email')}
              className={inputClass(!!errors.email)}
              placeholder="e.g. maria@company.com"
            />
            {errors.email && <p className="mt-1 text-xs text-status-critical">{errors.email.message}</p>}
          </div>
          <Controller
            control={control}
            name="permissions"
            render={({ field }) => (
              <PermissionChecklist
                value={field.value}
                onChange={field.onChange}
                error={errors.permissions?.message}
              />
            )}
          />
          <p className="text-xs text-text-muted bg-surface-base border border-border rounded-md px-3 py-2">
            The invited person receives access and can log in directly — no separate acceptance step.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={addMember.isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {addMember.isPending ? 'Inviting…' : 'Send Invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const editSchema = z.object({ permissions: permissionsField })
type EditFormValues = z.infer<typeof editSchema>

function EditAccessModal({
  open,
  onClose,
  companyId,
  member,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  member: MembershipWithUser
}) {
  const addToast = useToastStore((s) => s.addToast)
  const updateAccess = useUpdateMemberAccess(companyId)

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: { permissions: member.permissions },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = (v: EditFormValues) => {
    updateAccess.mutate(
      { membershipId: member.id, permissions: v.permissions },
      {
        onSuccess: () => {
          addToast('Access updated', 'success')
          handleClose()
        },
        onError: (err) => {
          addToast(getErrorMessage(err, 'Failed to update access'), 'error')
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit Access — ${member.user.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <PermissionChecklist
              value={field.value}
              onChange={field.onChange}
              error={errors.permissions?.message}
            />
          )}
        />
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateAccess.isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {updateAccess.isPending ? 'Saving…' : 'Save Access'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RemoveMemberModal({
  open,
  onClose,
  companyId,
  member,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  member: MembershipWithUser
}) {
  const addToast = useToastStore((s) => s.addToast)
  const removeMember = useRemoveCompanyMember(companyId)

  const handleRemove = () => {
    removeMember.mutate(member.id, {
      onSuccess: () => {
        addToast(`${member.user.name} removed`, 'success')
        onClose()
      },
      onError: (err) => {
        addToast(getErrorMessage(err, 'Cannot remove this person'), 'error')
      },
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Remove access">
      <p className="text-sm text-text-primary mb-2">
        Remove <strong>{member.user.name}</strong> ({member.user.email}) from this company?
      </p>
      <p className="text-sm text-text-muted">This revokes their access immediately.</p>
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">
          Cancel
        </button>
        <button
          onClick={handleRemove}
          disabled={removeMember.isPending}
          className="px-4 py-2 rounded-md text-sm font-medium bg-status-critical text-text-inverse hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {removeMember.isPending ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Modal>
  )
}

export default function TeamPage() {
  const { companyId } = useCompanyContext()
  const currentUserId = useAuthStore((s) => s.currentUser?.id)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MembershipWithUser | null>(null)
  const [removingMember, setRemovingMember] = useState<MembershipWithUser | null>(null)

  const { data: members, isLoading, isError, error, refetch } = useCompanyMembers(companyId)
  const { data: definitions } = usePermissions()
  const labelFor = (key: Permission) => definitions?.find((d) => d.key === key)?.label ?? key

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Team</h1>
            <p className="text-sm text-text-muted mt-1">
              {members?.length ?? 0} {members?.length === 1 ? 'person' : 'people'} with access
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 transition-all"
          >
            <UserPlus size={15} aria-hidden />
            Invite
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load your team" error={error} onRetry={() => void refetch()} />
        ) : !members || members.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p className="text-sm">No one has access yet. Invite someone to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_100px_110px]">
            <div className="col-span-4 grid grid-cols-subgrid pb-3 border-b border-border">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Name</span>
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Access</span>
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Added</span>
              <span />
            </div>
            {members.map((m) => {
              const isYou = m.user_id === currentUserId
              return (
                <div key={m.id} className="col-span-4 grid grid-cols-subgrid items-center py-5 border-b border-border last:border-b-0">
                  <div className="min-w-0 pr-4">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {m.user.name}
                      {isYou && <span className="font-normal text-text-muted"> (you)</span>}
                    </p>
                    <p className="text-xs text-text-muted truncate mt-0.5">{m.user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 pr-4">
                    {m.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center px-2 py-0.5 bg-surface-base border border-border rounded-md text-xs text-text-primary font-medium"
                      >
                        {labelFor(p)}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">{formatDate(m.created_at)}</span>
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => setEditingMember(m)}
                      className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setRemovingMember(m)}
                      className="text-xs font-medium text-text-muted hover:text-status-critical transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} companyId={companyId} />
      {editingMember && (
        <EditAccessModal open={Boolean(editingMember)} onClose={() => setEditingMember(null)} companyId={companyId} member={editingMember} />
      )}
      {removingMember && (
        <RemoveMemberModal open={Boolean(removingMember)} onClose={() => setRemovingMember(null)} companyId={companyId} member={removingMember} />
      )}
    </>
  )
}
