import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
import { useCompanyMembers } from '@/hooks/useCompanyMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { addCompanyMember, updateMemberAccess, removeCompanyMember } from '@/api'
import { Permission } from '@/api'
import type { MembershipWithUser, PermissionDefinition } from '@/api'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/lib/formatters'
import { invalidateOperations } from '@/lib/queryKeys'
import { getErrorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/ErrorState'
import { inputClass } from '@/lib/forms'

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

// ─── Permission checklist (used in both Add and Edit forms) ──────────────────

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

// Default for a brand-new user — staff typically provision an owner during onboarding.
const DEFAULT_NEW_USER_PERMISSIONS: Permission[] = [
  Permission.VIEW_GENERAL,
  Permission.CREATE_GENERAL_REPORT,
  Permission.MANAGE_INTEGRATIONS,
  Permission.MANAGE_PEOPLE,
  Permission.MANAGE_BILLING,
  Permission.TRANSFER_OWNERSHIP,
]

// ─── Add User modal ───────────────────────────────────────────────────────────

const addSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  permissions: permissionsField,
})
type AddFormValues = z.infer<typeof addSchema>

function AddUserModal({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: '', email: '', permissions: DEFAULT_NEW_USER_PERMISSIONS },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: AddFormValues) => addCompanyMember({
      path: { company_id: companyId },
      body: { name: v.name, email: v.email, permissions: v.permissions },
    }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getCompanyMembers'])
      addToast('User added', 'success')
      reset()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to add user')
      addToast(msg, 'error')
    },
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Add User">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="au-name">
              Full name <span className="text-status-critical">*</span>
            </label>
            <input id="au-name" {...register('name')} className={inputClass(!!errors.name)} placeholder="e.g. María García" />
            {errors.name && <p className="mt-1 text-xs text-status-critical">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="au-email">
              Email <span className="text-status-critical">*</span>
            </label>
            <input id="au-email" type="email" {...register('email')} className={inputClass(!!errors.email)} placeholder="e.g. maria@company.com" />
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
            The user will receive account access and can log in to the client app immediately.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
            {isPending ? 'Adding…' : 'Add User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Access modal ────────────────────────────────────────────────────────

const editSchema = z.object({ permissions: permissionsField })
type EditFormValues = z.infer<typeof editSchema>

function EditAccessModal({
  open, onClose, companyId, member,
}: {
  open: boolean; onClose: () => void; companyId: string; member: MembershipWithUser
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { handleSubmit, reset, control, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: { permissions: member.permissions },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: EditFormValues) => updateMemberAccess({
      path: { company_id: companyId, membership_id: member.id },
      body: { permissions: v.permissions },
    }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getCompanyMembers'])
      addToast('Access updated', 'success')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed to update access')
      addToast(msg, 'error')
    },
  })

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit Access — ${member.user.name}`}>
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
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
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
            {isPending ? 'Saving…' : 'Save Access'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Remove confirm modal ─────────────────────────────────────────────────────

function RemoveUserModal({
  open, onClose, companyId, member,
}: {
  open: boolean; onClose: () => void; companyId: string; member: MembershipWithUser
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { mutate, isPending } = useMutation({
    mutationFn: () => removeCompanyMember({ path: { company_id: companyId, membership_id: member.id } }),
    onSuccess: () => {
      void invalidateOperations(queryClient, companyId, ['getCompanyMembers'])
      addToast(`${member.user.name} removed`, 'success')
      onClose()
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Cannot remove user')
      addToast(msg, 'error')
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Remove User">
      <p className="text-sm text-text-primary mb-2">
        Remove <strong>{member.user.name}</strong> ({member.user.email}) from this company?
      </p>
      <p className="text-sm text-text-muted">
        This revokes their access immediately. If they belong to other companies, those memberships are unaffected.
      </p>
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="px-4 py-2 rounded-md text-sm font-medium bg-status-critical text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isPending ? 'Removing…' : 'Remove User'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────

export default function UsersTab() {
  const { companyId } = useParams<{ companyId: string }>()
  const [addOpen, setAddOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MembershipWithUser | null>(null)
  const [removingMember, setRemovingMember] = useState<MembershipWithUser | null>(null)

  const { data: members, isLoading, isError, error, refetch } = useCompanyMembers(companyId ?? '')
  const { data: definitions } = usePermissions()
  const labelFor = (key: Permission) => definitions?.find((d) => d.key === key)?.label ?? key

  if (!companyId) return null

  if (isError) {
    return (
      <Card>
        <ErrorState title="Couldn't load this company's users" error={error} onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Users</h2>
            <p className="text-sm text-text-muted mt-0.5">{members?.length ?? 0} member{members?.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:opacity-90 transition-opacity"
          >
            <UserPlus size={15} aria-hidden />
            Add User
          </button>
        </div>

        {!members || members.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <UserPlus size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No users yet. Add a user to give them access to the client app.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-4 py-4 first:pt-0">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate">{m.user.name}</span>
                  <span className="text-xs text-text-muted truncate">{m.user.email}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {m.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-base border border-border rounded-md text-xs text-text-primary font-medium"
                      >
                        {labelFor(p)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <span className="text-xs text-text-muted">{formatDate(m.created_at)}</span>
                  <button
                    onClick={() => setEditingMember(m)}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-base rounded transition-colors"
                    aria-label={`Edit access for ${m.user.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setRemovingMember(m)}
                    className="p-1.5 text-text-muted hover:text-status-critical hover:bg-status-critical-bg rounded transition-colors"
                    aria-label={`Remove ${m.user.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} companyId={companyId} />
      {editingMember && (
        <EditAccessModal
          open={Boolean(editingMember)}
          onClose={() => setEditingMember(null)}
          companyId={companyId}
          member={editingMember}
        />
      )}
      {removingMember && (
        <RemoveUserModal
          open={Boolean(removingMember)}
          onClose={() => setRemovingMember(null)}
          companyId={companyId}
          member={removingMember}
        />
      )}
    </>
  )
}
