import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useCompanies, type UseCompaniesParams } from '@/hooks/useCompanies'
import { useDebounce } from '@/hooks/useDebounce'
import { createCompany } from '@/api'
import { CompanyStatus } from '@/api'
import type { CompanyListItem } from '@/api'
import { Badge } from '@/components/Badge'
import { SkeletonRow } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/lib/formatters'
import { COUNTRIES } from '@/lib/countries'
import { invalidateOperations } from '@/lib/queryKeys'
import { parseProductLines } from '@/lib/forms'
import { COMPANY_STATUS_LABELS } from '@/lib/labels'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  country: z.string().min(1, 'Country is required'),
  industry: z.string().optional(),
  niche: z.string().optional(),
  products: z.string().optional(),
})
type CreateFormValues = z.infer<typeof createSchema>

// One product per line, up to 3.
// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortField = NonNullable<UseCompaniesParams['sort_by']>
type SortDir = NonNullable<UseCompaniesParams['sort_dir']>

function SortableHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField
  label: string
  sortField: SortField
  sortDir: SortDir
  onSort: (field: SortField) => void
}) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-text-muted uppercase tracking-wide hover:text-text-primary transition-colors"
    >
      {label}
      <SortIcon active={sortField === field} dir={sortDir} />
    </button>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={14} className="text-text-muted opacity-50" />
  return dir === 'asc'
    ? <ChevronUp size={14} className="text-text-primary" />
    : <ChevronDown size={14} className="text-text-primary" />
}

// ─── Unique industries from mock (in real life this would be an API call) ─────

const INDUSTRIES = [
  'Beauty',
  'Fashion',
  'Food & Beverage',
  'Health & Wellness',
  'Home & Living',
  'Home Decor',
  'Sports & Outdoors',
  'Technology',
]

const STATUS_OPTIONS = Object.values(CompanyStatus).map((value) => ({ value, label: COMPANY_STATUS_LABELS[value] }))

const PAGE_SIZE = 10

// ─── New Company form ─────────────────────────────────────────────────────────

function NewCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) })

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createCompany({
        body: {
          name: values.name,
          country: values.country,
          industry: values.industry || undefined,
          niche: values.niche || undefined,
          key_products: parseProductLines(values.products),
        },
      }),
    onSuccess: (company) => {
      void invalidateOperations(queryClient, null, ['getCompanies'])
      reset()
      onClose()
      void navigate(`/companies/${company.id}/profile`)
    },
    onError: () => {
      addToast('Failed to create company. Please try again.', 'error')
    },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Company">
      <form onSubmit={handleSubmit((v) => mutate(v))} noValidate>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="name">
              Company name <span className="text-status-critical">*</span>
            </label>
            <input
              id="name"
              {...register('name')}
              className="w-full px-3 py-2 rounded-md border border-border text-sm text-text-primary bg-surface-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              placeholder="e.g. Mate Largo"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-status-critical">{errors.name.message}</p>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="country">
              Country <span className="text-status-critical">*</span>
            </label>
            <Select id="country" {...register('country')} className="w-full" hasError={!!errors.country}>
              <option value="">Select a country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </Select>
            {errors.country && (
              <p className="mt-1 text-xs text-status-critical">{errors.country.message}</p>
            )}
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="industry">
              Industry
            </label>
            <input
              id="industry"
              {...register('industry')}
              className="w-full px-3 py-2 rounded-md border border-border text-sm text-text-primary bg-surface-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              placeholder="e.g. Food & Beverage"
            />
          </div>

          {/* Niche */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="niche">
              Niche
            </label>
            <input
              id="niche"
              {...register('niche')}
              className="w-full px-3 py-2 rounded-md border border-border text-sm text-text-primary bg-surface-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              placeholder="e.g. Yerba mate & infusions"
            />
          </div>

          {/* Key products */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="products">
              Key products <span className="text-text-muted font-normal">(up to 3, one per line)</span>
            </label>
            <textarea
              id="products"
              {...register('products')}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border text-sm text-text-primary bg-surface-card placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              placeholder={'Yerba mate blends\nBombillas\nTermo sets'}
            />
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
            {isPending ? 'Creating…' : 'Create Company'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function CompanyRow({ company }: { company: CompanyListItem }) {
  const navigate = useNavigate()
  return (
    <tr
      onClick={() => navigate(`/companies/${company.id}/profile`)}
      className="border-b border-border hover:bg-surface-base/60 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm font-medium text-text-primary">{company.name}</td>
      <td className="px-4 py-3 text-sm text-text-muted">{company.industry ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-text-muted">{company.country}</td>
      <td className="px-4 py-3">
        <Badge value={company.status} />
      </td>
      <td className="px-4 py-3 text-sm text-text-muted tabular-nums">
        {company.connected_integrations_count}
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">
        {formatDate(company.join_date)}
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">
        {company.last_report_generated_at ? formatDate(company.last_report_generated_at) : '—'}
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const debouncedSearch = useDebounce(searchInput, 300)

  const { data, isLoading, isError, refetch } = useCompanies({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    industry: industryFilter || undefined,
    sort_by: sortField,
    sort_dir: sortDir,
  })

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleFilterChange = () => setPage(1)

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter || industryFilter)

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('')
    setIndustryFilter('')
    setPage(1)
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Companies</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {data ? `${data.total} ${data.total === 1 ? 'company' : 'companies'}` : ''}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent-primary text-text-primary text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} aria-hidden />
          New Company
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden />
          <input
            type="search"
            placeholder="Search companies…"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); handleFilterChange() }}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-sm bg-surface-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as CompanyStatus | ''); handleFilterChange() }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        <Select
          value={industryFilter}
          onChange={(e) => { setIndustryFilter(e.target.value); handleFilterChange() }}
          aria-label="Filter by industry"
        >
          <option value="">All industries</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-text-muted hover:text-text-primary underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Companies">
            <thead>
              <tr className="border-b border-border bg-surface-base/50">
                <th className="px-4 py-3 text-left">
                  <SortableHeader field="name" label="Company" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Industry
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Country
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Integrations
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHeader field="join_date" label="Join Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Last Report
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle size={32} className="text-status-critical" aria-hidden />
                      <p className="text-sm text-text-muted">Failed to load companies.</p>
                      <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 text-sm font-medium text-text-primary hover:underline"
                      >
                        <RefreshCw size={14} aria-hidden />
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-text-muted">No companies match your filters.</p>
                        <button onClick={clearFilters} className="text-sm font-medium text-text-primary hover:underline">
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-text-muted">No companies yet.</p>
                        <button
                          onClick={() => setModalOpen(true)}
                          className="text-sm font-medium text-text-primary hover:underline"
                        >
                          Create the first company
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading && !isError && data?.items.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > PAGE_SIZE && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </div>

      <NewCompanyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
