import { getDb } from '../db'
import { logAudit } from '../audit'
import type {
  Dispensation,
  DispensationInput,
  Medication,
  MedicationInput,
  MedicationLot,
  MedicationLotInput,
  MedicationStock,
  StockMovement,
  StockMovementInput,
  StockMovementType
} from '@shared/types'

/* -------------------- Tipos de linha (snake_case) -------------------- */

interface MedRow {
  id: number
  name: string
  active_ingredient: string | null
  dosage: string | null
  form: string | null
  route: string | null
  unit: string
  is_remume: number
  anvisa_class: string | null
  min_stock: number
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

interface LotRow {
  id: number
  medication_id: number
  lot_number: string
  manufacturer: string | null
  expires_at: string
  quantity: number
  entry_quantity: number
  entry_unit_cost: number | null
  entry_source: string | null
  notes: string | null
  created_at: string
}

interface MovementRow {
  id: number
  medication_id: number
  medication_name: string
  lot_id: number | null
  lot_number: string | null
  type: StockMovementType
  quantity: number
  reason: string | null
  dispensation_id: number | null
  prescription_id: number | null
  patient_id: number | null
  patient_name: string | null
  performed_by_user_id: number | null
  performed_by_name: string | null
  created_at: string
}

interface DispRow {
  id: number
  prescription_id: number | null
  patient_id: number
  patient_name: string
  dispensed_at: string
  performed_by_user_id: number | null
  performed_by_name: string | null
  notes: string | null
  created_at: string
}

interface DispItemRow {
  medication_id: number
  medication_name: string
  lot_id: number | null
  lot_number: string | null
  quantity: number
}

/* -------------------- Mappers -------------------- */

function mapMed(r: MedRow): Medication {
  return {
    id: r.id,
    name: r.name,
    activeIngredient: r.active_ingredient,
    dosage: r.dosage,
    form: r.form,
    route: r.route,
    unit: r.unit,
    isRemume: r.is_remume === 1,
    anvisaClass: r.anvisa_class,
    minStock: r.min_stock,
    notes: r.notes,
    active: r.active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function mapLot(r: LotRow): MedicationLot {
  return {
    id: r.id,
    medicationId: r.medication_id,
    lotNumber: r.lot_number,
    manufacturer: r.manufacturer,
    expiresAt: r.expires_at,
    quantity: r.quantity,
    entryQuantity: r.entry_quantity,
    entryUnitCost: r.entry_unit_cost,
    entrySource: r.entry_source,
    notes: r.notes,
    createdAt: r.created_at
  }
}

function mapMovement(r: MovementRow): StockMovement {
  return {
    id: r.id,
    medicationId: r.medication_id,
    medicationName: r.medication_name,
    lotId: r.lot_id,
    lotNumber: r.lot_number,
    type: r.type,
    quantity: r.quantity,
    reason: r.reason,
    dispensationId: r.dispensation_id,
    prescriptionId: r.prescription_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    performedByUserId: r.performed_by_user_id,
    performedByName: r.performed_by_name,
    createdAt: r.created_at
  }
}

/* -------------------- Helpers de validação -------------------- */

function vErr(msg: string): Error & { code: string } {
  return Object.assign(new Error(msg), { code: 'VALIDATION_ERROR' })
}

function nfErr(msg: string): Error & { code: string } {
  return Object.assign(new Error(msg), { code: 'NOT_FOUND' })
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + (fromIso.length === 10 ? 'T00:00:00' : ''))
  const b = new Date(toIso + (toIso.length === 10 ? 'T00:00:00' : ''))
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

/* -------------------- Medicamentos -------------------- */

export function listMedications(includeInactive = false): Medication[] {
  const db = getDb()
  const rows = db
    .prepare<
      [],
      MedRow
    >(includeInactive ? 'SELECT * FROM medications ORDER BY LOWER(name)' : 'SELECT * FROM medications WHERE active = 1 ORDER BY LOWER(name)')
    .all()
  return rows.map(mapMed)
}

export function listStock(): MedicationStock[] {
  const db = getDb()
  // Soma de lotes (apenas com quantidade > 0) e próxima validade.
  const rows = db
    .prepare<[], MedRow & { total_quantity: number | null; next_expiry: string | null }>(
      `SELECT m.*,
              COALESCE(SUM(CASE WHEN l.quantity > 0 THEN l.quantity ELSE 0 END), 0) AS total_quantity,
              MIN(CASE WHEN l.quantity > 0 THEN l.expires_at ELSE NULL END) AS next_expiry
       FROM medications m
       LEFT JOIN medication_lots l ON l.medication_id = m.id
       WHERE m.active = 1
       GROUP BY m.id
       ORDER BY LOWER(m.name)`
    )
    .all()
  const today = new Date().toISOString().slice(0, 10)
  return rows.map((r) => {
    const total = Number(r.total_quantity ?? 0)
    const nextExpiry = r.next_expiry
    const expiringSoon = nextExpiry != null && daysBetween(today, nextExpiry) <= 90
    return {
      ...mapMed(r),
      totalQuantity: total,
      nextExpiry,
      belowMin: r.min_stock > 0 && total < r.min_stock,
      expiringSoon
    }
  })
}

export function getMedication(id: number): Medication | null {
  const row = getDb().prepare<[number], MedRow>('SELECT * FROM medications WHERE id = ?').get(id)
  return row ? mapMed(row) : null
}

export function createMedication(input: MedicationInput): Medication {
  const name = normalizeText(input.name)
  if (!name) throw vErr('Nome do medicamento é obrigatório.')
  const unit = normalizeText(input.unit ?? 'unidade') ?? 'unidade'
  const minStock = Math.max(0, Math.floor(input.minStock ?? 0))

  const db = getDb()
  try {
    const result = db
      .prepare(
        `INSERT INTO medications
           (name, active_ingredient, dosage, form, route, unit, is_remume, anvisa_class, min_stock, notes, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        normalizeText(input.activeIngredient),
        normalizeText(input.dosage),
        normalizeText(input.form),
        normalizeText(input.route),
        unit,
        input.isRemume ? 1 : 0,
        normalizeText(input.anvisaClass),
        minStock,
        normalizeText(input.notes),
        input.active === false ? 0 : 1
      )
    const id = Number(result.lastInsertRowid)
    logAudit({ action: 'PHARMACY_MED_CREATE', entity: 'medication', entityId: String(id) })
    return getMedication(id)!
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw vErr('Já existe medicamento com mesmo nome, dosagem e forma.')
    }
    throw err
  }
}

export function updateMedication(id: number, input: MedicationInput): Medication {
  const existing = getMedication(id)
  if (!existing) throw nfErr('Medicamento não encontrado.')
  const name = normalizeText(input.name)
  if (!name) throw vErr('Nome do medicamento é obrigatório.')
  const unit = normalizeText(input.unit ?? existing.unit) ?? 'unidade'
  const minStock = Math.max(0, Math.floor(input.minStock ?? existing.minStock))

  getDb()
    .prepare(
      `UPDATE medications
       SET name = ?, active_ingredient = ?, dosage = ?, form = ?, route = ?, unit = ?,
           is_remume = ?, anvisa_class = ?, min_stock = ?, notes = ?,
           active = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      name,
      normalizeText(input.activeIngredient),
      normalizeText(input.dosage),
      normalizeText(input.form),
      normalizeText(input.route),
      unit,
      input.isRemume ? 1 : 0,
      normalizeText(input.anvisaClass),
      minStock,
      normalizeText(input.notes),
      input.active === false ? 0 : 1,
      id
    )
  logAudit({ action: 'PHARMACY_MED_UPDATE', entity: 'medication', entityId: String(id) })
  return getMedication(id)!
}

export function setMedicationActive(id: number, active: boolean): Medication {
  const existing = getMedication(id)
  if (!existing) throw nfErr('Medicamento não encontrado.')
  getDb()
    .prepare(`UPDATE medications SET active = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(active ? 1 : 0, id)
  logAudit({
    action: active ? 'PHARMACY_MED_ACTIVATE' : 'PHARMACY_MED_DEACTIVATE',
    entity: 'medication',
    entityId: String(id)
  })
  return getMedication(id)!
}

/* -------------------- Lotes -------------------- */

export function listLots(medicationId: number, includeEmpty = true): MedicationLot[] {
  const db = getDb()
  const sql = includeEmpty
    ? 'SELECT * FROM medication_lots WHERE medication_id = ? ORDER BY expires_at, id'
    : 'SELECT * FROM medication_lots WHERE medication_id = ? AND quantity > 0 ORDER BY expires_at, id'
  return db.prepare<[number], LotRow>(sql).all(medicationId).map(mapLot)
}

export function addLot(
  input: MedicationLotInput,
  performedByUserId: number | null,
  performedByName: string | null
): MedicationLot {
  const lotNumber = normalizeText(input.lotNumber)
  if (!lotNumber) throw vErr('Número do lote é obrigatório.')
  if (!input.expiresAt || input.expiresAt.length < 10) throw vErr('Validade inválida.')
  if (!Number.isFinite(input.entryQuantity) || input.entryQuantity <= 0) {
    throw vErr('Quantidade de entrada deve ser maior que zero.')
  }

  const med = getMedication(input.medicationId)
  if (!med) throw nfErr('Medicamento não encontrado.')

  const db = getDb()
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO medication_lots
           (medication_id, lot_number, manufacturer, expires_at, quantity, entry_quantity,
            entry_unit_cost, entry_source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.medicationId,
        lotNumber,
        normalizeText(input.manufacturer),
        input.expiresAt,
        Math.floor(input.entryQuantity),
        Math.floor(input.entryQuantity),
        input.entryUnitCost ?? null,
        normalizeText(input.entrySource),
        normalizeText(input.notes)
      )
    const lotId = Number(result.lastInsertRowid)
    db.prepare(
      `INSERT INTO stock_movements
         (medication_id, lot_id, type, quantity, reason, performed_by_user_id, performed_by_name)
       VALUES (?, ?, 'entrada', ?, ?, ?, ?)`
    ).run(
      input.medicationId,
      lotId,
      Math.floor(input.entryQuantity),
      `Entrada de lote ${lotNumber}` + (input.entrySource ? ` (${input.entrySource})` : ''),
      performedByUserId,
      performedByName
    )
    return lotId
  })

  const lotId = tx()
  logAudit({
    action: 'PHARMACY_LOT_ADD',
    entity: 'medication_lot',
    entityId: String(lotId),
    details: {
      medicationId: input.medicationId,
      lotNumber,
      expiresAt: input.expiresAt,
      quantity: input.entryQuantity
    }
  })
  return mapLot(
    db.prepare<[number], LotRow>('SELECT * FROM medication_lots WHERE id = ?').get(lotId) as LotRow
  )
}

/* -------------------- Movimentações (avulsas) -------------------- */

export function addMovement(
  input: StockMovementInput,
  performedByUserId: number | null,
  performedByName: string | null
): StockMovement {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw vErr('Quantidade deve ser maior que zero.')
  }
  const med = getMedication(input.medicationId)
  if (!med) throw nfErr('Medicamento não encontrado.')

  const db = getDb()
  const reason = normalizeText(input.reason)

  const tx = db.transaction(() => {
    const qty = Math.floor(input.quantity)
    const lotIdInput: number | null = input.lotId ?? null

    const insertMovement = (lot: number | null, q: number): number => {
      const r = db
        .prepare(
          `INSERT INTO stock_movements
             (medication_id, lot_id, type, quantity, reason, performed_by_user_id, performed_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(input.medicationId, lot, input.type, q, reason, performedByUserId, performedByName)
      return Number(r.lastInsertRowid)
    }

    if (input.type === 'entrada') {
      // Entrada avulsa precisa de lote. Se não veio lote, abortar.
      if (!lotIdInput) {
        throw vErr('Entrada avulsa exige selecionar um lote existente.')
      }
      const lot = db
        .prepare<[number], LotRow>('SELECT * FROM medication_lots WHERE id = ?')
        .get(lotIdInput)
      if (!lot || lot.medication_id !== input.medicationId) {
        throw nfErr('Lote não encontrado para este medicamento.')
      }
      db.prepare('UPDATE medication_lots SET quantity = quantity + ? WHERE id = ?').run(
        qty,
        lotIdInput
      )
      return insertMovement(lotIdInput, qty)
    }

    if (input.type === 'saida' || input.type === 'perda') {
      // Saída/perda: tira do lote especificado, ou do mais próximo de vencer (FEFO).
      // Cada lote consumido vira UM stock_movements separado para rastreabilidade
      // de recall (lote afetado precisa ser identificável). Retorna o id do
      // primeiro registro criado (lote consumido primeiro = mais próximo de vencer).
      let lots: LotRow[]
      if (lotIdInput) {
        const lot = db
          .prepare<[number], LotRow>('SELECT * FROM medication_lots WHERE id = ? AND quantity > 0')
          .get(lotIdInput)
        if (!lot || lot.medication_id !== input.medicationId) {
          throw nfErr('Lote não encontrado para este medicamento.')
        }
        lots = [lot]
      } else {
        lots = db
          .prepare<[number], LotRow>(
            `SELECT * FROM medication_lots
             WHERE medication_id = ? AND quantity > 0
             ORDER BY expires_at, id`
          )
          .all(input.medicationId) as LotRow[]
      }
      const totalAvailable = lots.reduce((acc, l) => acc + l.quantity, 0)
      if (totalAvailable < qty) {
        throw vErr(`Estoque insuficiente. Disponível: ${totalAvailable}, solicitado: ${qty}.`)
      }
      let remaining = qty
      let firstMovementId: number | null = null
      for (const lot of lots) {
        if (remaining <= 0) break
        const take = Math.min(remaining, lot.quantity)
        db.prepare('UPDATE medication_lots SET quantity = quantity - ? WHERE id = ?').run(
          take,
          lot.id
        )
        const movId = insertMovement(lot.id, take)
        if (firstMovementId == null) firstMovementId = movId
        remaining -= take
      }
      // firstMovementId garantido não-null porque qty > 0 e totalAvailable >= qty.
      return firstMovementId as number
    }

    // ajuste
    if (!lotIdInput) throw vErr('Ajuste exige um lote específico.')
    const lot = db
      .prepare<[number], LotRow>('SELECT * FROM medication_lots WHERE id = ?')
      .get(lotIdInput)
    if (!lot || lot.medication_id !== input.medicationId) {
      throw nfErr('Lote não encontrado para este medicamento.')
    }
    db.prepare('UPDATE medication_lots SET quantity = quantity + ? WHERE id = ?').run(
      qty,
      lotIdInput
    )
    return insertMovement(lotIdInput, qty)
  })

  const movementId = tx()
  logAudit({
    action: 'PHARMACY_MOVEMENT',
    entity: 'stock_movement',
    entityId: String(movementId),
    details: {
      medicationId: input.medicationId,
      type: input.type,
      quantity: input.quantity,
      reason
    }
  })
  return getMovementById(movementId)
}

function getMovementById(id: number): StockMovement {
  const row = getDb()
    .prepare<[number], MovementRow>(
      `SELECT sm.*, m.name AS medication_name, l.lot_number AS lot_number,
              p.full_name AS patient_name
       FROM stock_movements sm
       JOIN medications m ON m.id = sm.medication_id
       LEFT JOIN medication_lots l ON l.id = sm.lot_id
       LEFT JOIN patients p ON p.id = sm.patient_id
       WHERE sm.id = ?`
    )
    .get(id)
  if (!row) throw nfErr('Movimentação não encontrada.')
  return mapMovement(row)
}

export function listMovements(
  filter: { medicationId?: number; limit?: number } = {}
): StockMovement[] {
  const db = getDb()
  const limit = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 100)))
  if (filter.medicationId) {
    return db
      .prepare<[number, number], MovementRow>(
        `SELECT sm.*, m.name AS medication_name, l.lot_number AS lot_number,
                p.full_name AS patient_name
         FROM stock_movements sm
         JOIN medications m ON m.id = sm.medication_id
         LEFT JOIN medication_lots l ON l.id = sm.lot_id
         LEFT JOIN patients p ON p.id = sm.patient_id
         WHERE sm.medication_id = ?
         ORDER BY datetime(sm.created_at) DESC
         LIMIT ?`
      )
      .all(filter.medicationId, limit)
      .map(mapMovement)
  }
  return db
    .prepare<[number], MovementRow>(
      `SELECT sm.*, m.name AS medication_name, l.lot_number AS lot_number,
              p.full_name AS patient_name
       FROM stock_movements sm
       JOIN medications m ON m.id = sm.medication_id
       LEFT JOIN medication_lots l ON l.id = sm.lot_id
       LEFT JOIN patients p ON p.id = sm.patient_id
       ORDER BY datetime(sm.created_at) DESC
       LIMIT ?`
    )
    .all(limit)
    .map(mapMovement)
}

