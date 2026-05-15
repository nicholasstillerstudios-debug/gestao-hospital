/**
 * Repositório de evoluções clínicas multiprofissionais durante a internação.
 *
 * Cada evolução é uma nota assinada por um profissional (médico, enfermagem,
 * fisioterapia, nutrição, etc.) e fica anexada a uma internação ativa ou
 * encerrada. Usa estrutura SOAP (subjective/objective/assessment/plan) ou
 * texto livre — ambos opcionais; o componente que renderiza decide qual
 * mostrar.
 *
 * Edição é permitida apenas pelo autor original (ou admin) e apenas
 * enquanto a internação estiver ativa — depois de alta/óbito, a evolução
 * é congelada (parte do prontuário).
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  AdmissionEvolution,
  AdmissionEvolutionInput,
  AdmissionEvolutionWithRefs,
  EvolutionAuthorRole
} from '@shared/types'

interface Row {
  id: number
  admission_id: number
  professional_id: number | null
  author_role: EvolutionAuthorRole
  evolution_at: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  free_text: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface RowWithRefs extends Row {
  professional_name: string | null
  professional_specialty: string | null
  created_by_user_name: string | null
}

function toModel(row: Row): AdmissionEvolution {
  return {
    id: row.id,
    admissionId: row.admission_id,
    professionalId: row.professional_id,
    authorRole: row.author_role,
    evolutionAt: row.evolution_at,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    freeText: row.free_text,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toModelWithRefs(row: RowWithRefs): AdmissionEvolutionWithRefs {
  return {
    ...toModel(row),
    professionalName: row.professional_name,
    professionalSpecialty: row.professional_specialty,
    createdByUserName: row.created_by_user_name
  }
}

const SELECT_WITH_REFS = `
  SELECT e.*,
         p.full_name AS professional_name,
         p.specialty AS professional_specialty,
         u.full_name AS created_by_user_name
    FROM admission_evolutions e
    LEFT JOIN professionals p ON p.id = e.professional_id
    LEFT JOIN users u ON u.id = e.created_by_user_id
`

export function listEvolutionsForAdmission(admissionId: number): AdmissionEvolutionWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_REFS}
       WHERE e.admission_id = ?
       ORDER BY e.evolution_at DESC, e.id DESC`
    )
    .all(admissionId) as RowWithRefs[]
  return rows.map(toModelWithRefs)
}

export function getEvolution(id: number): AdmissionEvolutionWithRefs | null {
  const row = getDb().prepare(`${SELECT_WITH_REFS} WHERE e.id = ?`).get(id) as
    | RowWithRefs
    | undefined
  return row ? toModelWithRefs(row) : null
}

function ensureAdmissionExists(admissionId: number): { id: number; status: string } {
  const admission = getDb()
    .prepare('SELECT id, status FROM admissions WHERE id = ?')
    .get(admissionId) as { id: number; status: string } | undefined
  if (!admission) {
    throw Object.assign(new Error('Internação não encontrada.'), {
      code: 'ADMISSION_NOT_FOUND'
    })
  }
  return admission
}

function hasContent(input: AdmissionEvolutionInput): boolean {
  return Boolean(
    input.subjective?.trim() ||
    input.objective?.trim() ||
    input.assessment?.trim() ||
    input.plan?.trim() ||
    input.freeText?.trim()
  )
}

export function createEvolution(input: AdmissionEvolutionInput): AdmissionEvolutionWithRefs {
  ensureAdmissionExists(input.admissionId)
  if (!hasContent(input)) {
    throw Object.assign(new Error('Evolução vazia: preencha SOAP (S/O/A/P) ou texto livre.'), {
      code: 'EVOLUTION_EMPTY'
    })
  }
  const db = getDb()
  const user = getCurrentUser()
  const evolutionAt = input.evolutionAt ?? new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO admission_evolutions (
         admission_id, professional_id, author_role, evolution_at,
         subjective, objective, assessment, plan, free_text,
         created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.admissionId,
      input.professionalId ?? null,
      input.authorRole,
      evolutionAt,
      input.subjective?.trim() || null,
      input.objective?.trim() || null,
      input.assessment?.trim() || null,
      input.plan?.trim() || null,
      input.freeText?.trim() || null,
      user?.id ?? null
    )
  const id = Number(result.lastInsertRowid)
  logAudit({
    action: 'create',
    entity: 'admission_evolution',
    entityId: id,
    details: { admissionId: input.admissionId, authorRole: input.authorRole }
  })
  const created = getEvolution(id)
  if (!created) throw new Error('Falha ao recuperar evolução recém-criada.')
  return created
}

/**
 * Atualiza uma evolução. Só permitido enquanto a internação estiver ativa,
 * e apenas o autor original (ou admin) pode editar — caso contrário não
 * faria sentido (assinatura de outro profissional).
 */
