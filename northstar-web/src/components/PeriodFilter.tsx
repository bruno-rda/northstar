import { Select } from '@/components/Select'
import { PERIOD_PRESETS, presetRange, type DateRange, type PeriodPreset } from '@/lib/periods'

export type PeriodValue = { preset: PeriodPreset; range: DateRange }

const inputClass =
  'rounded-md border border-border bg-surface-card text-sm text-text-primary px-2.5 py-1.5 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary'

// Month-oriented period picker, mirroring the admin Usage Analytics filter. Presets
// resolve to whole-month ranges; "Custom range" exposes free from/to date inputs.
export function PeriodFilter({
  value,
  onChange,
  asOf,
}: {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
  asOf: string
}) {
  const handlePreset = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      onChange({ preset, range: value.range })
      return
    }
    onChange({ preset, range: presetRange(preset, asOf) })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={value.preset}
        onChange={(e) => handlePreset(e.target.value as PeriodPreset)}
        className="py-1.5"
        aria-label="Period"
      >
        {PERIOD_PRESETS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </Select>

      {value.preset === 'custom' && (
        <>
          <input
            type="date"
            value={value.range.start}
            max={value.range.end}
            onChange={(e) => onChange({ preset: 'custom', range: { ...value.range, start: e.target.value || value.range.start } })}
            className={inputClass}
            aria-label="From date"
          />
          <span className="text-text-muted text-sm">–</span>
          <input
            type="date"
            value={value.range.end}
            min={value.range.start}
            onChange={(e) => onChange({ preset: 'custom', range: { ...value.range, end: e.target.value || value.range.end } })}
            className={inputClass}
            aria-label="To date"
          />
        </>
      )}
    </div>
  )
}
