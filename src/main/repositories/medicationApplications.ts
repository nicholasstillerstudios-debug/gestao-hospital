/**
 * Sala de medicação ambulatorial. Cada registro é uma aplicação
 * (injeção, dose oral, vacina) feita em paciente NÃO internado.
 * Opcionalmente abate 1 unidade de um lote da farmácia.
 */
import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  MedicationApplication,
  MedicationApplicationInput,
  MedicationApplicationWithRefs
} from '@shared/types'

interface Row {
  id: number
  patient_id: number
  professional_id: number | null
  medication_id: number | null
  medication_name: string
  dose: string
  route: string | null
  lot_id: number | null
  applied_at: string
  notes: string | null
  stock_movement_id: number | null
  created_by_user_id: number | null
  created_at: string
}

interface RowWithRefs extends Row {
  patient_name: string
  patient_cpf: string | null
  professional_name: string | null
  lot_number: string | null
}

function toModel(r: Row): MedicationApplication {
  return {
    id: r.id,
    patientId: r.patient_id,
    professionalId: r.professional_id,
    medicationId: r.medication_id,
    medicationName: r.medication_name,
    dose: r.dose,
    route: r.route,
    lotId: r.lot_id,
    appliedAt: r.applied_at,
    notes: r.notes,
    stockMovementId: r.stock_movement_id,
    createdByUserId: r.created_by_user_id,
    createdAt: r.created_at
  }
}

function toRefs(r: RowWithRefs): MedicationApplicationWithRefs {
  return {
    ...toModel(r),
    patientName: r.patient_name,
    patientCpf: r.patient_cpf,
    professionalName: r.professional_name,
    lotNumber: r.lot_number
  }
}

const SELECT = `
  SELECT a.*,
         p.full_name AS patient_name,
         p.cpf       AS patient_cpf,
         pr.full_name AS professional_name,
         l.lot_number AS lot_number
    FROM medication_applications a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN professionals pr ON pr.id = a.professional_id
    LEFT JOIN medication_lots l ON l.id = a.lot_id
`

export function listApplications(filter?: {
  fromDate?: string
  toDate?: string
  patientId?: number
}): MedicationApplicationWithRefs[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (filter?.fromDate) {
    where.push('a.applied_at >= ?')
    params.push(filter.fromDate)
  }
  if (filter?.toDate) {
    where.push('a.applied_at <= ?')
    params.push(filter.toDate)
  }
  if (filter?.patientId) {
    where.push('a.patient_id = ?')
    params.push(filter.patientId)
  }
  const sql = `${SELECT}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.applied_at DESC, a.id DESC
    LIMIT 1000`
  return (getDb().prepare(sql).all(...params) as RowWithRefs[]).map(toRefs)
}

export function createApplication(
  input: MedicationApplicationInput
): MedicationApplicationWithRefs {
  if (!input.medicationName?.trim()) {
    throw Object.assign(new Error('Informe o medicamento.'), { code: 'MEDAPP_NAME_REQUIRED' })
  }
  if (!input.dose?.trim()) {
    throw Object.assign(new Error('Informe a dose.'), { code: 'MEDAPP_DOSE_REQUIRED' })
  }
  const db = getDb()
  const user = getCurrentUser()
  const appliedAt = input.appliedAt ?? new Date().toISOString()

  const tx = db.transaction((): number => {
    let stockMovementId: number | null = null

    // Baixa de estoque (opcional). Reusa o pharmacy.addMovement via SQL
    // direto pra evitar dependência cruzada — saída de 1 unidade do lote
    // indicado vinculada ao paciente.
    if (input.decrementStock && input.medicationId && input.lotId) {
      const lot = db
        .prepare('SELECT quantity, medication_id FROM medication_lots WHERE id = ?')
        .get(input.lotId) as { quantity: number; medication_id: number } | undefined
      if (!lot) {
        throw Object.assign(new Error('Lote não encontrado.'), { code: 'LOT_NOT_FOUND' })
      }
      if (lot.medication_id !== input.medicationId) {
        throw Object.assign(new Error('Lote não pertence ao medicamento selecionado.'), {
          code: 'LOT_MISMATCH'
        })
      }
      if (lot.quantity < 1) {
        throw Object.assign(new Error('Lote sem saldo para aplicação.'), {
          code: 'LOT_EMPTY'
        })
      }
      const mv = db
        .prepare(
          `INSERT INTO stock_movements
             (medication_id, lot_id, type, quantity, patient_id, professional_id,
              notes, created_by_user_id)
           VALUES (?, ?, 'saida', 1, ?, ?, ?, ?)`
        )
        .run(
          input.medicationId,
          input.lotId,
          input.patientId,
          input.professionalId ?? null,
          `Aplicação ambulatorial: ${input.medicationName}`,
          user?.id ?? null
        )
      stockMovementId = Number(mv.lastInsertRowid)
      db.prepare('UPDATE medication_lots SET quantity = quantity - 1 WHERE id = ?').run(
        input.lotId
      )
    }

    const r = db
      .prepare(
        `INSERT INTO medication_applications
           (patient_id, professional_id, medication_id, medication_name, dose, route,
            lot_id, applied_at, notes, stock_movement_id, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.patientId,
        input.professionalId ?? null,
        input.medicationId ?? null,
        input.medicationName.trim(),
        input.dose.trim(),
        input.route?.trim() || null,
        input.lotId ?? null,
        appliedAt,
        input.notes?.trim() || null,
        stockMovementId,
        user?.id ?? null
      )
    return Number(r.lastInsertRowid)
  })

  const id = tx()
  logAudit({
    action: 'create',
    entity: 'medication_application',
    entityId: id,
    details: { patientId: input.patientId, medicationName: input.medicationName }
  })
  const row = getDb().prepare(`${SELECT} WHERE a.id = ?`).get(id) as RowWithRefs
  return toRefs(row)
}

export function deleteApplication(id: number): void {
  // Estorno do estoque é manual via Farmácia. Aqui só removemos o registro.
  getDb().prepare('DELETE FROM medication_applications WHERE id = ?').run(id)
  logAudit({ action: 'delete', entity: 'medication_application', entityId: id })
}
