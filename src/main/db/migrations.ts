import type Database from 'better-sqlite3'

interface Migration {
  id: number
  name: string
  sql: string
  /**
   * Quando true, desabilita PRAGMA foreign_keys ANTES da transação e
   * restaura ao fim. Necessário para migrations que fazem DROP TABLE em
   * tabela referenciada por outras (ex.: recriar `users` para alterar o
   * CHECK constraint do papel) — caso contrário o DROP cascateia
   * `ON DELETE SET NULL` nas tabelas filhas. SQLite não permite alterar
   * `foreign_keys` dentro de uma transação.
   */
  requiresForeignKeysOff?: boolean
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin','recepcao','enfermagem','medico')),
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS professionals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        cpf TEXT,
        council_type TEXT,
        council_number TEXT,
        specialty TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        cpf TEXT UNIQUE,
        cns TEXT UNIQUE,
        birth_date TEXT NOT NULL,
        sex TEXT NOT NULL CHECK (sex IN ('M','F','O')),
        phone TEXT,
        email TEXT,
        mother_name TEXT,
        race TEXT,
        address_street TEXT,
        address_number TEXT,
        address_complement TEXT,
        address_neighborhood TEXT,
        address_city TEXT,
        address_state TEXT,
        address_zip TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);
      CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
      CREATE INDEX IF NOT EXISTS idx_patients_cns ON patients(cns);

      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
        scheduled_at TEXT NOT NULL,
        duration_min INTEGER NOT NULL DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'agendado'
          CHECK (status IN ('agendado','aguardando','em_atendimento','concluido','cancelado','faltou')),
        reason TEXT,
        triage_color TEXT CHECK (triage_color IN ('azul','verde','amarelo','laranja','vermelho')),
        triage_notes TEXT,
        notes TEXT,
        checked_in_at TEXT,
        started_at TEXT,
        ended_at TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_professional ON appointments(professional_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

      CREATE TABLE IF NOT EXISTS attendances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        prescription TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_attendances_patient ON attendances(patient_id);

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
    `
  },
  {
    id: 2,
    name: 'app_settings_and_anonymization',
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      ALTER TABLE patients ADD COLUMN anonymized_at TEXT;
    `
  },
  {
    id: 3,
    name: 'prescriptions_and_requisitions',
    sql: `
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        attendance_id INTEGER REFERENCES attendances(id) ON DELETE SET NULL,
        professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        items TEXT NOT NULL,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_attendance ON prescriptions(attendance_id);

      CREATE TABLE IF NOT EXISTS requisitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        attendance_id INTEGER REFERENCES attendances(id) ON DELETE SET NULL,
        professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK (type IN ('laboratorio','imagem','procedimento','encaminhamento')),
        items TEXT NOT NULL,
        observations TEXT,
        status TEXT NOT NULL DEFAULT 'solicitada'
          CHECK (status IN ('solicitada','realizada','cancelada')),
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_requisitions_patient ON requisitions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_requisitions_attendance ON requisitions(attendance_id);
    `
  },
  {
    id: 4,
    name: 'patient_calls',
    sql: `
      CREATE TABLE IF NOT EXISTS patient_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        patient_name TEXT NOT NULL,
        room TEXT NOT NULL,
        message TEXT,
        called_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        called_by_name TEXT,
        called_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_patient_calls_called_at ON patient_calls(called_at);
    `
  },
  {
    id: 5,
    name: 'triage_records',
    sql: `
      CREATE TABLE IF NOT EXISTS triage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        heart_rate INTEGER,
        resp_rate INTEGER,
        spo2 INTEGER,
        temperature_c REAL,
        glucose_mg_dl INTEGER,
        pain_scale INTEGER,
        weight_kg REAL,
        height_cm INTEGER,
        chief_complaint TEXT,
        flowchart_key TEXT,
        discriminators TEXT,
        suggested_color TEXT CHECK (suggested_color IN ('azul','verde','amarelo','laranja','vermelho')),
        final_color TEXT NOT NULL CHECK (final_color IN ('azul','verde','amarelo','laranja','vermelho')),
        override_reason TEXT,
        notes TEXT,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_triage_records_patient ON triage_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_triage_records_created_at ON triage_records(created_at);
    `
  },
  {
    id: 6,
    name: 'pharmacy_and_role_farmacia',
    requiresForeignKeysOff: true,
    sql: `
      -- Recria a tabela users para permitir o papel 'farmacia'.
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin','recepcao','enfermagem','medico','farmacia')),
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new (id, username, password_hash, full_name, role, active, must_change_password, created_at)
        SELECT id, username, password_hash, full_name, role, active, must_change_password, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;

      -- Catálogo de medicamentos (estilo REMUME).
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active_ingredient TEXT,
        dosage TEXT,
        form TEXT,
        route TEXT,
        unit TEXT NOT NULL DEFAULT 'unidade',
        is_remume INTEGER NOT NULL DEFAULT 0,
        anvisa_class TEXT,
        min_stock INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_name_dosage_form
        ON medications(name, COALESCE(dosage,''), COALESCE(form,''));

      -- Lotes físicos em estoque.
      CREATE TABLE IF NOT EXISTS medication_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        lot_number TEXT NOT NULL,
        manufacturer TEXT,
        expires_at TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        entry_quantity INTEGER NOT NULL,
        entry_unit_cost REAL,
        entry_source TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_lots_medication ON medication_lots(medication_id);
      CREATE INDEX IF NOT EXISTS idx_lots_expires ON medication_lots(expires_at);

      -- Movimentações de estoque (auditoria completa).
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        lot_id INTEGER REFERENCES medication_lots(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('entrada','saida','ajuste','perda','dispensacao')),
        quantity INTEGER NOT NULL,
        reason TEXT,
        dispensation_id INTEGER,
        prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_movements_medication ON stock_movements(medication_id);
      CREATE INDEX IF NOT EXISTS idx_movements_created_at ON stock_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_movements_dispensation ON stock_movements(dispensation_id);

      -- Dispensações (cabeçalho).
      CREATE TABLE IF NOT EXISTS dispensations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        dispensed_at TEXT NOT NULL DEFAULT (datetime('now')),
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_dispensations_patient ON dispensations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_dispensations_prescription ON dispensations(prescription_id);
    `
  },
  {
    id: 7,
    name: 'vaccines',
    sql: `
      -- Catálogo de imunobiológicos.
      CREATE TABLE IF NOT EXISTS vaccines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pni_key TEXT UNIQUE,
        name TEXT NOT NULL,
        short_name TEXT,
        manufacturer_default TEXT,
        route TEXT NOT NULL CHECK (route IN ('IM','SC','ID','VO','IN')),
        unit TEXT NOT NULL DEFAULT 'dose',
        min_stock INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vaccines_name ON vaccines(name);

      -- Lotes de imunobiológicos (cadeia de frio é responsabilidade do usuário registrar nas notas).
      CREATE TABLE IF NOT EXISTS vaccine_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vaccine_id INTEGER NOT NULL REFERENCES vaccines(id) ON DELETE CASCADE,
        lot_number TEXT NOT NULL,
        manufacturer TEXT,
        expires_at TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        entry_quantity INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vaccine_lots_vaccine ON vaccine_lots(vaccine_id);
      CREATE INDEX IF NOT EXISTS idx_vaccine_lots_expires ON vaccine_lots(expires_at);

      -- Movimentações de estoque de vacinas.
      CREATE TABLE IF NOT EXISTS vaccine_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vaccine_id INTEGER NOT NULL REFERENCES vaccines(id) ON DELETE CASCADE,
        lot_id INTEGER REFERENCES vaccine_lots(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('entrada','saida','ajuste','perda','aplicacao')),
        quantity INTEGER NOT NULL,
        reason TEXT,
        application_id INTEGER,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vaccine_mov_vaccine ON vaccine_movements(vaccine_id);
      CREATE INDEX IF NOT EXISTS idx_vaccine_mov_application ON vaccine_movements(application_id);

      -- Aplicações (cartão de vacina por paciente).
      CREATE TABLE IF NOT EXISTS vaccine_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        vaccine_id INTEGER NOT NULL REFERENCES vaccines(id) ON DELETE RESTRICT,
        dose_label TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now')),
        lot_id INTEGER REFERENCES vaccine_lots(id) ON DELETE SET NULL,
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        injection_site TEXT,
        notes TEXT,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vaccine_app_patient ON vaccine_applications(patient_id);
      CREATE INDEX IF NOT EXISTS idx_vaccine_app_vaccine ON vaccine_applications(vaccine_id);
    `
  },
  {
    id: 8,
    name: 'professionals_category_cbo_council',
    sql: `
      -- Acrescenta categoria estruturada (Médico, Dentista, Enfermeiro, etc.),
      -- CBO (Classificação Brasileira de Ocupações), UF do conselho e validade
      -- do registro. Mantém council_type/council_number existentes.
      ALTER TABLE professionals ADD COLUMN category TEXT;
      ALTER TABLE professionals ADD COLUMN cbo_code TEXT;
      ALTER TABLE professionals ADD COLUMN cbo_name TEXT;
      ALTER TABLE professionals ADD COLUMN council_uf TEXT;
      ALTER TABLE professionals ADD COLUMN council_expires_at TEXT;
      ALTER TABLE professionals ADD COLUMN email TEXT;
      ALTER TABLE professionals ADD COLUMN phone TEXT;
      CREATE INDEX IF NOT EXISTS idx_professionals_category ON professionals(category);
    `
  },
  {
    id: 9,
    name: 'hospital_core_leitos_internacoes',
    sql: `
      -- Setores / alas hospitalares (ex.: Clínica Médica, Pediatria, UTI Adulto).
      CREATE TABLE IF NOT EXISTS wards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        kind TEXT NOT NULL DEFAULT 'enfermaria'
          CHECK (kind IN ('enfermaria','uti','semiintensiva','obstetrica','pediatria','psiquiatria','isolamento','observacao_ps','outro')),
        floor TEXT,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wards_name ON wards(name);

      -- Quartos dentro de uma ala (opcional — leitos podem estar diretamente na ala).
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_ward ON rooms(ward_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_ward_name ON rooms(ward_id, name);

      -- Leitos físicos. status sempre reflete o estado do leito; current_admission_id
      -- aponta pra internação ativa quando ocupado.
      CREATE TABLE IF NOT EXISTS beds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
        room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
        code TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'standard'
          CHECK (kind IN ('standard','isolamento','uti','semiintensiva','obstetrico','pediatrico','bercario')),
        status TEXT NOT NULL DEFAULT 'livre'
          CHECK (status IN ('livre','ocupado','higienizacao','manutencao','bloqueado','reservado')),
        sex_restriction TEXT CHECK (sex_restriction IN ('M','F')),
        current_admission_id INTEGER,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_id);
      CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
      CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_beds_ward_code ON beds(ward_id, code);

      -- Internações. status:
      --   ativa            → paciente internado
      --   alta             → alta hospitalar (alta médica/melhora/transferência externa)
      --   obito            → óbito hospitalar
      --   transferencia    → transferência externa para outra unidade
      --   evasao           → evasão / saída sem alta
      CREATE TABLE IF NOT EXISTS admissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        attending_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        admitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        admission_type TEXT NOT NULL DEFAULT 'eletiva'
          CHECK (admission_type IN ('eletiva','urgencia','emergencia','transferencia_externa','obstetrica')),
        admission_origin TEXT,
        chief_complaint TEXT,
        admission_diagnosis TEXT,
        admission_cid10 TEXT,
        status TEXT NOT NULL DEFAULT 'ativa'
          CHECK (status IN ('ativa','alta','obito','transferencia','evasao')),
        current_bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,
        discharge_at TEXT,
        discharge_type TEXT
          CHECK (discharge_type IS NULL OR discharge_type IN ('alta_melhora','alta_pedido','alta_administrativa','transferencia_externa','obito','evasao')),
        discharge_summary TEXT,
        discharge_cid10 TEXT,
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
      CREATE INDEX IF NOT EXISTS idx_admissions_admitted_at ON admissions(admitted_at);

      -- Histórico de movimentações de leito (admissão, transferência, alta/óbito).
      -- Permite reconstruir onde o paciente esteve durante a internação.
      CREATE TABLE IF NOT EXISTS bed_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,
        ward_id INTEGER REFERENCES wards(id) ON DELETE SET NULL,
        action TEXT NOT NULL
          CHECK (action IN ('admissao','transferencia','alta','obito','evasao','transferencia_externa')),
        from_bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,
        reason TEXT,
        notes TEXT,
        performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bed_movements_admission ON bed_movements(admission_id);
      CREATE INDEX IF NOT EXISTS idx_bed_movements_bed ON bed_movements(bed_id);
      CREATE INDEX IF NOT EXISTS idx_bed_movements_created_at ON bed_movements(created_at);

      -- Adiciona o tipo de unidade nas configurações (UBS, hospital ou mista).
      -- Como app_settings é um KV genérico, basta documentar a chave aqui.
      -- O default é 'ubs' pra preservar a experiência atual em deploys já em campo.
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('unitType', 'ubs', datetime('now'));
    `
  },
  {
    id: 10,
    name: 'hospital_evolucoes_sinais_vitais',
    sql: `
      -- Evoluções clínicas multiprofissionais durante a internação.
      -- O campo author_role identifica quem registrou (médico, enfermagem,
      -- fisioterapia, nutrição, fono, psicologia, TO, farmácia, outro).
      -- Estrutura SOAP (subjetivo/objetivo/avaliação/plano) é opcional;
      -- evoluções podem usar free_text para texto corrido.
      CREATE TABLE IF NOT EXISTS admission_evolutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        author_role TEXT NOT NULL
          CHECK (author_role IN (
            'medico','enfermagem','fisioterapia','nutricao',
            'fonoaudiologia','psicologia','terapia_ocupacional',
            'farmacia','servico_social','outro'
          )),
        evolution_at TEXT NOT NULL DEFAULT (datetime('now')),
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        free_text TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admission_evolutions_admission
        ON admission_evolutions(admission_id);
      CREATE INDEX IF NOT EXISTS idx_admission_evolutions_evolution_at
        ON admission_evolutions(evolution_at);
      CREATE INDEX IF NOT EXISTS idx_admission_evolutions_author_role
        ON admission_evolutions(author_role);

      -- Sinais vitais. Registro pontual; não está vinculado a evolução
      -- (o paciente pode ter aferição de PA/FC/sat sem nova evolução).
      -- Todos os campos numéricos são opcionais — o operador preenche o
      -- que mediu. measured_at é a hora da aferição (pode ser retroativa).
      CREATE TABLE IF NOT EXISTS admission_vital_signs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        measured_at TEXT NOT NULL DEFAULT (datetime('now')),
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        heart_rate INTEGER,
        respiratory_rate INTEGER,
        temperature_c REAL,
        oxygen_saturation INTEGER,
        pain_score INTEGER CHECK (pain_score IS NULL OR (pain_score BETWEEN 0 AND 10)),
        blood_glucose INTEGER,
        weight_kg REAL,
        height_cm REAL,
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admission_vital_signs_admission
        ON admission_vital_signs(admission_id);
      CREATE INDEX IF NOT EXISTS idx_admission_vital_signs_measured_at
        ON admission_vital_signs(measured_at);
    `
  },
  {
    id: 11,
    name: 'hospital_prescricao_mar',
    sql: `
      -- Prescrição hospitalar: cabeçalho (uma prescrição agrupa N items).
      -- Cada prescrição é assinada por um médico/profissional e ancorada
      -- a uma internação. Status controla o ciclo (ativa → suspensa/cancelada
      -- ou finalizada quando todos os items terminam o tratamento).
      CREATE TABLE IF NOT EXISTS admission_prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        prescribed_by_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        prescribed_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'ativa'
          CHECK (status IN ('ativa','suspensa','cancelada','finalizada')),
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admission_prescriptions_admission
        ON admission_prescriptions(admission_id);
      CREATE INDEX IF NOT EXISTS idx_admission_prescriptions_status
        ON admission_prescriptions(status);

      -- Item da prescrição: o medicamento + posologia. Pode referenciar
      -- a tabela 'medications' (catálogo da farmácia) OU usar texto livre
      -- quando o item não está cadastrado (ex.: medicamento de uso externo).
      -- interval_hours opcional habilita o aprazamento automático do MAR.
      -- if_necessary (SOS/PRN) sinaliza items que NÃO geram horários fixos
      -- — a enfermagem checa só quando administra de fato.
      CREATE TABLE IF NOT EXISTS admission_prescription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL
          REFERENCES admission_prescriptions(id) ON DELETE CASCADE,
        medication_id INTEGER REFERENCES medications(id) ON DELETE SET NULL,
        medication_name TEXT NOT NULL,
        dose TEXT NOT NULL,
        route TEXT NOT NULL
          CHECK (route IN (
            'oral','iv','im','sc','sl','inalatorio','topico',
            'retal','vaginal','ocular','otologico','enteral','outro'
          )),
        frequency_label TEXT NOT NULL,
        interval_hours REAL,
        duration_days REAL,
        if_necessary INTEGER NOT NULL DEFAULT 0
          CHECK (if_necessary IN (0,1)),
        start_at TEXT NOT NULL DEFAULT (datetime('now')),
        end_at TEXT,
        status TEXT NOT NULL DEFAULT 'ativa'
          CHECK (status IN ('ativa','suspensa','cancelada','finalizada')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_admission_prescription_items_prescription
        ON admission_prescription_items(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_admission_prescription_items_medication
        ON admission_prescription_items(medication_id);

      -- MAR (Medication Administration Record): cada linha é uma DOSE
      -- aprazada para um horário específico. Quando criado, status =
      -- 'aprazado'; a enfermagem registra 'administrado' (com hora real),
      -- 'recusado' (paciente recusou), 'omitido' (perdeu a janela) ou
      -- 'suspenso' (médico suspendeu antes da hora).
      CREATE TABLE IF NOT EXISTS admission_medication_administrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_item_id INTEGER NOT NULL
          REFERENCES admission_prescription_items(id) ON DELETE CASCADE,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aprazado'
          CHECK (status IN ('aprazado','administrado','recusado','omitido','suspenso')),
        administered_at TEXT,
        dose_given TEXT,
        administered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        administered_by_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mar_item
        ON admission_medication_administrations(prescription_item_id);
      CREATE INDEX IF NOT EXISTS idx_mar_scheduled
        ON admission_medication_administrations(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_mar_status
        ON admission_medication_administrations(status);
    `
  }
  ,
  {
    id: 12,
    name: 'balanco_hidrico',
    sql: `
      -- Balanço hídrico: cada linha é um lançamento de entrada ou saída de
      -- líquidos durante a internação. O saldo diário é calculado em memória
      -- (SUM de entradas − SUM de saídas por dia) para evitar desnormalização.
      -- Registro de prontuário: não pode ser editado, apenas excluído pelo
      -- próprio autor ou admin enquanto a internação estiver ativa.
      CREATE TABLE IF NOT EXISTS admission_fluid_balance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
        subtype TEXT NOT NULL,
        volume_ml INTEGER NOT NULL CHECK (volume_ml > 0),
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fluid_balance_admission
        ON admission_fluid_balance(admission_id);
      CREATE INDEX IF NOT EXISTS idx_fluid_balance_recorded_at
        ON admission_fluid_balance(recorded_at);
    `
  },
  {
    id: 13,
    name: 'er_surgery_iras',
    sql: `
      -- ╔══════════════════════════════════════════════════════════════╗
      -- ║  PRONTO-SOCORRO (PS) — Acolhimento + Classificação de Risco ║
      -- ╚══════════════════════════════════════════════════════════════╝
      --
      -- Atendimento de PS é separado de internação porque a maioria dos
      -- atendimentos resolve no próprio PS (alta direta). Apenas quando
      -- o paciente é admitido (cria-se uma admission) os módulos de leito
      -- entram em jogo.
      --
      -- Fluxo: chegada (er_visits) → triagem (er_triages, Manchester 5 cores)
      --      → atendimento médico → desfecho (alta / internação /
      --        transferência / óbito / evasão).
      CREATE TABLE IF NOT EXISTS er_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        arrived_at TEXT NOT NULL DEFAULT (datetime('now')),
        arrival_mode TEXT
          CHECK (arrival_mode IS NULL OR arrival_mode IN ('proprio','samu','bombeiros','policia','transferencia','outro')),
        chief_complaint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aguardando_triagem'
          CHECK (status IN ('aguardando_triagem','triado','em_atendimento','aguardando_internacao',
                            'alta','internado','transferido','evasao','obito')),
        attending_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        notes TEXT,
        closed_at TEXT,
        outcome_summary TEXT,
        admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_er_visits_patient ON er_visits(patient_id);
      CREATE INDEX IF NOT EXISTS idx_er_visits_status ON er_visits(status);
      CREATE INDEX IF NOT EXISTS idx_er_visits_arrived ON er_visits(arrived_at);

      -- Classificação de risco do tipo Manchester. Cores:
      --   vermelho   → emergência (atendimento imediato, 0 min)
      --   laranja    → muito urgente (até 10 min)
      --   amarelo    → urgente (até 60 min)
      --   verde      → pouco urgente (até 120 min)
      --   azul       → não urgente (até 240 min)
      CREATE TABLE IF NOT EXISTS er_triages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER NOT NULL REFERENCES er_visits(id) ON DELETE CASCADE,
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        triaged_at TEXT NOT NULL DEFAULT (datetime('now')),
        color TEXT NOT NULL
          CHECK (color IN ('vermelho','laranja','amarelo','verde','azul')),
        target_wait_minutes INTEGER NOT NULL,
        discriminator TEXT,
        systolic_bp INTEGER, diastolic_bp INTEGER,
        heart_rate INTEGER, respiratory_rate INTEGER,
        temperature_c REAL, oxygen_saturation INTEGER,
        pain_score INTEGER CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10)),
        glasgow INTEGER CHECK (glasgow IS NULL OR (glasgow >= 3 AND glasgow <= 15)),
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_er_triages_visit ON er_triages(visit_id);
      CREATE INDEX IF NOT EXISTS idx_er_triages_color ON er_triages(color);

      -- ╔══════════════════════════════════════════════════════════════╗
      -- ║  CENTRO CIRÚRGICO — Salas, agenda, time-out, OPME           ║
      -- ╚══════════════════════════════════════════════════════════════╝
      CREATE TABLE IF NOT EXISTS surgical_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        floor TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_surgical_rooms_name ON surgical_rooms(name);

      -- Cirurgia: pode estar vinculada (ou não) a uma internação.
      CREATE TABLE IF NOT EXISTS surgeries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        room_id INTEGER REFERENCES surgical_rooms(id) ON DELETE SET NULL,
        admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
        surgeon_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        anesthetist_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        scheduled_start TEXT NOT NULL,
        scheduled_end TEXT NOT NULL,
        actual_start TEXT,
        actual_end TEXT,
        procedure_name TEXT NOT NULL,
        procedure_cid10 TEXT,
        anesthesia_type TEXT
          CHECK (anesthesia_type IS NULL OR anesthesia_type IN ('geral','raquianestesia','peridural','local','sedacao','bloqueio','outro')),
        priority TEXT NOT NULL DEFAULT 'eletiva'
          CHECK (priority IN ('eletiva','urgencia','emergencia')),
        status TEXT NOT NULL DEFAULT 'agendada'
          CHECK (status IN ('agendada','aguardando','em_curso','concluida','cancelada','suspensa')),
        time_out_completed INTEGER NOT NULL DEFAULT 0,
        time_out_at TEXT,
        time_out_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        cancel_reason TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_surgeries_patient ON surgeries(patient_id);
      CREATE INDEX IF NOT EXISTS idx_surgeries_room ON surgeries(room_id);
      CREATE INDEX IF NOT EXISTS idx_surgeries_status ON surgeries(status);
      CREATE INDEX IF NOT EXISTS idx_surgeries_scheduled ON surgeries(scheduled_start);

      -- Time-out (checklist de segurança cirúrgica — WHO Surgical Safety).
      -- Cada item é um booleano marcado pela equipe antes da incisão.
      CREATE TABLE IF NOT EXISTS surgery_timeout_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        surgery_id INTEGER NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
        item TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        checked_at TEXT,
        checked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_timeout_surgery ON surgery_timeout_items(surgery_id);

      -- OPME (Órteses, Próteses e Materiais Especiais) usado por cirurgia,
      -- com rastreabilidade do lote / serial e fornecedor.
      CREATE TABLE IF NOT EXISTS surgery_opme (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        surgery_id INTEGER NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        manufacturer TEXT,
        lot_number TEXT,
        serial_number TEXT,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit TEXT,
        notes TEXT,
        registered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        registered_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_opme_surgery ON surgery_opme(surgery_id);

      -- ╔══════════════════════════════════════════════════════════════╗
      -- ║  CCIH — Controle de Infecção Hospitalar                     ║
      -- ╚══════════════════════════════════════════════════════════════╝
      -- IRAS = Infecção Relacionada à Assistência à Saúde.
      -- Casos podem ou não estar vinculados a uma internação (ex.: infecção
      -- detectada após alta também conta para a notificação CCIH).
      CREATE TABLE IF NOT EXISTS iras_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
        notification_date TEXT NOT NULL DEFAULT (datetime('now')),
        infection_site TEXT NOT NULL
          CHECK (infection_site IN ('corrente_sanguinea','itu','pneumonia','sitio_cirurgico',
                                    'cateter_central','pele_tecidos_moles','outro')),
        microorganism TEXT,
        resistant_profile TEXT,
        is_device_associated INTEGER NOT NULL DEFAULT 0,
        device_type TEXT
          CHECK (device_type IS NULL OR device_type IN ('cvc','sva','vm','outro')),
        culture_collected INTEGER NOT NULL DEFAULT 0,
        culture_collected_at TEXT,
        culture_result TEXT,
        notes TEXT,
        notified_by_professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_iras_patient ON iras_cases(patient_id);
      CREATE INDEX IF NOT EXISTS idx_iras_admission ON iras_cases(admission_id);
      CREATE INDEX IF NOT EXISTS idx_iras_site ON iras_cases(infection_site);
      CREATE INDEX IF NOT EXISTS idx_iras_date ON iras_cases(notification_date);

      -- Isolamentos. Um paciente pode ter mais de um (ex.: contato + gotículas).
      -- ended_at NULL = isolamento ativo.
      CREATE TABLE IF NOT EXISTS isolations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL
          CHECK (kind IN ('contato','goticulas','aerossois','protetor','outro')),
        reason TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        ended_reason TEXT,
        started_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ended_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_isolations_admission ON isolations(admission_id);
      CREATE INDEX IF NOT EXISTS idx_isolations_kind ON isolations(kind);
      CREATE INDEX IF NOT EXISTS idx_isolations_active
        ON isolations(admission_id) WHERE ended_at IS NULL;
    `
  },
  {
    id: 14,
    name: 'bpa_timeclock',
    sql: `
      -- ╔══════════════════════════════════════════════════════════════╗
      -- ║  BPA / Produção SUS                                          ║
      -- ╚══════════════════════════════════════════════════════════════╝
      -- BPA = Boletim de Produção Ambulatorial. Cada linha é um
      -- procedimento realizado (consulta, exame, vacinação, dispensação)
      -- com código SIGTAP. As linhas são consolidadas mensalmente para
      -- envio ao DATASUS (geração de arquivo BPA-C/BPA-I no futuro).
      CREATE TABLE IF NOT EXISTS bpa_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
        procedure_code TEXT NOT NULL,
        procedure_name TEXT NOT NULL,
        procedure_date TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        cid10 TEXT,
        cbo_code TEXT,
        notes TEXT,
        source_module TEXT,
        source_id INTEGER,
        consolidation_id INTEGER,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bpa_records_date ON bpa_records(procedure_date);
      CREATE INDEX IF NOT EXISTS idx_bpa_records_procedure ON bpa_records(procedure_code);
      CREATE INDEX IF NOT EXISTS idx_bpa_records_consolidation ON bpa_records(consolidation_id);

      -- Consolidações mensais (uma por competência: ano + mês).
      CREATE TABLE IF NOT EXISTS bpa_consolidations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        total_records INTEGER NOT NULL DEFAULT 0,
        total_procedures INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aberto'
          CHECK (status IN ('aberto','fechado','exportado')),
        generated_at TEXT,
        file_path TEXT,
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bpa_consolidations_period
        ON bpa_consolidations(year, month);

      -- ╔══════════════════════════════════════════════════════════════╗
      -- ║  PONTO ELETRÔNICO                                            ║
      -- ╚══════════════════════════════════════════════════════════════╝
      -- Registro de entrada/saída do profissional. Cada batida é uma
      -- linha; o saldo da jornada é calculado em consulta. Modelo simples:
      -- não enforça pares de entrada/saída automaticamente (auditoria
      -- humana faz isso). Notas são livres para justificar atrasos.
      CREATE TABLE IF NOT EXISTS timeclock_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('entrada','saida','intervalo_inicio','intervalo_fim')),
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_timeclock_professional
        ON timeclock_entries(professional_id);
      CREATE INDEX IF NOT EXISTS idx_timeclock_recorded
        ON timeclock_entries(recorded_at);
    `
  },
  {
    id: 15,
    name: 'rename_branding_ubs_to_hospital',
    sql: `
      -- Renomeia a chave brandingLogoUbsFile → brandingLogoHospitalFile.
      -- Em deploys antigos (gestao-ubs) a chave era brandingLogoUbsFile;
      -- como o produto agora é Gestão Hospitalar, o slot foi renomeado
      -- para 'hospital'. Copiamos o valor e removemos a chave antiga.
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        SELECT 'brandingLogoHospitalFile', value, datetime('now')
          FROM app_settings WHERE key = 'brandingLogoUbsFile';
      DELETE FROM app_settings WHERE key = 'brandingLogoUbsFile';
    `
  },
  {
    id: 16,
    name: 'lan_server_drive',
    sql: `
      -- Tokens de sessão para autenticação cliente↔servidor via HTTP LAN.
      -- O servidor emite no /api/auth/login e o cliente envia em Bearer.
      CREATE TABLE IF NOT EXISTS api_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_api_sessions_user ON api_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_sessions_expires ON api_sessions(expires_at);

      -- Chaves de configuração novas em app_settings (KV existente).
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('runMode', 'standalone', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('serverPort', '7321', datetime('now'));
    `
  },
  {
    id: 17,
    name: 'drive_backup',
    sql: `
      -- Backup Google Drive: as credenciais OAuth (Client ID/Secret) e o
      -- refresh token são gravados em app_settings (KV). Inicializa vazios.
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveClientId', '', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveClientSecret', '', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveRefreshToken', '', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveFolderId', '', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveLastBackupAt', '', datetime('now'));
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
        VALUES ('driveAutoEnabled', '0', datetime('now'));
    `
  }
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    db
      .prepare<[], { id: number }>('SELECT id FROM _migrations')
      .all()
      .map((row) => row.id)
  )

  const insertMigration = db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue
    const runMigration = db.transaction(() => {
      db.exec(migration.sql)
      insertMigration.run(migration.id, migration.name)
    })
    if (migration.requiresForeignKeysOff) {
      // Desabilita FK enforcement fora da transação; SQLite ignora se
      // chamado dentro. Isso evita que DROP TABLE cascateie em tabelas
      // filhas com ON DELETE SET NULL.
      db.pragma('foreign_keys = OFF')
      try {
        runMigration()
        // Sanity check: nenhuma FK pode estar inválida após o rebuild.
        const violations = db.pragma('foreign_key_check') as unknown[]
        if (violations.length > 0) {
          throw new Error(
            `Migration ${migration.id} (${migration.name}) deixou ${violations.length} viola\u00e7\u00f5es de FK`
          )
        }
      } finally {
        db.pragma('foreign_keys = ON')
      }
    } else {
      runMigration()
    }
  }
}