export function updateEvolution(
  id: number,
  input: AdmissionEvolutionInput
): AdmissionEvolutionWithRefs {
  const db = getDb()
  const current = db.prepare('SELECT * FROM admission_evolutions WHERE id = ?').get(id) as
    | Row
    | undefined
  if (!current) {
    throw Object.assign(new Error('Evolução não encontrada.'), { code: 'EVOLUTION_NOT_FOUND' })
  }
  const admission = ensureAdmissionExists(current.admission_id)
  if (admission.status !== 'ativa') {
    throw Object.assign(
      new Error('Internação encerrada: evolução faz parte do prontuário e não pode ser editada.'),
      { code: 'ADMISSION_NOT_ACTIVE' }
    )
  }
  const user = getCurrentUser()
  if (
    user &&
    user.role !== 'admin' &&
    current.created_by_user_id != null &&
    current.created_by_user_id !== user.id
  ) {
    throw Object.assign(new Error('Apenas o autor da evolução (ou um admin) pode editá-la.'), {
      code: 'NOT_EVOLUTION_AUTHOR'
    })
  }
  if (!hasContent(input)) {
    throw Object.assign(new Error('Evolução vazia: preencha SOAP (S/O/A/P) ou texto livre.'), {
      code: 'EVOLUTION_EMPTY'
    })
  }
  db.prepare(
    `UPDATE admission_evolutions
        SET professional_id = ?,
            author_role = ?,
            evolution_at = ?,
            subjective = ?,
            objective = ?,
            assessment = ?,
            plan = ?,
            free_text = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    input.professionalId ?? null,
    input.authorRole,
    input.evolutionAt ?? current.evolution_at,
    input.subjective?.trim() || null,
    input.objective?.trim() || null,
    input.assessment?.trim() || null,
    input.plan?.trim() || null,
    input.freeText?.trim() || null,
    id
  )
  logAudit({ action: 'update', entity: 'admission_evolution', entityId: id })
  const updated = getEvolution(id)
  if (!updated) throw new Error('Falha ao recuperar evolução atualizada.')
  return updated
}

/**
 * Remove uma evolução. Só permitido enquanto a internação estiver ativa
 * e apenas pelo autor (ou admin). Em internação encerrada, faria parte do
 * prontuário e não pode ser apagada — quem precisa retificar abre um
 * adendo (nova evolução referenciando a anterior no texto).
 */
export function deleteEvolution(id: number): void {
  const db = getDb()
  const current = db.prepare('SELECT * FROM admission_evolutions WHERE id = ?').get(id) as
    | Row
    | undefined
  if (!current) {
    throw Object.assign(new Error('Evolução não encontrada.'), { code: 'EVOLUTION_NOT_FOUND' })
  }
  const admission = ensureAdmissionExists(current.admission_id)
  if (admission.status !== 'ativa') {
    throw Object.assign(
      new Error('Internação encerrada: evolução não pode ser removida do prontuário.'),
      { code: 'ADMISSION_NOT_ACTIVE' }
    )
  }
  const user = getCurrentUser()
  if (
    user &&
    user.role !== 'admin' &&
    current.created_by_user_id != null &&
    current.created_by_user_id !== user.id
  ) {
    throw Object.assign(new Error('Apenas o autor da evolução (ou um admin) pode removê-la.'), {
      code: 'NOT_EVOLUTION_AUTHOR'
    })
  }
  db.prepare('DELETE FROM admission_evolutions WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'admission_evolution', entityId: id })
}
