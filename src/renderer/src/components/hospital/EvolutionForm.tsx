import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Field, Select, Textarea } from '@renderer/components/ui/Field'
import {
  EVOLUTION_AUTHOR_ROLE_LABELS,
  type AdmissionEvolutionInput,
  type AdmissionEvolutionWithRefs,
  type EvolutionAuthorRole,
  type Professional
} from '@shared/types'

interface Props {
  admissionId: number
  initial?: AdmissionEvolutionWithRefs | null
  defaultRole?: EvolutionAuthorRole
  onCancel: () => void
  onSuccess: () => void
}

/**
 * Formulário SOAP (Subjetivo · Objetivo · Avaliação · Plano) para evolução
 * clínica. O profissional escolhe a categoria (médica, enfermagem, fisio,
 * etc.) e pode usar texto livre quando o SOAP não se aplica.
 *
 * Em edição (initial != null), só o autor original ou um admin pode editar
 * — backend revalida.
 */
export function EvolutionForm({
  admissionId,
  initial,
  defaultRole,
  onCancel,
  onSuccess
}: Props): React.JSX.Element {
  const [authorRole, setAuthorRole] = useState<EvolutionAuthorRole>(
    initial?.authorRole ?? defaultRole ?? 'medico'
  )
  const [professionalId, setProfessionalId] = useState<number | ''>(initial?.professionalId ?? '')
  const [subjective, setSubjective] = useState(initial?.subjective ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [assessment, setAssessment] = useState(initial?.assessment ?? '')
  const [plan, setPlan] = useState(initial?.plan ?? '')
  const [freeText, setFreeText] = useState(initial?.freeText ?? '')
  const [useSoap, setUseSoap] = useState(
    initial ? !initial.freeText || Boolean(initial.subjective || initial.objective) : true
  )
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.professionals
      .list(true)
      .then(setProfessionals)
      .catch(() => undefined)
  }, [])

  const submit = async (): Promise<void> => {
    if (busy) return
    const hasContent = useSoap
      ? Boolean(subjective.trim() || objective.trim() || assessment.trim() || plan.trim())
      : Boolean(freeText.trim())
    if (!hasContent) {
      setError(
        useSoap
          ? 'Preencha pelo menos um dos campos SOAP (S/O/A/P).'
          : 'Escreva o texto da evolução.'
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: AdmissionEvolutionInput = {
        admissionId,
        professionalId: professionalId === '' ? null : professionalId,
        authorRole,
        subjective: useSoap ? subjective.trim() || null : null,
        objective: useSoap ? objective.trim() || null : null,
        assessment: useSoap ? assessment.trim() || null : null,
        plan: useSoap ? plan.trim() || null : null,
        freeText: !useSoap ? freeText.trim() || null : null
      }
      if (initial) {
        await window.api.evolutions.update(initial.id, payload)
      } else {
        await window.api.evolutions.create(payload)
      }
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Categoria" required>
          <Select
            value={authorRole}
            onChange={(e) => setAuthorRole(e.target.value as EvolutionAuthorRole)}
          >
            {(Object.keys(EVOLUTION_AUTHOR_ROLE_LABELS) as EvolutionAuthorRole[]).map((k) => (
              <option key={k} value={k}>
                {EVOLUTION_AUTHOR_ROLE_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Profissional" hint="Opcional — quem assina">
          <Select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">— Selecione —</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.councilNumber ? ` · ${p.councilType ?? ''} ${p.councilNumber}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            checked={useSoap}
            onChange={() => setUseSoap(true)}
            className="h-3.5 w-3.5"
          />
          SOAP estruturado
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            checked={!useSoap}
            onChange={() => setUseSoap(false)}
            className="h-3.5 w-3.5"
          />
          Texto livre
        </label>
      </div>

      {useSoap ? (
        <>
          <Field label="S — Subjetivo" hint="Queixas / relato do paciente">
            <Textarea value={subjective} onChange={(e) => setSubjective(e.target.value)} rows={2} />
          </Field>
          <Field label="O — Objetivo" hint="Exame físico, sinais, exames">
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} />
          </Field>
          <Field label="A — Avaliação" hint="Hipótese diagnóstica / impressão clínica">
            <Textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} rows={2} />
          </Field>
          <Field label="P — Plano" hint="Conduta, exames, condutas terapêuticas">
            <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} />
          </Field>
        </>
      ) : (
        <Field label="Evolução" required>
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={8}
            autoFocus
          />
        </Field>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Registrar evolução'}
        </Button>
      </div>
    </form>
  )
}
