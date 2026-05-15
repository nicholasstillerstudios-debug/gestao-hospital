import { getDb } from '../db'
import { logAudit } from '../audit'
import type { DemoSeedHospitalResult } from '@shared/types'

const DEMO_PATIENTS: Array<{
  full_name: string
  cpf: string
  cns: string
  birth_date: string
  sex: 'M' | 'F' | 'O'
  phone: string
  mother_name: string
  address_street: string
  address_neighborhood: string
  address_city: string
  address_state: string
}> = [
  {
    full_name: 'Ana Paula Ribeiro',
    cpf: '12345678901',
    cns: '123456789012340',
    birth_date: '1985-04-12',
    sex: 'F',
    phone: '(11) 98877-1122',
    mother_name: 'Maria das Graças Ribeiro',
    address_street: 'Rua das Flores, 123',
    address_neighborhood: 'Centro',
    address_city: 'São Paulo',
    address_state: 'SP'
  },
  {
    full_name: 'João Carlos da Silva',
    cpf: '23456789012',
    cns: '234567890123401',
    birth_date: '1972-09-28',
    sex: 'M',
    phone: '(11) 97766-3344',
    mother_name: 'Rosa da Silva',
    address_street: 'Av. Brasil, 456',
    address_neighborhood: 'Jardim América',
    address_city: 'São Paulo',
    address_state: 'SP'
  },
  {
    full_name: 'Beatriz Nogueira Alves',
    cpf: '34567890123',
    cns: '345678901234012',
    birth_date: '1998-02-05',
    sex: 'F',
    phone: '(11) 96655-5566',
    mother_name: 'Helena Alves',
    address_street: 'Rua XV de Novembro, 789',
    address_neighborhood: 'Vila Nova',
    address_city: 'São Paulo',
    address_state: 'SP'
  },
  {
    full_name: 'Carlos Eduardo Pereira',
    cpf: '45678901234',
    cns: '456789012340123',
    birth_date: '1960-11-30',
    sex: 'M',
    phone: '(11) 95544-7788',
    mother_name: 'Lúcia Pereira',
    address_street: 'Rua do Comércio, 321',
    address_neighborhood: 'Santa Cecília',
    address_city: 'São Paulo',
    address_state: 'SP'
  },
  {
    full_name: 'Daniela Fernandes Oliveira',
    cpf: '56789012345',
    cns: '567890123401234',
    birth_date: '1990-07-14',
    sex: 'F',
    phone: '(11) 94433-9900',
    mother_name: 'Marlene Oliveira',
    address_street: 'Rua dos Pinheiros, 654',
    address_neighborhood: 'Pinheiros',
    address_city: 'São Paulo',
    address_state: 'SP'
  },
  {
    full_name: 'Eduardo Santos Rocha',
    cpf: '67890123456',
    cns: '678901234012345',
    birth_date: '1978-03-22',
    sex: 'M',
    phone: '(11) 93322-1010',
    mother_name: 'Teresa Rocha',
    address_street: 'Av. Paulista, 987',
    address_neighborhood: 'Bela Vista',
    address_city: 'São Paulo',
    address_state: 'SP'
  }
]

const DEMO_PROFESSIONALS: Array<{
  full_name: string
  council_type: string
  council_number: string
  specialty: string
}> = [
  {
    full_name: 'Dra. Ana Souza',
    council_type: 'CRM',
    council_number: '123456-SP',
    specialty: 'Clínica Geral'
  },
  {
    full_name: 'Dr. Bruno Costa',
    council_type: 'CRM',
    council_number: '654321-SP',
    specialty: 'Pediatria'
  },
  {
    full_name: 'Enf. Carla Lima',
    council_type: 'COREN',
    council_number: '222333-SP',
    specialty: 'Enfermagem'
  }
]

/**
 * Cria dados hospitalares de demonstração: pacientes/profissionais (se ainda
 * não houver), alas, leitos e internações com evoluções, sinais vitais e
 * balanço hídrico. Idempotente: pula se já existirem alas cadastradas.
 */
