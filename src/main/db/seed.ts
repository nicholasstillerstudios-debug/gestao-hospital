import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

/**
 * Insere um usuário administrador padrão na primeira execução.
 * Usuário: admin / Senha: admin123 (marcado como `must_change_password = 1`).
 */
export function seedInitialAdmin(db: Database.Database): void {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (row.count > 0) return

  const passwordHash = bcrypt.hashSync('admin123', 10)
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role, active, must_change_password)
     VALUES (?, ?, ?, ?, 1, 1)`
  ).run('admin', passwordHash, 'Administrador do Sistema', 'admin')
}

export function seedSampleProfessionals(db: Database.Database): void {
  const row = db.prepare('SELECT COUNT(*) as count FROM professionals').get() as { count: number }
  if (row.count > 0) return

  const insert = db.prepare(
    `INSERT INTO professionals (
       full_name, category, cbo_code, cbo_name,
       council_type, council_number, council_uf, specialty, active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  )
  insert.run(
    'Dra. Ana Souza',
    'medico',
    '2251-25',
    'Médico clínico (atenção básica)',
    'CRM',
    '123456',
    'SP',
    'Clínica Geral'
  )
  insert.run(
    'Dr. Bruno Costa',
    'medico',
    '2231-38',
    'Médico pediatra',
    'CRM',
    '654321',
    'SP',
    'Pediatria'
  )
  insert.run(
    'Enf. Carla Lima',
    'enfermeiro',
    '2235-05',
    'Enfermeiro',
    'COREN',
    '222333',
    'SP',
    'Saúde da Família'
  )
  insert.run(
    'Dr. Daniel Reis',
    'dentista',
    '2232-08',
    'Cirurgião-dentista — clínico geral',
    'CRO',
    '88001',
    'SP',
    'Odontologia clínica'
  )
}
