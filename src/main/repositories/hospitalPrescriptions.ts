/**
 * Repositório de prescrição hospitalar + MAR (Medication Administration
 * Record).
 *
 * Uma prescrição agrupa N items (cada item = um medicamento com posologia).
 * Cada item com intervalo (interval_hours) gera automaticamente registros
 * no MAR — uma linha por horário aprazado até `end_at` (ou por
 * `duration_days` em horas) — assim a enfermagem só precisa "checar" cada
 * dose conforme a hora chega.
 *
 * Items SOS/PRN (if_necessary=true) NÃO geram MAR antecipado; quando
 * administrados, a enfermagem cria a entrada na hora.
 *
 * Regras:
 *  - Prescrição/items só podem ser criados em internação ATIVA.
 *  - Suspender/cancelar item cancela doses futuras AINDA aprazadas (não
 *    mexe em doses já administradas).
 *  - Após alta/óbito, nenhuma operação de escrita é permitida.
 */

import { getDb } from '../db'
import { logAudit } from '../audit'
import { getCurrentUser } from '../session'
import type {
  AdmissionPrescription,
  AdmissionPrescriptionInput,
  AdmissionPrescriptionItem,
  AdmissionPrescriptionItemInput,
  AdmissionPrescriptionWithItems,
  MarCheckInput,
  MarStatus,
  MedicationAdministration,
  MedicationAdministrationWithRefs,
  MedicationRoute,
  PrescriptionStatus
} from '@shared/types'

