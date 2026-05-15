/**
 * Testes da Round 8b: catálogo de medicamentos, lotes, FEFO, dispensação.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: {
    getName: () => 'Gestão Hospitalar',
    getVersion: () => '0.1.0-test',
    getPath: () => tmpdir()
  }
}))

let tempDir: string

async function freshDb(): Promise<{
  pharmacy: typeof import('../src/main/repositories/pharmacy')
  patientsRepo: typeof import('../src/main/repositories/patients')
}> {
  tempDir = mkdtempSync(join(tmpdir(), 'gestao-ubs-r8b-'))
  process.env.GESTAO_HOSPITAL_DB_PATH = join(tempDir, 'test.db')
  vi.resetModules()
  const dbModule = await import('../src/main/db')
  dbModule.initDatabase()
  const pharmacy = await import('../src/main/repositories/pharmacy')
  const patientsRepo = await import('../src/main/repositories/patients')
  return { pharmacy, patientsRepo }
}

beforeEach(() => {
  process.env.GESTAO_HOSPITAL_DB_PATH = ''
})

afterEach(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

const VALID_PATIENT = {
  fullName: 'Maria da Silva',
  cpf: '12345678909',
  cns: null,
  birthDate: '1985-03-12',
  sex: 'F' as const,
  phone: null,
  email: null,
  motherName: null,
  race: null,
  addressStreet: null,
  addressNumber: null,
  addressComplement: null,
  addressNeighborhood: null,
  addressCity: null,
  addressState: null,
  addressZip: null,
  notes: null
}

describe('Catálogo de medicamentos', () => {
  it('cria, atualiza e desativa medicamento', async () => {
    const { pharmacy } = await freshDb()
    const created = pharmacy.createMedication({
      name: 'Dipirona',
      activeIngredient: 'Dipirona sódica',
      dosage: '500 mg',
      form: 'comprimido',
      unit: 'comprimido',
      isRemume: true,
      minStock: 100
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.isRemume).toBe(true)
    expect(created.minStock).toBe(100)

    const updated = pharmacy.updateMedication(created.id, {
      name: 'Dipirona',
      activeIngredient: 'Dipirona sódica',
      dosage: '500 mg',
      form: 'comprimido',
      unit: 'comprimido',
      isRemume: true,
      minStock: 200
    })
    expect(updated.minStock).toBe(200)

    const deactivated = pharmacy.setMedicationActive(created.id, false)
    expect(deactivated.active).toBe(false)
    expect(pharmacy.listMedications().length).toBe(0)
    expect(pharmacy.listMedications(true).length).toBe(1)
  })

  it('rejeita duplicata por nome+dosagem+forma', async () => {
    const { pharmacy } = await freshDb()
    pharmacy.createMedication({ name: 'Paracetamol', dosage: '500 mg', form: 'comp' })
    expect(() =>
      pharmacy.createMedication({ name: 'Paracetamol', dosage: '500 mg', form: 'comp' })
    ).toThrow(/Já existe/)
  })
})

describe('Lotes e estoque', () => {
  it('adiciona lote e cria movimentação de entrada automática', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Amoxicilina', dosage: '500 mg' })
    pharmacy.addLot(
      {
        medicationId: med.id,
        lotNumber: 'L001',
        manufacturer: 'EMS',
        expiresAt: '2026-12-31',
        entryQuantity: 100
      },
      null,
      null
    )
    const lots = pharmacy.listLots(med.id)
    expect(lots.length).toBe(1)
    expect(lots[0].quantity).toBe(100)

    const moves = pharmacy.listMovements({ medicationId: med.id })
    expect(moves.length).toBe(1)
    expect(moves[0].type).toBe('entrada')
    expect(moves[0].quantity).toBe(100)
  })

  it('listStock soma quantidades de lotes ativos e detecta abaixo do mínimo', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Losartana', dosage: '50 mg', minStock: 200 })
    pharmacy.addLot(
      {
        medicationId: med.id,
        lotNumber: 'A1',
        expiresAt: '2030-01-01',
        entryQuantity: 50
      },
      null,
      null
    )
    pharmacy.addLot(
      {
        medicationId: med.id,
        lotNumber: 'A2',
        expiresAt: '2031-01-01',
        entryQuantity: 80
      },
      null,
      null
    )
    const stock = pharmacy.listStock()
    expect(stock.length).toBe(1)
    expect(stock[0].totalQuantity).toBe(130)
    expect(stock[0].belowMin).toBe(true)
    expect(stock[0].nextExpiry).toBe('2030-01-01')
  })

  it('belowMin é false quando min_stock=0 ou estoque igual ao mínimo', async () => {
    const { pharmacy } = await freshDb()
    // min_stock = 0 (default) e sem lotes → não deve alertar
    pharmacy.createMedication({ name: 'Med default' })
    // min_stock = 100 e estoque exatamente 100 → não deve alertar
    const med2 = pharmacy.createMedication({ name: 'Med exato', minStock: 100 })
    pharmacy.addLot(
      { medicationId: med2.id, lotNumber: 'E', expiresAt: '2030-01-01', entryQuantity: 100 },
      null,
      null
    )
    const stock = pharmacy.listStock()
    expect(stock.every((s) => s.belowMin === false)).toBe(true)
  })

  it('expiringSoon true se vencimento dentro de 90 dias', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Vitamina C' })
    const soon = new Date()
    soon.setDate(soon.getDate() + 30)
    pharmacy.addLot(
      {
        medicationId: med.id,
        lotNumber: 'V1',
        expiresAt: soon.toISOString().slice(0, 10),
        entryQuantity: 10
      },
      null,
      null
    )
    const stock = pharmacy.listStock()
    expect(stock[0].expiringSoon).toBe(true)
  })
})

describe('FEFO na saída/perda', () => {
  it('saída sem lote consome do lote mais próximo do vencimento primeiro', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Ibuprofeno' })
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'B', expiresAt: '2027-06-01', entryQuantity: 50 },
      null,
      null
    )
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'A', expiresAt: '2026-01-01', entryQuantity: 30 },
      null,
      null
    )

    pharmacy.addMovement({ medicationId: med.id, type: 'saida', quantity: 20 }, null, null)
    const lots = pharmacy.listLots(med.id)
    const a = lots.find((l) => l.lotNumber === 'A')!
    const b = lots.find((l) => l.lotNumber === 'B')!
    expect(a.quantity).toBe(10)
    expect(b.quantity).toBe(50)
  })

  it('saída maior que um lote consome do próximo (em ordem de validade)', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Captopril' })
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'A', expiresAt: '2026-01-01', entryQuantity: 30 },
      null,
      null
    )
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'B', expiresAt: '2027-06-01', entryQuantity: 50 },
      null,
      null
    )

    pharmacy.addMovement({ medicationId: med.id, type: 'saida', quantity: 60 }, null, null)
    const lots = pharmacy.listLots(med.id)
    const a = lots.find((l) => l.lotNumber === 'A')!
    const b = lots.find((l) => l.lotNumber === 'B')!
    expect(a.quantity).toBe(0)
    expect(b.quantity).toBe(20)
  })

  it('saída com lotId de outro medicamento é rejeitada', async () => {
    const { pharmacy } = await freshDb()
    const medA = pharmacy.createMedication({ name: 'MedA' })
    const medB = pharmacy.createMedication({ name: 'MedB' })
    const lotB = pharmacy.addLot(
      { medicationId: medB.id, lotNumber: 'B1', expiresAt: '2027-01-01', entryQuantity: 50 },
      null,
      null
    )
    expect(() =>
      pharmacy.addMovement(
        { medicationId: medA.id, lotId: lotB.id, type: 'saida', quantity: 10 },
        null,
        null
      )
    ).toThrow(/não encontrado para este medicamento/)
    // MedB intacto
    const lots = pharmacy.listLots(medB.id)
    expect(lots[0].quantity).toBe(50)
  })

  it('saída via FEFO em múltiplos lotes registra um movimento por lote', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'Ibuprofeno' })
    const lotA = pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'A', expiresAt: '2025-06-01', entryQuantity: 30 },
      null,
      null
    )
    const lotB = pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'B', expiresAt: '2026-01-01', entryQuantity: 30 },
      null,
      null
    )
    pharmacy.addMovement({ medicationId: med.id, type: 'saida', quantity: 50 }, null, null)
    const moves = pharmacy.listMovements({ medicationId: med.id }).filter((m) => m.type === 'saida')
    expect(moves.length).toBe(2)
    const sumByLot: Record<number, number> = {}
    for (const m of moves) {
      if (m.lotId != null) sumByLot[m.lotId] = (sumByLot[m.lotId] ?? 0) + m.quantity
    }
    // FEFO consome A primeiro (vence antes), depois 20 de B.
    expect(sumByLot[lotA.id]).toBe(30)
    expect(sumByLot[lotB.id]).toBe(20)
  })

  it('falha se saída excede estoque total', async () => {
    const { pharmacy } = await freshDb()
    const med = pharmacy.createMedication({ name: 'AAS' })
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'X', expiresAt: '2026-01-01', entryQuantity: 10 },
      null,
      null
    )
    expect(() =>
      pharmacy.addMovement({ medicationId: med.id, type: 'saida', quantity: 50 }, null, null)
    ).toThrow(/Estoque insuficiente/)
  })
})

describe('Dispensação', () => {
  it('dispensa múltiplos itens, baixa estoque via FEFO e gera registro com itens', async () => {
    const { pharmacy, patientsRepo } = await freshDb()
    const patient = patientsRepo.createPatient(VALID_PATIENT)
    const med1 = pharmacy.createMedication({ name: 'Dipirona', dosage: '500 mg' })
    const med2 = pharmacy.createMedication({ name: 'Omeprazol', dosage: '20 mg' })
    pharmacy.addLot(
      { medicationId: med1.id, lotNumber: 'D1', expiresAt: '2026-01-01', entryQuantity: 30 },
      null,
      null
    )
    pharmacy.addLot(
      { medicationId: med1.id, lotNumber: 'D2', expiresAt: '2027-06-01', entryQuantity: 50 },
      null,
      null
    )
    pharmacy.addLot(
      { medicationId: med2.id, lotNumber: 'O1', expiresAt: '2026-12-01', entryQuantity: 100 },
      null,
      null
    )

    const disp = pharmacy.dispense(
      {
        patientId: patient.id,
        prescriptionId: null,
        items: [
          { medicationId: med1.id, quantity: 40 },
          { medicationId: med2.id, quantity: 10 }
        ]
      },
      null,
      'Farmacêutico Teste'
    )

    expect(disp.items.length).toBeGreaterThanOrEqual(2)
    expect(disp.patientId).toBe(patient.id)
    expect(disp.performedByName).toBe('Farmacêutico Teste')

    const stock = pharmacy.listStock()
    const s1 = stock.find((m) => m.id === med1.id)!
    const s2 = stock.find((m) => m.id === med2.id)!
    expect(s1.totalQuantity).toBe(40) // 80 - 40
    expect(s2.totalQuantity).toBe(90)

    // Lote D1 (vence antes) deve estar zerado primeiro
    const lots1 = pharmacy.listLots(med1.id)
    const d1 = lots1.find((l) => l.lotNumber === 'D1')!
    const d2 = lots1.find((l) => l.lotNumber === 'D2')!
    expect(d1.quantity).toBe(0)
    expect(d2.quantity).toBe(40)
  })

  it('agrega quantidades de itens duplicados na pré-checagem', async () => {
    const { pharmacy, patientsRepo } = await freshDb()
    const patient = patientsRepo.createPatient(VALID_PATIENT)
    const med = pharmacy.createMedication({ name: 'Soma duplicada' })
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'D', expiresAt: '2027-01-01', entryQuantity: 10 },
      null,
      null
    )
    // Cada item passa individualmente (10 >= 6) mas a soma (12) excede 10.
    expect(() =>
      pharmacy.dispense(
        {
          patientId: patient.id,
          items: [
            { medicationId: med.id, quantity: 6 },
            { medicationId: med.id, quantity: 6 }
          ]
        },
        null,
        null
      )
    ).toThrow(/Estoque insuficiente.*Disponível: 10, solicitado: 12/)
    expect(pharmacy.listStock()[0].totalQuantity).toBe(10)
  })

  it('rejeita dispensação com lotId de outro medicamento', async () => {
    const { pharmacy, patientsRepo } = await freshDb()
    const patient = patientsRepo.createPatient(VALID_PATIENT)
    const medA = pharmacy.createMedication({ name: 'A' })
    const medB = pharmacy.createMedication({ name: 'B' })
    pharmacy.addLot(
      { medicationId: medA.id, lotNumber: 'A1', expiresAt: '2027-01-01', entryQuantity: 10 },
      null,
      null
    )
    const lotB = pharmacy.addLot(
      { medicationId: medB.id, lotNumber: 'B1', expiresAt: '2027-01-01', entryQuantity: 10 },
      null,
      null
    )
    expect(() =>
      pharmacy.dispense(
        {
          patientId: patient.id,
          items: [{ medicationId: medA.id, lotId: lotB.id, quantity: 5 }]
        },
        null,
        null
      )
    ).toThrow(/não pertence ao medicamento/)
    // Estoques preservados
    expect(pharmacy.listLots(medA.id)[0].quantity).toBe(10)
    expect(pharmacy.listLots(medB.id)[0].quantity).toBe(10)
  })

  it('rejeita dispensação se estoque insuficiente sem alterar nada', async () => {
    const { pharmacy, patientsRepo } = await freshDb()
    const patient = patientsRepo.createPatient(VALID_PATIENT)
    const med = pharmacy.createMedication({ name: 'Ranitidina' })
    pharmacy.addLot(
      { medicationId: med.id, lotNumber: 'R1', expiresAt: '2026-01-01', entryQuantity: 5 },
      null,
      null
    )
    expect(() =>
      pharmacy.dispense(
        { patientId: patient.id, items: [{ medicationId: med.id, quantity: 10 }] },
        null,
        null
      )
    ).toThrow(/insuficiente/)
    // Estoque preservado
    expect(pharmacy.listStock()[0].totalQuantity).toBe(5)
  })
})
