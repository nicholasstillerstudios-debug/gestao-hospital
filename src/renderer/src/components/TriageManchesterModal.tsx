import { useEffect, useMemo, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { TriageBadge } from '@renderer/components/ui/Badge'
import {
  FLOWCHARTS,
  MANCHESTER_LABELS,
  MANCHESTER_TARGETS,
  colorFromVitals,
  combineColors,
  getFlowchart,
  suggestColor,
  type ManchesterColor
} from '@shared/manchester'
import type { AppointmentWithRefs, TriageRecord } from '@shared/types'

interface Props {
  appointment: AppointmentWithRefs
  onClose: () => void
  onSaved: () => void
}

interface VitalsState {
  systolicBp: string
  diastolicBp: string
  heartRate: string
  respRate: string
  spo2: string
  temperatureC: string
  glucoseMgDl: string
  painScale: string
  weightKg: string
  heightCm: string
}

const EMPTY_VITALS: VitalsState = {
  systolicBp: '',
  diastolicBp: '',
  heartRate: '',
  respRate: '',
  spo2: '',
  temperatureC: '',
  glucoseMgDl: '',
  painScale: '',
  weightKg: '',
  heightCm: ''
}

function parseNum(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function fromRecord(r: TriageRecord): VitalsState {
  return {
    systolicBp: r.systolicBp != null ? String(r.systolicBp) : '',
    diastolicBp: r.diastolicBp != null ? String(r.diastolicBp) : '',
    heartRate: r.heartRate != null ? String(r.heartRate) : '',
    respRate: r.respRate != null ? String(r.respRate) : '',
    spo2: r.spo2 != null ? String(r.spo2) : '',
    temperatureC: r.temperatureC != null ? String(r.temperatureC) : '',
    glucoseMgDl: r.glucoseMgDl != null ? String(r.glucoseMgDl) : '',
    painScale: r.painScale != null ? String(r.painScale) : '',
    weightKg: r.weightKg != null ? String(r.weightKg) : '',
    heightCm: r.heightCm != null ? String(r.heightCm) : ''
  }
}

const COLOR_DOT: Record<ManchesterColor, string> = {
  vermelho: 'bg-red-600',
  laranja: 'bg-orange-500',
  amarelo: 'bg-yellow-400',
  verde: 'bg-emerald-500',
  azul: 'bg-sky-500'
}

const COLOR_BG: Record<ManchesterColor, string> = {
  vermelho: 'bg-red-600 text-white',
  laranja: 'bg-orange-500 text-white',
  amarelo: 'bg-yellow-400 text-slate-900',
  verde: 'bg-emerald-500 text-white',
  azul: 'bg-sky-500 text-white'
}

const COLOR_RING: Record<ManchesterColor, string> = {
  vermelho: 'ring-red-300',
  laranja: 'ring-orange-300',
  amarelo: 'ring-yellow-300',
  verde: 'ring-emerald-300',
  azul: 'ring-sky-300'
}

/** Faixas normais para sinais vitais — mostra um indicador visual ao lado do campo. */
type VitalRange = 'normal' | 'warning' | 'danger' | 'unknown'

function rangeBp(s: number | null, d: number | null): VitalRange {
  if (s == null && d == null) return 'unknown'
  if (s != null && (s >= 180 || s < 90)) return 'danger'
  if (d != null && (d >= 110 || d < 60)) return 'danger'
  if (s != null && (s >= 140 || s < 100)) return 'warning'
  if (d != null && (d >= 90 || d < 65)) return 'warning'
  return 'normal'
}
function rangeFc(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v >= 130 || v < 40) return 'danger'
  if (v >= 100 || v < 50) return 'warning'
  return 'normal'
}
function rangeFr(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v >= 30 || v < 8) return 'danger'
  if (v >= 22 || v < 12) return 'warning'
  return 'normal'
}
function rangeSpo2(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v < 90) return 'danger'
  if (v < 94) return 'warning'
  return 'normal'
}
function rangeTemp(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v >= 39.5 || v < 35) return 'danger'
  if (v >= 38 || v < 36) return 'warning'
  return 'normal'
}
function rangeGlu(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v >= 300 || v < 60) return 'danger'
  if (v >= 200 || v < 70) return 'warning'
  return 'normal'
}
function rangePain(v: number | null): VitalRange {
  if (v == null) return 'unknown'
  if (v >= 7) return 'danger'
  if (v >= 4) return 'warning'
  return 'normal'
}