interface PrescriptionRow {
  id: number
  admission_id: number
  prescribed_by_professional_id: number | null
  prescribed_at: string
  status: PrescriptionStatus
  notes: string | null
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface PrescriptionRowWithRefs extends PrescriptionRow {
  professional_name: string | null
  user_name: string | null
}

interface ItemRow {
  id: number
  prescription_id: number
  medication_id: number | null
  medication_name: string
  dose: string
  route: MedicationRoute
  frequency_label: string
  interval_hours: number | null
  duration_days: number | null
  if_necessary: number
  start_at: string
  end_at: string | null
  status: PrescriptionStatus
  notes: string | null
  created_at: string
  updated_at: string
}

interface MarRow {
  id: number
  prescription_item_id: number
  scheduled_at: string
  status: MarStatus
  administered_at: string | null
  dose_given: string | null
  administered_by_user_id: number | null
  administered_by_professional_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface MarRowWithRefs extends MarRow {
  medication_name: string
  dose: string
  route: MedicationRoute
  prescription_id: number
  user_name: string | null
  professional_name: string | null
}

function toPrescription(row: PrescriptionRow): AdmissionPrescription {
  return {
    id: row.id,
    admissionId: row.admission_id,
    prescribedByProfessionalId: row.prescribed_by_professional_id,
    prescribedAt: row.prescribed_at,
    status: row.status,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toItem(row: ItemRow): AdmissionPrescriptionItem {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    medicationId: row.medication_id,
    medicationName: row.medication_name,
    dose: row.dose,
    route: row.route,
    frequencyLabel: row.frequency_label,
    intervalHours: row.interval_hours,
    durationDays: row.duration_days,
    ifNecessary: row.if_necessary === 1,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toMar(row: MarRow): MedicationAdministration {
  return {
    id: row.id,
    prescriptionItemId: row.prescription_item_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    administeredAt: row.administered_at,
    doseGiven: row.dose_given,
    administeredByUserId: row.administered_by_user_id,
    administeredByProfessionalId: row.administered_by_professional_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toMarWithRefs(row: MarRowWithRefs): MedicationAdministrationWithRefs {
  return {
    ...toMar(row),
    medicationName: row.medication_name,
    dose: row.dose,
    route: row.route,
    prescriptionId: row.prescription_id,
    administeredByUserName: row.user_name,
    administeredByProfessionalName: row.professional_name
  }
}

function ensureAdmissionActive(admissionId: number): void {
  const admission = getDb()
    .prepare('SELECT id, status FROM admissions WHERE id = ?')
    .get(admissionId) as { id: number; status: string } | undefined
  if (!admission) {
    throw Object.assign(new Error('Internação não encontrada.'), {
      code: 'ADMISSION_NOT_FOUND'
    })
  }
  if (admission.status !== 'ativa') {
    throw Object.assign(new Error('Internação encerrada: prescrição não pode ser modificada.'), {
      code: 'ADMISSION_NOT_ACTIVE'
    })
  }
}

/**
 * Calcula os horários aprazados de um item entre `start` e `end`.
 * Retorna timestamps ISO em UTC.
 *
 * Decisão de design: respeita exatamente start_at — sem arredondar para
 * hora cheia ou mexer no fuso. Quem decide a primeira hora é quem prescreve
 * (ex.: "iniciar às 14h"). Para items 12/12h iniciados às 14h, dá 14h, 02h,
 * 14h, 02h... como esperado.
 */
function computeSchedule(item: {
  startAt: string
  endAt: string | null
  intervalHours: number | null
  durationDays: number | null
  ifNecessary: boolean
}): string[] {
  if (item.ifNecessary) return []
  if (item.intervalHours == null || item.intervalHours <= 0) return []
  const start = new Date(item.startAt).getTime()
  if (!Number.isFinite(start)) return []
  let end: number
  if (item.endAt) {
    end = new Date(item.endAt).getTime()
  } else if (item.durationDays != null && item.durationDays > 0) {
    end = start + item.durationDays * 24 * 3600 * 1000
  } else {
    // Sem duração definida → aprazamos 7 dias por padrão; renovação pode
    // ser feita ao reavaliar (médico recadastra ou estende manualmente).
    end = start + 7 * 24 * 3600 * 1000
  }
  if (!Number.isFinite(end) || end <= start) return []
  const stepMs = item.intervalHours * 3600 * 1000
  // Limite de segurança: 90 dias / step horários para evitar runaway
  // se alguém colocar intervalo de 1h em duração de 90 dias.
  const maxIterations = Math.min(Math.ceil((end - start) / stepMs), 90 * 24)
  const out: string[] = []
  for (let i = 0; i < maxIterations; i += 1) {
    const ts = start + i * stepMs
    if (ts > end) break
    out.push(new Date(ts).toISOString())
  }
  return out
}

function validateItemInput(input: AdmissionPrescriptionItemInput): void {
  if (!input.medicationName.trim()) {
    throw Object.assign(new Error('Nome do medicamento é obrigatório.'), {
      code: 'PRESCRIPTION_ITEM_INVALID'
    })
  }
  if (!input.dose.trim()) {
    throw Object.assign(new Error('Dose é obrigatória.'), {
      code: 'PRESCRIPTION_ITEM_INVALID'
    })
  }
  if (!input.frequencyLabel.trim()) {
    throw Object.assign(new Error('Frequência é obrigatória.'), {
      code: 'PRESCRIPTION_ITEM_INVALID'
    })
  }
  if (
    input.intervalHours != null &&
    (!Number.isFinite(input.intervalHours) || input.intervalHours <= 0 || input.intervalHours > 168)
  ) {
    throw Object.assign(new Error('Intervalo deve ser positivo e até 168h (7 dias).'), {
      code: 'PRESCRIPTION_ITEM_INVALID'
    })
  }
  if (
    input.durationDays != null &&
    (!Number.isFinite(input.durationDays) || input.durationDays <= 0 || input.durationDays > 90)
  ) {
    throw Object.assign(new Error('Duração deve ser positiva e até 90 dias.'), {
      code: 'PRESCRIPTION_ITEM_INVALID'
    })
  }
}

export function listPrescriptionsForAdmission(
  admissionId: number
): AdmissionPrescriptionWithItems[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.*,
              prof.full_name AS professional_name,
              u.full_name    AS user_name
         FROM admission_prescriptions p
         LEFT JOIN professionals prof ON prof.id = p.prescribed_by_professional_id
         LEFT JOIN users u            ON u.id   = p.created_by_user_id
        WHERE p.admission_id = ?
        ORDER BY p.prescribed_at DESC, p.id DESC`
    )
    .all(admissionId) as PrescriptionRowWithRefs[]

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const placeholders = ids.map(() => '?').join(',')
  const itemsByPrescription = new Map<number, AdmissionPrescriptionItem[]>()
  const itemRows = db
    .prepare(
      `SELECT * FROM admission_prescription_items
        WHERE prescription_id IN (${placeholders})
        ORDER BY id ASC`
    )
    .all(...ids) as ItemRow[]
  for (const ir of itemRows) {
    const arr = itemsByPrescription.get(ir.prescription_id) ?? []
    arr.push(toItem(ir))
    itemsByPrescription.set(ir.prescription_id, arr)
  }

  return rows.map((row) => ({
    ...toPrescription(row),
    prescribedByProfessionalName: row.professional_name,
    createdByUserName: row.user_name,
    items: itemsByPrescription.get(row.id) ?? []
  }))
}

export function getPrescription(id: number): AdmissionPrescriptionWithItems | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT p.*,
              prof.full_name AS professional_name,
              u.full_name    AS user_name
         FROM admission_prescriptions p
         LEFT JOIN professionals prof ON prof.id = p.prescribed_by_professional_id
         LEFT JOIN users u            ON u.id   = p.created_by_user_id
        WHERE p.id = ?`
    )
    .get(id) as PrescriptionRowWithRefs | undefined
  if (!row) return null
  const items = db
    .prepare(
      `SELECT * FROM admission_prescription_items
        WHERE prescription_id = ? ORDER BY id ASC`
    )
    .all(id) as ItemRow[]
  return {
    ...toPrescription(row),
    prescribedByProfessionalName: row.professional_name,
    createdByUserName: row.user_name,
    items: items.map(toItem)
  }
}

/**
 * Cria a prescrição inteira (cabeçalho + N items) numa única transação
 * e já agenda o MAR para cada item com intervalo definido.
 */
export function createPrescription(
  input: AdmissionPrescriptionInput
): AdmissionPrescriptionWithItems {
  ensureAdmissionActive(input.admissionId)
  if (input.items.length === 0) {
    throw Object.assign(new Error('Adicione pelo menos um item à prescrição.'), {
      code: 'PRESCRIPTION_EMPTY'
    })
  }
  for (const item of input.items) validateItemInput(item)

  const db = getDb()
  const user = getCurrentUser()
  const tx = db.transaction(() => {
    const insertedAt = input.prescribedAt ?? new Date().toISOString()
    const presResult = db
      .prepare(
        `INSERT INTO admission_prescriptions (
           admission_id, prescribed_by_professional_id, prescribed_at,
           notes, created_by_user_id
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.admissionId,
        input.prescribedByProfessionalId ?? null,
        insertedAt,
        input.notes?.trim() || null,
        user?.id ?? null
      )
    const prescriptionId = Number(presResult.lastInsertRowid)

    const insertItem = db.prepare(
      `INSERT INTO admission_prescription_items (
         prescription_id, medication_id, medication_name, dose, route,
         frequency_label, interval_hours, duration_days, if_necessary,
         start_at, end_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertMar = db.prepare(
      `INSERT INTO admission_medication_administrations (
         prescription_item_id, scheduled_at
       ) VALUES (?, ?)`
    )

    for (const item of input.items) {
      const startAt = item.startAt ?? insertedAt
      const itemResult = insertItem.run(
        prescriptionId,
        item.medicationId ?? null,
        item.medicationName.trim(),
        item.dose.trim(),
        item.route,
        item.frequencyLabel.trim(),
        item.intervalHours ?? null,
        item.durationDays ?? null,
        item.ifNecessary ? 1 : 0,
        startAt,
        item.endAt ?? null,
        item.notes?.trim() || null
      )
      const itemId = Number(itemResult.lastInsertRowid)
      const schedule = computeSchedule({
        startAt,
        endAt: item.endAt ?? null,
        intervalHours: item.intervalHours ?? null,
        durationDays: item.durationDays ?? null,
        ifNecessary: Boolean(item.ifNecessary)
      })
      for (const ts of schedule) insertMar.run(itemId, ts)
    }

    logAudit({
      action: 'create',
      entity: 'admission_prescription',
      entityId: prescriptionId,
      details: {
        admissionId: input.admissionId,
        itemCount: input.items.length
      }
    })

    return prescriptionId
  })

  const id = tx()
  const created = getPrescription(id)
  if (!created) throw new Error('Falha ao recuperar prescrição recém-criada.')
  return created
}

/**
 * Muda o status da prescrição inteira. Suspender/cancelar também marca
 * todos os items ativos como suspenso/cancelado e cancela doses futuras
 * ainda aprazadas (sem mexer no histórico de administradas).
 */
export function setPrescriptionStatus(
  id: number,
  status: PrescriptionStatus
): AdmissionPrescriptionWithItems {
  const db = getDb()
  const current = db
    .prepare('SELECT id, admission_id, status FROM admission_prescriptions WHERE id = ?')
    .get(id) as { id: number; admission_id: number; status: PrescriptionStatus } | undefined
  if (!current) {
    throw Object.assign(new Error('Prescrição não encontrada.'), {
      code: 'PRESCRIPTION_NOT_FOUND'
    })
  }
  ensureAdmissionActive(current.admission_id)

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE admission_prescriptions
          SET status = ?, updated_at = datetime('now')
        WHERE id = ?`
    ).run(status, id)

    if (status === 'suspensa' || status === 'cancelada' || status === 'finalizada') {
      // Atualiza apenas items ainda ativos.
      db.prepare(
        `UPDATE admission_prescription_items
            SET status = ?, updated_at = datetime('now')
          WHERE prescription_id = ? AND status = 'ativa'`
      ).run(status, id)
      // Cancela doses futuras ainda aprazadas.
      db.prepare(
        `UPDATE admission_medication_administrations
            SET status = 'suspenso', updated_at = datetime('now')
          WHERE prescription_item_id IN (
                  SELECT id FROM admission_prescription_items WHERE prescription_id = ?
                )
            AND status = 'aprazado'
            AND scheduled_at > datetime('now')`
      ).run(id)
    }
    logAudit({
      action: 'update',
      entity: 'admission_prescription',
      entityId: id,
      details: { status }
    })
  })
  tx()
  const updated = getPrescription(id)
  if (!updated) throw new Error('Falha ao recuperar prescrição atualizada.')
  return updated
}

/**
 * Muda o status de um item individual. Mesma lógica: cancela doses
 * futuras aprazadas (não toca em histórico). Permite, por exemplo,
 * suspender apenas um dos medicamentos sem cancelar a prescrição inteira.
 */
export function setPrescriptionItemStatus(
  itemId: number,
  status: PrescriptionStatus
): AdmissionPrescriptionWithItems {
  const db = getDb()
  const item = db
    .prepare(
      `SELECT i.id, i.prescription_id, p.admission_id
         FROM admission_prescription_items i
         JOIN admission_prescriptions p ON p.id = i.prescription_id
        WHERE i.id = ?`
    )
    .get(itemId) as { id: number; prescription_id: number; admission_id: number } | undefined
  if (!item) {
    throw Object.assign(new Error('Item da prescrição não encontrado.'), {
      code: 'PRESCRIPTION_ITEM_NOT_FOUND'
    })
  }
  ensureAdmissionActive(item.admission_id)

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE admission_prescription_items
          SET status = ?, updated_at = datetime('now')
        WHERE id = ?`
    ).run(status, itemId)
    if (status === 'suspensa' || status === 'cancelada' || status === 'finalizada') {
      db.prepare(
        `UPDATE admission_medication_administrations
            SET status = 'suspenso', updated_at = datetime('now')
          WHERE prescription_item_id = ?
            AND status = 'aprazado'
            AND scheduled_at > datetime('now')`
      ).run(itemId)
    }
    logAudit({
      action: 'update',
      entity: 'admission_prescription_item',
      entityId: itemId,
      details: { status }
    })
  })
  tx()
  const updated = getPrescription(item.prescription_id)
  if (!updated) throw new Error('Falha ao recuperar prescrição.')
  return updated
}

// ---------- MAR ----------

const SELECT_MAR_WITH_REFS = `
  SELECT m.*,
         i.medication_name AS medication_name,
         i.dose            AS dose,
         i.route           AS route,
         i.prescription_id AS prescription_id,
         u.full_name       AS user_name,
         pr.full_name      AS professional_name
    FROM admission_medication_administrations m
    JOIN admission_prescription_items i ON i.id = m.prescription_item_id
    LEFT JOIN users u            ON u.id  = m.administered_by_user_id
    LEFT JOIN professionals pr   ON pr.id = m.administered_by_professional_id
`

export function listMarForAdmission(admissionId: number): MedicationAdministrationWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_MAR_WITH_REFS}
       JOIN admission_prescriptions p ON p.id = i.prescription_id
       WHERE p.admission_id = ?
       ORDER BY m.scheduled_at ASC, m.id ASC`
    )
    .all(admissionId) as MarRowWithRefs[]
  return rows.map(toMarWithRefs)
}

export function listMarForItem(itemId: number): MedicationAdministrationWithRefs[] {
  const rows = getDb()
    .prepare(
      `${SELECT_MAR_WITH_REFS}
       WHERE m.prescription_item_id = ?
       ORDER BY m.scheduled_at ASC, m.id ASC`
    )
    .all(itemId) as MarRowWithRefs[]
  return rows.map(toMarWithRefs)
}

/**
 * Registra a checagem de uma dose (administrado / recusado / omitido /
 * suspenso). Para items SOS, se a dose ainda não existe (não foi
 * aprazada), o cliente deve criar uma via `createPrnAdministration` antes.
 *
 * Decisão: dose "aprazado" → "administrado" exige administeredAt;
 * default ao now() se não vier explícito.
 */
export function checkAdministration(
  id: number,
  input: MarCheckInput
): MedicationAdministrationWithRefs {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT m.id, m.status, p.admission_id
         FROM admission_medication_administrations m
         JOIN admission_prescription_items i ON i.id = m.prescription_item_id
         JOIN admission_prescriptions p ON p.id = i.prescription_id
        WHERE m.id = ?`
    )
    .get(id) as { id: number; status: MarStatus; admission_id: number } | undefined
  if (!row) {
    throw Object.assign(new Error('Aprazamento não encontrado.'), {
      code: 'MAR_NOT_FOUND'
    })
  }
  ensureAdmissionActive(row.admission_id)

  const user = getCurrentUser()
  const administeredAt =
    input.status === 'administrado'
      ? (input.administeredAt ?? new Date().toISOString())
      : (input.administeredAt ?? null)

  db.prepare(
    `UPDATE admission_medication_administrations
        SET status = ?,
            administered_at = ?,
            dose_given = ?,
            administered_by_user_id = ?,
            administered_by_professional_id = ?,
            notes = ?,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    input.status,
    administeredAt,
    input.doseGiven?.trim() || null,
    input.status === 'administrado' ? (user?.id ?? null) : null,
    input.administeredByProfessionalId ?? null,
    input.notes?.trim() || null,
    id
  )
  logAudit({
    action: 'update',
    entity: 'admission_medication_administration',
    entityId: id,
    details: { status: input.status }
  })

  const updated = db.prepare(`${SELECT_MAR_WITH_REFS} WHERE m.id = ?`).get(id) as MarRowWithRefs
  return toMarWithRefs(updated)
}

/**
 * Volta o estado de uma dose para "aprazado" (correção de checagem
 * errada). Limpa os campos preenchidos pela checagem.
 */
export function revertAdministration(id: number): MedicationAdministrationWithRefs {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT m.id, p.admission_id, m.administered_by_user_id
         FROM admission_medication_administrations m
         JOIN admission_prescription_items i ON i.id = m.prescription_item_id
         JOIN admission_prescriptions p ON p.id = i.prescription_id
        WHERE m.id = ?`
    )
    .get(id) as
    | { id: number; admission_id: number; administered_by_user_id: number | null }
    | undefined
  if (!row) {
    throw Object.assign(new Error('Aprazamento não encontrado.'), {
      code: 'MAR_NOT_FOUND'
    })
  }
  ensureAdmissionActive(row.admission_id)
  const user = getCurrentUser()
  if (
    user &&
    user.role !== 'admin' &&
    row.administered_by_user_id != null &&
    row.administered_by_user_id !== user.id
  ) {
    throw Object.assign(new Error('Só o autor da checagem (ou um admin) pode reverter.'), {
      code: 'NOT_MAR_AUTHOR'
    })
  }
  db.prepare(
    `UPDATE admission_medication_administrations
        SET status = 'aprazado',
            administered_at = NULL,
            dose_given = NULL,
            administered_by_user_id = NULL,
            administered_by_professional_id = NULL,
            notes = NULL,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(id)
  logAudit({
    action: 'update',
    entity: 'admission_medication_administration',
    entityId: id,
    details: { status: 'aprazado', reverted: true }
  })
  const updated = db.prepare(`${SELECT_MAR_WITH_REFS} WHERE m.id = ?`).get(id) as MarRowWithRefs
  return toMarWithRefs(updated)
}