/* -------------------- Dispensação -------------------- */

export function dispense(
  input: DispensationInput,
  performedByUserId: number | null,
  performedByName: string | null
): Dispensation {
  if (!input.patientId || input.patientId <= 0) throw vErr('Paciente inválido.')
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw vErr('Informe pelo menos um item para dispensar.')
  }
  for (const it of input.items) {
    if (!it.medicationId || it.medicationId <= 0) throw vErr('Medicamento inválido em item.')
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      throw vErr('Quantidade inválida em item.')
    }
  }

  const db = getDb()

  const patient = db
    .prepare<[number], { id: number }>('SELECT id FROM patients WHERE id = ?')
    .get(input.patientId)
  if (!patient) throw nfErr('Paciente não encontrado.')

  // Pré-checa estoque para falhar antes de iniciar transação cara.
  // Agrega quantidades por medicamento (lida com itens duplicados na entrada).
  const aggregated = new Map<number, number>()
  for (const it of input.items) {
    aggregated.set(
      it.medicationId,
      (aggregated.get(it.medicationId) ?? 0) + Math.floor(it.quantity)
    )
  }
  for (const [medicationId, totalRequested] of aggregated.entries()) {
    const med = getMedication(medicationId)
    if (!med) throw nfErr(`Medicamento #${medicationId} não encontrado.`)
    const total = (
      db
        .prepare<
          [number],
          { total: number }
        >('SELECT COALESCE(SUM(quantity), 0) AS total FROM medication_lots WHERE medication_id = ? AND quantity > 0')
        .get(medicationId) as { total: number }
    ).total
    if (total < totalRequested) {
      throw vErr(
        `Estoque insuficiente para ${med.name}. Disponível: ${total}, solicitado: ${totalRequested}.`
      )
    }
  }

  const tx = db.transaction(() => {
    const dispResult = db
      .prepare(
        `INSERT INTO dispensations (prescription_id, patient_id, performed_by_user_id, performed_by_name, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.prescriptionId ?? null,
        input.patientId,
        performedByUserId,
        performedByName,
        normalizeText(input.notes)
      )
    const dispensationId = Number(dispResult.lastInsertRowid)

    for (const it of input.items) {
      let remaining = Math.floor(it.quantity)
      let lots: LotRow[]
      if (it.lotId) {
        const lot = db
          .prepare<[number], LotRow>('SELECT * FROM medication_lots WHERE id = ? AND quantity > 0')
          .get(it.lotId)
        if (!lot || lot.medication_id !== it.medicationId) {
          throw vErr(`Lote #${it.lotId} não pertence ao medicamento #${it.medicationId}.`)
        }
        lots = [lot]
      } else {
        lots = db
          .prepare<[number], LotRow>(
            `SELECT * FROM medication_lots
             WHERE medication_id = ? AND quantity > 0
             ORDER BY expires_at, id`
          )
          .all(it.medicationId) as LotRow[]
      }
      for (const lot of lots) {
        if (remaining <= 0) break
        const take = Math.min(remaining, lot.quantity)
        db.prepare('UPDATE medication_lots SET quantity = quantity - ? WHERE id = ?').run(
          take,
          lot.id
        )
        db.prepare(
          `INSERT INTO stock_movements
             (medication_id, lot_id, type, quantity, reason, dispensation_id, prescription_id,
              patient_id, performed_by_user_id, performed_by_name)
           VALUES (?, ?, 'dispensacao', ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          it.medicationId,
          lot.id,
          take,
          'Dispensação',
          dispensationId,
          input.prescriptionId ?? null,
          input.patientId,
          performedByUserId,
          performedByName
        )
        remaining -= take
      }
      if (remaining > 0) {
        // Não deveria acontecer dada pré-checagem, mas garante consistência.
        throw vErr(`Estoque insuficiente durante dispensação do item #${it.medicationId}.`)
      }
    }

    return dispensationId
  })

  const id = tx()
  logAudit({
    action: 'PHARMACY_DISPENSE',
    entity: 'dispensation',
    entityId: String(id),
    details: {
      patientId: input.patientId,
      prescriptionId: input.prescriptionId ?? null,
      itemCount: input.items.length
    }
  })
  return getDispensation(id)!
}