const RANGE_DOT: Record<VitalRange, string> = {
  normal: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
  unknown: 'bg-slate-300'
}

const RANGE_LABEL: Record<VitalRange, string> = {
  normal: 'Normal',
  warning: 'Atenção',
  danger: 'Crítico',
  unknown: '—'
}

function VitalIndicator({ range }: { range: VitalRange }): React.JSX.Element {
  return (
    <span
      className="ml-1 inline-flex items-center gap-1 align-middle text-[11px] text-slate-600"
      title={RANGE_LABEL[range]}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${RANGE_DOT[range]}`} aria-hidden />
      {RANGE_LABEL[range]}
    </span>
  )
}

const STEPS = ['Sinais vitais', 'Queixa', 'Discriminadores', 'Resumo'] as const
type StepIdx = 0 | 1 | 2 | 3

export function TriageManchesterModal({ appointment, onClose, onSaved }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<StepIdx>(0)

  const [vitals, setVitals] = useState<VitalsState>(EMPTY_VITALS)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [flowchartKey, setFlowchartKey] = useState<string>('')
  const [discriminators, setDiscriminators] = useState<string[]>([])
  const [overrideColor, setOverrideColor] = useState<ManchesterColor | ''>('')
  const [overrideReason, setOverrideReason] = useState('')
  const [notes, setNotes] = useState('')

  // Carrega registro existente, se houver, para edição.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const existing = await window.api.triages.getByAppointment(appointment.id)
        if (cancelled) return
        if (existing) {
          setVitals(fromRecord(existing))
          setChiefComplaint(existing.chiefComplaint ?? '')
          setFlowchartKey(existing.flowchartKey ?? '')
          setDiscriminators(existing.discriminators)
          setNotes(existing.notes ?? '')
          if (
            existing.suggestedColor &&
            existing.finalColor &&
            existing.suggestedColor !== existing.finalColor
          ) {
            setOverrideColor(existing.finalColor as ManchesterColor)
            setOverrideReason(existing.overrideReason ?? '')
          }
        } else if (appointment.triageColor) {
          setOverrideColor(appointment.triageColor as ManchesterColor)
          setNotes(appointment.triageNotes ?? '')
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appointment.id, appointment.triageColor, appointment.triageNotes])

  const flowchart = useMemo(() => getFlowchart(flowchartKey), [flowchartKey])

  const vitalsParsed = useMemo(
    () => ({
      systolicBp: parseNum(vitals.systolicBp),
      diastolicBp: parseNum(vitals.diastolicBp),
      heartRate: parseNum(vitals.heartRate),
      respRate: parseNum(vitals.respRate),
      spo2: parseNum(vitals.spo2),
      temperatureC: parseNum(vitals.temperatureC),
      glucoseMgDl: parseNum(vitals.glucoseMgDl),
      painScale: parseNum(vitals.painScale),
      weightKg: parseNum(vitals.weightKg),
      heightCm: parseNum(vitals.heightCm)
    }),
    [vitals]
  )

  const colorFlowchart = useMemo(
    () => (flowchartKey ? suggestColor(flowchartKey, discriminators) : 'azul'),
    [flowchartKey, discriminators]
  )
  const colorVitals = useMemo<ManchesterColor>(() => colorFromVitals(vitalsParsed), [vitalsParsed])
  const suggested = useMemo<ManchesterColor>(
    () => combineColors(colorFlowchart, colorVitals),
    [colorFlowchart, colorVitals]
  )
  const finalColor: ManchesterColor = overrideColor || suggested
  const target = MANCHESTER_TARGETS[finalColor]

  const toggleDiscriminator = (id: string): void => {
    setDiscriminators((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  const updateVital = (key: keyof VitalsState, value: string): void => {
    setVitals((v) => ({ ...v, [key]: value }))
  }

  const submit = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const overridden = overrideColor && overrideColor !== suggested
      await window.api.triages.save({
        appointmentId: appointment.id,
        systolicBp: vitalsParsed.systolicBp,
        diastolicBp: vitalsParsed.diastolicBp,
        heartRate: vitalsParsed.heartRate,
        respRate: vitalsParsed.respRate,
        spo2: vitalsParsed.spo2,
        temperatureC: vitalsParsed.temperatureC,
        glucoseMgDl: vitalsParsed.glucoseMgDl,
        painScale: vitalsParsed.painScale,
        weightKg: vitalsParsed.weightKg,
        heightCm: vitalsParsed.heightCm,
        chiefComplaint: chiefComplaint.trim() || null,
        flowchartKey: flowchartKey || null,
        discriminators,
        suggestedColor: suggested,
        finalColor,
        overrideReason: overridden ? overrideReason.trim() || null : null,
        notes: notes.trim() || null
      })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const goNext = (): void => setStep((s) => (s < 3 ? ((s + 1) as StepIdx) : s))
  const goPrev = (): void => setStep((s) => (s > 0 ? ((s - 1) as StepIdx) : s))

  return (
    <Modal
      open
      size="xl"
      title={`Triagem (Manchester) — ${appointment.patient.fullName}`}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={goPrev}>
                ← Voltar
              </Button>
            ) : null}
            {step < 3 ? (
              <Button onClick={goNext}>Próximo →</Button>
            ) : (
              <Button onClick={() => void submit()} disabled={saving || loading}>
                {saving ? 'Salvando…' : 'Salvar triagem'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>
      ) : (
        <>
          {/* Stepper */}
          <ol className="mb-5 grid grid-cols-4 gap-2">
            {STEPS.map((label, idx) => {
              const active = idx === step
              const done = idx < step
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setStep(idx as StepIdx)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                      active
                        ? 'bg-cyan-700 text-white shadow'
                        : done
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? 'bg-white text-cyan-700'
                          : done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white text-slate-600 ring-1 ring-slate-300'
                      }`}
                    >
                      {done ? '✓' : idx + 1}
                    </span>
                    <span>{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* STEP 0 — Sinais vitais */}
          {step === 0 ? (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label={
                  <>
                    PA sistólica (mmHg){' '}
                    <VitalIndicator
                      range={rangeBp(vitalsParsed.systolicBp, vitalsParsed.diastolicBp)}
                    />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="120"
                  value={vitals.systolicBp}
                  onChange={(e) => updateVital('systolicBp', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    PA diastólica (mmHg){' '}
                    <VitalIndicator
                      range={rangeBp(vitalsParsed.systolicBp, vitalsParsed.diastolicBp)}
                    />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="80"
                  value={vitals.diastolicBp}
                  onChange={(e) => updateVital('diastolicBp', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    FC (bpm) <VitalIndicator range={rangeFc(vitalsParsed.heartRate)} />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="80"
                  value={vitals.heartRate}
                  onChange={(e) => updateVital('heartRate', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    FR (irpm) <VitalIndicator range={rangeFr(vitalsParsed.respRate)} />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="16"
                  value={vitals.respRate}
                  onChange={(e) => updateVital('respRate', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    SpO₂ (%) <VitalIndicator range={rangeSpo2(vitalsParsed.spo2)} />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="98"
                  value={vitals.spo2}
                  onChange={(e) => updateVital('spo2', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    Temperatura (°C) <VitalIndicator range={rangeTemp(vitalsParsed.temperatureC)} />
                  </>
                }
              >
                <Input
                  inputMode="decimal"
                  placeholder="36.5"
                  value={vitals.temperatureC}
                  onChange={(e) => updateVital('temperatureC', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    Glicemia (mg/dL) <VitalIndicator range={rangeGlu(vitalsParsed.glucoseMgDl)} />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="100"
                  value={vitals.glucoseMgDl}
                  onChange={(e) => updateVital('glucoseMgDl', e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    Dor (0–10) <VitalIndicator range={rangePain(vitalsParsed.painScale)} />
                  </>
                }
              >
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={vitals.painScale}
                  onChange={(e) => updateVital('painScale', e.target.value)}
                />
              </Field>
              <Field label="Peso (kg)">
                <Input
                  inputMode="decimal"
                  placeholder="70"
                  value={vitals.weightKg}
                  onChange={(e) => updateVital('weightKg', e.target.value)}
                />
              </Field>
              <Field label="Altura (cm)">
                <Input
                  inputMode="numeric"
                  placeholder="170"
                  value={vitals.heightCm}
                  onChange={(e) => updateVital('heightCm', e.target.value)}
                />
              </Field>
              <p className="md:col-span-2 text-xs text-slate-500">
                Os indicadores coloridos ao lado de cada campo mostram se o valor está em faixa
                normal (verde), de atenção (âmbar) ou crítica (vermelho). Podem deixar vazio o que
                não foi medido.
              </p>
            </section>
          ) : null}

          {/* STEP 1 — Queixa */}
          {step === 1 ? (
            <section className="space-y-4">
              <Field
                label="Queixa principal"
                hint="Descreva em poucas palavras o que motivou a busca por atendimento."
              >
                <Textarea
                  rows={4}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Ex.: Dor no peito iniciada há 2h, irradiando para braço esquerdo, com sudorese."
                  autoFocus
                />
              </Field>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  Selecione o fluxograma de Manchester mais adequado
                </h4>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {FLOWCHARTS.map((f) => {
                    const selected = flowchartKey === f.key
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setFlowchartKey(f.key)
                          setDiscriminators([])
                        }}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          selected
                            ? 'border-cyan-600 bg-cyan-50 ring-2 ring-cyan-300'
                            : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
                        }`}
                      >
                        <div
                          className={`font-semibold ${selected ? 'text-cyan-800' : 'text-slate-800'}`}
                        >
                          {f.label}
                        </div>
                        {f.description ? (
                          <div className="mt-0.5 text-xs text-slate-500">{f.description}</div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {/* STEP 2 — Discriminadores */}
          {step === 2 ? (
            <section className="space-y-3">
              {!flowchart ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Volte ao passo anterior e escolha um fluxograma para listar os discriminadores.
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Marque <strong>todos</strong> os discriminadores presentes. A cor mais grave
                    entre os marcados define a prioridade.
                  </p>
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {flowchart.discriminators.map((d) => {
                      const checked = discriminators.includes(d.id)
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => toggleDiscriminator(d.id)}
                            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                              checked
                                ? `border-transparent ring-2 ${COLOR_RING[d.color]} ${COLOR_BG[d.color]}`
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                checked ? 'bg-white/30' : COLOR_DOT[d.color]
                              } text-[11px] font-bold ${checked ? 'text-white' : 'text-white'}`}
                              aria-hidden
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span className="flex-1 text-sm">
                              <span className="block font-medium">{d.label}</span>
                              {d.hint ? (
                                <span
                                  className={`mt-0.5 block text-xs ${checked ? 'opacity-90' : 'text-slate-500'}`}
                                >
                                  {d.hint}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </section>
          ) : null}

          {/* STEP 3 — Resumo + override */}
          {step === 3 ? (
            <section className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cor sugerida
                </h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Pelo fluxograma</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${COLOR_DOT[colorFlowchart]}`}
                      />
                      <span className="font-medium">{MANCHESTER_LABELS[colorFlowchart]}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Pelos sinais vitais</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${COLOR_DOT[colorVitals]}`}
                      />
                      <span className="font-medium">{MANCHESTER_LABELS[colorVitals]}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Sugestão final</div>
                    <div className="mt-1">
                      <TriageBadge color={suggested} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  Cor final (clique para sobrescrever — exige justificativa)
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {(['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] as ManchesterColor[]).map(
                    (c) => {
                      const isFinal = finalColor === c
                      const isOverride = c === overrideColor
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setOverrideColor(c === suggested ? '' : c)}
                          className={`rounded-lg p-3 text-center text-sm font-semibold transition ${COLOR_BG[c]} ${
                            isFinal ? `ring-4 ${COLOR_RING[c]}` : 'opacity-70 hover:opacity-100'
                          }`}
                          title={MANCHESTER_LABELS[c]}
                        >
                          <div className="text-base">{c.toUpperCase()}</div>
                          <div className="text-[11px] opacity-90">
                            {MANCHESTER_TARGETS[c].minutes === 0
                              ? 'Imediato'
                              : `${MANCHESTER_TARGETS[c].minutes}min`}
                          </div>
                          {isOverride ? (
                            <div className="mt-1 text-[10px] uppercase tracking-wide">
                              sobrescrita
                            </div>
                          ) : null}
                        </button>
                      )
                    }
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Selecionada: <strong>{MANCHESTER_LABELS[finalColor]}</strong> — {target.label}.
                </p>
              </div>

              {overrideColor && overrideColor !== suggested ? (
                <Field label="Justificativa para sobrescrever a sugestão" required>
                  <Textarea
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Ex.: comorbidade que justifica priorização."
                  />
                </Field>
              ) : null}

              <Field label="Observações adicionais">
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas internas sobre a triagem."
                />
              </Field>
            </section>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}
        </>
      )}
    </Modal>
  )
}