export function seedHospitalDemo(
  calledByUserId: number | null,
  calledByName: string | null
): DemoSeedHospitalResult {
  const db = getDb()

  const existingWards = db
    .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM wards')
    .get() as { count: number }
  if (existingWards.count > 0) {
    return { skipped: true, wardsCreated: 0, bedsCreated: 0, admissionsCreated: 0 }
  }

  let wardsCreated = 0
  let bedsCreated = 0
  let admissionsCreated = 0

  const run = db.transaction(() => {
    // Garante profissionais ativos
    const profCountRow = db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM professionals')
      .get() as { count: number }
    if (profCountRow.count === 0) {
      const insertProf = db.prepare(
        `INSERT INTO professionals (full_name, council_type, council_number, specialty, active)
         VALUES (?, ?, ?, ?, 1)`
      )
      for (const p of DEMO_PROFESSIONALS) {
        insertProf.run(p.full_name, p.council_type, p.council_number, p.specialty)
      }
    }

    // Garante pacientes
    const patientCountRow = db
      .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM patients')
      .get() as { count: number }
    if (patientCountRow.count === 0) {
      const insertPatient = db.prepare(
        `INSERT INTO patients
           (full_name, cpf, cns, birth_date, sex, phone, mother_name,
            address_street, address_neighborhood, address_city, address_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const p of DEMO_PATIENTS) {
        insertPatient.run(
          p.full_name,
          p.cpf,
          p.cns,
          p.birth_date,
          p.sex,
          p.phone,
          p.mother_name,
          p.address_street,
          p.address_neighborhood,
          p.address_city,
          p.address_state
        )
      }
    }

    const patients = db
      .prepare<[], { id: number }>('SELECT id FROM patients ORDER BY id LIMIT 6')
      .all() as Array<{ id: number }>
    if (patients.length === 0) {
      throw Object.assign(new Error('Sem pacientes para criar internações.'), {
        code: 'DEMO_NO_PATIENTS'
      })
    }

    const professional = db
      .prepare<
        [],
        { id: number }
      >('SELECT id FROM professionals WHERE active = 1 ORDER BY id LIMIT 1')
      .get() as { id: number } | undefined

    const insertWard = db.prepare(
      `INSERT INTO wards (name, kind, notes, active) VALUES (?, ?, ?, 1)`
    )
    const insertBed = db.prepare(
      `INSERT INTO beds (ward_id, code, kind, status) VALUES (?, ?, ?, 'livre')`
    )

    // kind dos leitos deve estar no CHECK constraint:
    //   ('standard','isolamento','uti','semiintensiva','obstetrico','pediatrico','bercario')
    // kind das alas deve estar no CHECK constraint:
    //   ('enfermaria','uti','semiintensiva','obstetrica','pediatria','psiquiatria','isolamento','observacao_ps','outro')
    const wards = [
      {
        name: 'Clínica Médica',
        kind: 'enfermaria',
        notes: 'Internação clínica geral',
        bedKind: 'standard',
        beds: ['CM-01', 'CM-02', 'CM-03', 'CM-04']
      },
      {
        name: 'UTI Adulto',
        kind: 'uti',
        notes: 'Unidade de terapia intensiva adulto',
        bedKind: 'uti',
        beds: ['UTI-01', 'UTI-02', 'UTI-03']
      },
      {
        name: 'Observação',
        kind: 'observacao_ps',
        notes: 'Leitos de observação curta',
        bedKind: 'standard',
        beds: ['OBS-01', 'OBS-02']
      }
    ]

    const wardIds: number[] = []
    const bedIdsByWard: Record<number, number[]> = {}

    for (const w of wards) {
      const r = insertWard.run(w.name, w.kind, w.notes)
      const wardId = Number(r.lastInsertRowid)
      wardIds.push(wardId)
      wardsCreated++
      bedIdsByWard[wardId] = []
      for (const code of w.beds) {
        const br = insertBed.run(wardId, code, w.bedKind)
        bedIdsByWard[wardId].push(Number(br.lastInsertRowid))
        bedsCreated++
      }
    }

    // Admite pacientes em alguns leitos
    const admitData = [
      {
        patientIdx: 0,
        wardIdx: 0,
        bedIdx: 0,
        type: 'urgencia',
        cid: 'J18.0',
        diagnosis: 'Pneumonia adquirida na comunidade',
        complaint: 'Febre, tosse produtiva há 5 dias'
      },
      {
        patientIdx: 1,
        wardIdx: 0,
        bedIdx: 1,
        type: 'eletiva',
        cid: 'I10',
        diagnosis: 'Controle de hipertensão grave',
        complaint: 'Avaliação para ajuste de anti-hipertensivos'
      },
      {
        patientIdx: 2,
        wardIdx: 1,
        bedIdx: 0,
        type: 'emergencia',
        cid: 'I21.0',
        diagnosis: 'IAM com supra de ST — pós-reperfusão',
        complaint: 'Dor torácica típica há 1 hora'
      },
      {
        patientIdx: 3,
        wardIdx: 2,
        bedIdx: 0,
        type: 'urgencia',
        cid: 'N39.0',
        diagnosis: 'ITU complicada com urosepse',
        complaint: 'Disúria, febre e calafrios'
      }
    ]

    const insertAdmission = db.prepare(
      `INSERT INTO admissions
         (patient_id, attending_professional_id, current_bed_id, admitted_at,
          admission_type, chief_complaint, admission_diagnosis, admission_cid10,
          status, notes, created_by_user_id)
       VALUES (?, ?, ?, datetime('now', ?), ?, ?, ?, ?, 'ativa', ?, ?)`
    )
    const insertBedMovement = db.prepare(
      `INSERT INTO bed_movements
         (admission_id, bed_id, ward_id, action, performed_by_user_id, performed_by_name, created_at)
       VALUES (?, ?, ?, 'admissao', ?, ?, datetime('now', ?))`
    )
    const insertEvolution = db.prepare(
      `INSERT INTO admission_evolutions
         (admission_id, professional_id, author_role, evolution_at,
          subjective, objective, assessment, plan, created_by_user_id)
       VALUES (?, ?, ?, datetime('now', ?), ?, ?, ?, ?, ?)`
    )
    const insertVital = db.prepare(
      `INSERT INTO admission_vital_signs
         (admission_id, measured_at, systolic_bp, diastolic_bp, heart_rate,
          respiratory_rate, temperature_c, oxygen_saturation, created_by_user_id)
       VALUES (?, datetime('now', ?), ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertFluid = db.prepare(
      `INSERT INTO admission_fluid_balance
         (admission_id, type, subtype, volume_ml, recorded_at, created_by_user_id)
       VALUES (?, ?, ?, ?, datetime('now', ?), ?)`
    )
    const updateBed = db.prepare(
      `UPDATE beds SET status = 'ocupado', current_admission_id = ? WHERE id = ?`
    )

    for (const adm of admitData) {
      if (adm.patientIdx >= patients.length) continue
      const wardId = wardIds[adm.wardIdx]
      const bedIds = bedIdsByWard[wardId]
      if (!bedIds || adm.bedIdx >= bedIds.length) continue

      const bedId = bedIds[adm.bedIdx]
      const offsetH = -(admissionsCreated * 12 + 2)
      const r = insertAdmission.run(
        patients[adm.patientIdx].id,
        professional?.id ?? null,
        bedId,
        `${offsetH} hours`,
        adm.type,
        adm.complaint,
        adm.diagnosis,
        adm.cid,
        adm.diagnosis,
        calledByUserId
      )
      const admissionId = Number(r.lastInsertRowid)
      updateBed.run(admissionId, bedId)
      insertBedMovement.run(
        admissionId,
        bedId,
        wardId,
        calledByUserId,
        calledByName,
        `${offsetH} hours`
      )
      admissionsCreated++

      // Evolução inicial
      insertEvolution.run(
        admissionId,
        professional?.id ?? null,
        'medico',
        `${offsetH + 1} hours`,
        adm.complaint,
        'Paciente orientado, hemodinamicamente estável.',
        adm.diagnosis,
        'Continuar tratamento conforme prescrição.',
        calledByUserId
      )

      // Sinais vitais (entrada e 6h depois)
      insertVital.run(
        admissionId,
        `${offsetH + 1} hours`,
        120,
        80,
        88,
        18,
        36.8,
        96,
        calledByUserId
      )
      insertVital.run(
        admissionId,
        `${offsetH + 7} hours`,
        118,
        76,
        82,
        16,
        36.5,
        97,
        calledByUserId
      )

      // Balanço hídrico
      insertFluid.run(admissionId, 'entrada', 'SF 0,9%', 500, `${offsetH + 2} hours`, calledByUserId)
      insertFluid.run(
        admissionId,
        'entrada',
        'Água oral',
        200,
        `${offsetH + 5} hours`,
        calledByUserId
      )
      insertFluid.run(
        admissionId,
        'saida',
        'Diurese',
        350,
        `${offsetH + 6} hours`,
        calledByUserId
      )
    }
  })

  run()

  logAudit({
    action: 'DEMO_SEED_HOSPITAL',
    entity: 'demo',
    entityId: null,
    details: { wardsCreated, bedsCreated, admissionsCreated, calledByUserId, calledByName }
  })

  return { skipped: false, wardsCreated, bedsCreated, admissionsCreated }
}