export function listDispensations(
  filter: { patientId?: number; limit?: number } = {}
): Dispensation[] {
  const db = getDb()
  const limit = Math.max(1, Math.min(200, Math.floor(filter.limit ?? 50)))
  const rows = filter.patientId
    ? db
        .prepare<[number, number], DispRow>(
          `SELECT d.*, p.full_name AS patient_name
           FROM dispensations d
           JOIN patients p ON p.id = d.patient_id
           WHERE d.patient_id = ?
           ORDER BY datetime(d.dispensed_at) DESC
           LIMIT ?`
        )
        .all(filter.patientId, limit)
    : db
        .prepare<[number], DispRow>(
          `SELECT d.*, p.full_name AS patient_name
           FROM dispensations d
           JOIN patients p ON p.id = d.patient_id
           ORDER BY datetime(d.dispensed_at) DESC
           LIMIT ?`
        )
        .all(limit)
  return rows.map((r) => attachItems(r))
}

function attachItems(r: DispRow): Dispensation {
  const items = getDb()
    .prepare<[number], DispItemRow>(
      `SELECT sm.medication_id, m.name AS medication_name,
              sm.lot_id, l.lot_number, sm.quantity
       FROM stock_movements sm
       JOIN medications m ON m.id = sm.medication_id
       LEFT JOIN medication_lots l ON l.id = sm.lot_id
       WHERE sm.dispensation_id = ?
       ORDER BY sm.id`
    )
    .all(r.id)
  return {
    id: r.id,
    prescriptionId: r.prescription_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    dispensedAt: r.dispensed_at,
    performedByUserId: r.performed_by_user_id,
    performedByName: r.performed_by_name,
    notes: r.notes,
    createdAt: r.created_at,
    items: items.map((i) => ({
      medicationId: i.medication_id,
      medicationName: i.medication_name,
      lotId: i.lot_id,
      lotNumber: i.lot_number,
      quantity: i.quantity
    }))
  }
}

export function getDispensation(id: number): Dispensation | null {
  const row = getDb()
    .prepare<[number], DispRow>(
      `SELECT d.*, p.full_name AS patient_name
       FROM dispensations d
       JOIN patients p ON p.id = d.patient_id
       WHERE d.id = ?`
    )
    .get(id)
  return row ? attachItems(row) : null
}
