/**
 * Tipos compartilhados entre o processo main (Electron) e o renderer (React).
 * Nenhuma dependência nativa pode ser importada neste arquivo.
 */

export type UserRole = 'admin' | 'recepcao' | 'enfermagem' | 'medico' | 'farmacia'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador(a)',
  recepcao: 'Recepção',
  enfermagem: 'Enfermagem',
  medico: 'Médico(a)',
  farmacia: 'Farmácia'
}

/**
 * Resumo do que cada papel acessa. Exibido como ajuda na tela de criação
 * de usuário. A regra real vive nos handlers IPC (`requireRole`) e no
 * Layout sidebar — esta string é só guia visual para quem está cadastrando.
 */
export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    'Acesso total: pacientes, internações, prescrições, farmácia, CCIH, centro cirúrgico, BPA, usuários, configurações, auditoria e backup.',
  recepcao:
    'Atende a recepção: cadastra pacientes, agenda consultas, faz check-in e abre atendimentos no PS. Não acessa prescrição, farmácia ou administração.',
  enfermagem:
    'Equipe de enfermagem: triagem, sinais vitais, evoluções, checagem de medicação (MAR), balanço hídrico, isolamentos e admissão de pacientes em leito.',
  medico:
    'Médico(a): prescreve, evolui, autoriza alta, cria cirurgias, registra IRAS e libera atendimentos. Acessa relatórios e BPA.',
  farmacia:
    'Farmácia hospitalar: cadastra medicamentos, gerencia lotes, lança entradas/saídas de estoque e dispensa para o paciente.'
}

export interface User {
  id: number
  username: string
  fullName: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface AuthUser extends User {
  mustChangePassword: boolean
}

export interface Professional {
  id: number
  fullName: string
  cpf: string | null
  cns: string | null
  category: string | null
  cboCode: string | null
  cboName: string | null
  councilType: string | null
  councilNumber: string | null
  councilUf: string | null
  councilExpiresAt: string | null
  specialty: string | null
  email: string | null
  phone: string | null
  active: boolean
  createdAt: string
}

export type Sex = 'M' | 'F' | 'O'

export const SEX_LABELS: Record<Sex, string> = {
  M: 'Masculino',
  F: 'Feminino',
  O: 'Outro'
}

export interface Patient {
  id: number
  fullName: string
  cpf: string | null
  cns: string | null
  birthDate: string // ISO date (yyyy-MM-dd)
  sex: Sex
  phone: string | null
  email: string | null
  motherName: string | null
  race: string | null
  addressStreet: string | null
  addressNumber: string | null
  addressComplement: string | null
  addressNeighborhood: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  notes: string | null
  anonymizedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PatientInput = Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'anonymizedAt'>

// ════════════════════════════════════════════════════════════════════
//   AGENDA / CONSULTAS (UBS)
// ════════════════════════════════════════════════════════════════════

export type AppointmentStatus =
  | 'agendado'
  | 'aguardando'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'faltou'

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendado: 'Agendado',
  aguardando: 'Aguardando',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou'
}

export interface Appointment {
  id: number
  patientId: number
  professionalId: number
  scheduledAt: string
  durationMin: number
  status: AppointmentStatus
  reason: string | null
  triageColor: TriageColor | null
  triageNotes: string | null
  notes: string | null
  checkedInAt: string | null
  startedAt: string | null
  endedAt: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface AppointmentWithRefs extends Appointment {
  patient: Pick<Patient, 'id' | 'fullName' | 'cpf' | 'cns' | 'birthDate' | 'sex'>
  professional: Pick<Professional, 'id' | 'fullName' | 'specialty'>
}

export interface Attendance {
  id: number
  appointmentId: number
  patientId: number
  professionalId: number
  startedAt: string
  endedAt: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  prescription: string | null
  createdByUserId: number | null
  createdAt: string
}

// ════════════════════════════════════════════════════════════════════
//   Prescrições e Requisições (ambulatorial)
// ════════════════════════════════════════════════════════════════════

export interface PrescriptionItem {
  medication: string
  dose: string | null
  via: string | null
  posology: string | null
  duration: string | null
  quantity: string | null
  notes: string | null
}

export interface Prescription {
  id: number
  patientId: number
  attendanceId: number | null
  professionalId: number
  issuedAt: string
  notes: string | null
  items: PrescriptionItem[]
  createdByUserId: number | null
  createdAt: string
}

export interface PrescriptionWithRefs extends Prescription {
  patient: Pick<Patient, 'id' | 'fullName' | 'cpf' | 'cns' | 'birthDate' | 'sex'>
  professional: Pick<
    Professional,
    'id' | 'fullName' | 'specialty' | 'councilType' | 'councilNumber' | 'councilUf'
  >
}

export interface PrescriptionInput {
  patientId: number
  attendanceId: number | null
  professionalId: number
  notes: string | null
  items: PrescriptionItem[]
}

export type RequisitionType = 'laboratorio' | 'imagem' | 'procedimento' | 'encaminhamento'

export const REQUISITION_TYPE_LABELS: Record<RequisitionType, string> = {
  laboratorio: 'Exames laboratoriais',
  imagem: 'Exames de imagem',
  procedimento: 'Procedimento / SADT',
  encaminhamento: 'Encaminhamento'
}

export type RequisitionStatus = 'solicitada' | 'realizada' | 'cancelada'

export interface Requisition {
  id: number
  patientId: number
  attendanceId: number | null
  professionalId: number
  type: RequisitionType
  items: string[]
  observations: string | null
  status: RequisitionStatus
  issuedAt: string
  createdByUserId: number | null
  createdAt: string
}

export interface RequisitionWithRefs extends Requisition {
  patient: Pick<Patient, 'id' | 'fullName' | 'cpf' | 'cns' | 'birthDate' | 'sex'>
  professional: Pick<
    Professional,
    'id' | 'fullName' | 'specialty' | 'councilType' | 'councilNumber' | 'councilUf'
  >
}

export interface RequisitionInput {
  patientId: number
  attendanceId: number | null
  professionalId: number
  type: RequisitionType
  items: string[]
  observations: string | null
}

// ════════════════════════════════════════════════════════════════════
//   Chamadas de paciente e Triagem (Manchester)
// ════════════════════════════════════════════════════════════════════

export interface PatientCall {
  id: number
  patientId: number | null
  appointmentId: number | null
  patientName: string
  room: string
  message: string | null
  calledByUserId: number | null
  calledByName: string | null
  calledAt: string
}

export interface PatientCallInput {
  patientId: number | null
  appointmentId: number | null
  patientName: string
  room: string
  message?: string | null
}

export interface TriageRecord {
  id: number
  appointmentId: number
  patientId: number
  systolicBp: number | null
  diastolicBp: number | null
  heartRate: number | null
  respRate: number | null
  spo2: number | null
  temperatureC: number | null
  glucoseMgDl: number | null
  painScale: number | null
  weightKg: number | null
  heightCm: number | null
  chiefComplaint: string | null
  flowchartKey: string | null
  discriminators: string[]
  suggestedColor: TriageColor | null
  finalColor: TriageColor
  overrideReason: string | null
  notes: string | null
  performedByUserId: number | null
  performedByName: string | null
  createdAt: string
}

export interface TriageRecordInput {
  appointmentId: number
  systolicBp?: number | null
  diastolicBp?: number | null
  heartRate?: number | null
  respRate?: number | null
  spo2?: number | null
  temperatureC?: number | null
  glucoseMgDl?: number | null
  painScale?: number | null
  weightKg?: number | null
  heightCm?: number | null
  chiefComplaint?: string | null
  flowchartKey?: string | null
  discriminators?: string[]
  suggestedColor?: TriageColor | null
  finalColor: TriageColor
  overrideReason?: string | null
  notes?: string | null
}

// ════════════════════════════════════════════════════════════════════
//   BPA / Produção SUS
// ════════════════════════════════════════════════════════════════════

export type BpaConsolidationStatus = 'aberto' | 'fechado' | 'exportado'

export interface BpaRecord {
  id: number
  patientId: number | null
  professionalId: number | null
  procedureCode: string
  procedureName: string
  procedureDate: string
  quantity: number
  cid10: string | null
  cboCode: string | null
  notes: string | null
  sourceModule: string | null
  sourceId: number | null
  consolidationId: number | null
  createdByUserId: number | null
  createdAt: string
}

export interface BpaRecordWithRefs extends BpaRecord {
  patientName: string | null
  patientCns: string | null
  patientCpf: string | null
  patientSex: Sex | null
  patientBirthDate: string | null
  patientMunicipality: string | null
  professionalName: string | null
  professionalCns: string | null
  professionalCboCode: string | null
}

export interface BpaRecordInput {
  patientId?: number | null
  professionalId?: number | null
  procedureCode: string
  procedureName: string
  procedureDate: string
  quantity: number
  cid10?: string | null
  cboCode?: string | null
  notes?: string | null
  sourceModule?: string | null
  sourceId?: number | null
}

export interface BpaConsolidation {
  id: number
  year: number
  month: number
  totalRecords: number
  totalProcedures: number
  status: BpaConsolidationStatus
  generatedAt: string | null
  filePath: string | null
  notes: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

// ════════════════════════════════════════════════════════════════════
//   Ponto Eletrônico
// ════════════════════════════════════════════════════════════════════

export type TimeclockEntryType = 'entrada' | 'saida' | 'intervalo_inicio' | 'intervalo_fim'

export const TIMECLOCK_ENTRY_TYPE_LABELS: Record<TimeclockEntryType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  intervalo_inicio: 'Início de intervalo',
  intervalo_fim: 'Fim de intervalo'
}

export interface TimeclockEntry {
  id: number
  professionalId: number
  type: TimeclockEntryType
  recordedAt: string
  notes: string | null
  createdByUserId: number | null
  createdAt: string
}

export interface TimeclockEntryWithRefs extends TimeclockEntry {
  professionalName: string
}

export interface TimeclockEntryInput {
  professionalId: number
  type: TimeclockEntryType
  recordedAt?: string
  notes?: string | null
}

export interface TimeclockDaySummary {
  date: string
  entries: TimeclockEntry[]
  workedMinutes: number
  breakMinutes: number
  consistent: boolean
}

export interface AuditLogEntry {
  id: number
  userId: number | null
  username: string | null
  action: string
  entity: string
  entityId: string | null
  details: string | null
  createdAt: string
}

export interface DashboardStats {
  patientsCount: number
  professionalsActive: number
  activeAdmissions: number
  freeBeds: number
  totalBeds: number
}

export interface ProductionReportRow {
  professionalId: number
  professionalName: string
  specialty: string | null
  totalAdmissions: number
  totalDischarges: number
}

export interface BackupInfo {
  path: string
  sizeBytes: number
  createdAt: string
}

/**
 * Tipo da unidade de saúde gerida por este deploy. Controla quais módulos
 * aparecem no menu lateral. `'ubs'` é o default histórico (UBS pura);
 * `'hospital'` habilita o módulo hospitalar (leitos/internações) e oculta
 * o que é exclusivo de atenção primária; `'mista'` mostra ambos.
 */
export type UnitType = 'ubs' | 'hospital' | 'mista'

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  hospital: 'Hospital (internação + ambulatório)',
  mista: 'Hospital + UBS (rede municipal mista)',
  ubs: 'UBS / Atenção primária apenas'
}

/** Ordem de exibição em selects (hospital primeiro — produto é hospitalar). */
export const UNIT_TYPE_ORDER: UnitType[] = ['hospital', 'mista', 'ubs']

export interface AppSettings {
  /** 0 = retenção indefinida; >0 = manter logs de auditoria por X dias. */
  auditRetentionDays: number
  /** Tipo da unidade gerida (UBS, hospital ou mista). */
  unitType: UnitType
  /** Dados da unidade exibidos nos cabeçalhos de impressão. */
  unitName: string
  unitCnes: string
  unitAddress: string
  unitPhone: string
  unitMunicipality: string
  /** Branding (papel timbrado): nome do arquivo dentro de userData/branding/ */
  brandingLogoPrefeituraFile: string
  brandingLogoSecretariaFile: string
  brandingLogoHospitalFile: string
  /** Texto institucional opcional, ex.: "PREFEITURA MUNICIPAL DE X" */
  brandingPrefeituraName: string
  brandingSecretariaName: string
  /** Apar\u00eancia do app: cor prim\u00e1ria (hex) e modo claro/escuro. */
  themePrimary: string
  themeMode: ThemeMode
  /** Modo de execução do app:
   *   - standalone: SQLite local, sem rede (default)
   *   - server: expõe API HTTP na LAN para clientes se conectarem
   *   - client: consome API de um servidor remoto (não usa banco local) */
  runMode: RunMode
  /** Porta TCP em que o servidor escuta (apenas runMode=server). */
  serverPort: number
  /** Backup Google Drive — credenciais OAuth Web App do tipo "Desktop". */
  driveClientId: string
  driveClientSecret: string
  /** Refresh token obtido após conectar; "" = não conectado. */
  driveRefreshToken: string
  /** ID da pasta no Drive onde os backups são gravados. */
  driveFolderId: string
  /** ISO-8601 do último upload bem-sucedido. */
  driveLastBackupAt: string
  /** Backup diário automático ligado. */
  driveAutoEnabled: boolean
  /** Altura dos logos no cabeçalho impresso, em px (24–120). */
  letterheadLogoHeight: number
  /** Alinhamento horizontal do conteúdo do timbrado. */
  letterheadAlign: 'left' | 'center'
  /** Exibir a linha CNES/endereço/telefone abaixo dos títulos. */
  letterheadShowFooter: boolean
  /** CNPJ do estabelecimento (14 dígitos) — usado no header do BPA-MAG. */
  unitCnpj: string
  /** Código IBGE do município do estabelecimento (6 dígitos). */
  unitIbge: string
  /** Sigla / nome curto do órgão emissor (até 30). Default = unitName. */
  unitOrgaoEmissor: string
  /** Destino do BPA: "M" (municipal) ou "E" (estadual). */
  unitOrgaoDestino: 'M' | 'E'
}

export type RunMode = 'standalone' | 'server' | 'client'

export const RUN_MODE_LABELS: Record<RunMode, string> = {
  standalone: 'Standalone (SQLite local)',
  server: 'Servidor (compartilha na LAN)',
  client: 'Cliente (conecta em servidor)'
}

export type ThemeMode = 'light' | 'dark'

export type BrandingLogoSlot = 'prefeitura' | 'secretaria' | 'hospital'

export interface BrandingLogos {
  prefeitura: string | null
  secretaria: string | null
  hospital: string | null
}

export interface PatientDataExport {
  exportedAt: string
  source: { app: string; version: string }
  patient: Patient
  auditLog: AuditLogEntry[]
}

export interface AnonymizeResult {
  patientId: number
  anonymizedAt: string
  appointmentsCancelled: number
}

/* ---------- Farmácia ---------- */

export interface Medication {
  id: number
  name: string
  activeIngredient: string | null
  dosage: string | null
  form: string | null
  route: string | null
  unit: string
  isRemume: boolean
  anvisaClass: string | null
  minStock: number
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface MedicationInput {
  name: string
  activeIngredient?: string | null
  dosage?: string | null
  form?: string | null
  route?: string | null
  unit?: string
  isRemume?: boolean
  anvisaClass?: string | null
  minStock?: number
  notes?: string | null
  active?: boolean
}

export interface MedicationStock extends Medication {
  /** Soma das quantidades de todos os lotes ativos. */
  totalQuantity: number
  /** Lote com vencimento mais próximo (para FEFO). */
  nextExpiry: string | null
  /** true se totalQuantity <= minStock. */
  belowMin: boolean
  /** true se nextExpiry está em ≤ 90 dias. */
  expiringSoon: boolean
}

export interface MedicationLot {
  id: number
  medicationId: number
  lotNumber: string
  manufacturer: string | null
  expiresAt: string
  quantity: number
  entryQuantity: number
  entryUnitCost: number | null
  entrySource: string | null
  notes: string | null
  createdAt: string
}

export interface MedicationLotInput {
  medicationId: number
  lotNumber: string
  manufacturer?: string | null
  expiresAt: string
  entryQuantity: number
  entryUnitCost?: number | null
  entrySource?: string | null
  notes?: string | null
}

export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'perda' | 'dispensacao'

export interface StockMovement {
  id: number
  medicationId: number
  medicationName: string
  lotId: number | null
  lotNumber: string | null
  type: StockMovementType
  quantity: number
  reason: string | null
  dispensationId: number | null
  prescriptionId: number | null
  patientId: number | null
  patientName: string | null
  performedByUserId: number | null
  performedByName: string | null
  createdAt: string
}

export interface StockMovementInput {
  medicationId: number
  lotId?: number | null
  type: 'entrada' | 'saida' | 'ajuste' | 'perda'
  quantity: number
  reason?: string | null
}

export interface DispensationItemInput {
  medicationId: number
  /** Quantidade total a dispensar; será distribuída entre lotes via FEFO. */
  quantity: number
  /** Lote específico (opcional); se omitido, usa FEFO. */
  lotId?: number | null
}

export interface DispensationInput {
  patientId: number
  prescriptionId?: number | null
  notes?: string | null
  items: DispensationItemInput[]
}

export interface Dispensation {
  id: number
  prescriptionId: number | null
  patientId: number
  patientName: string
  dispensedAt: string
  performedByUserId: number | null
  performedByName: string | null
  notes: string | null
  createdAt: string
  items: Array<{
    medicationId: number
    medicationName: string
    lotId: number | null
    lotNumber: string | null
    quantity: number
  }>
}

export interface DemoSeedHospitalResult {
  skipped: boolean
  wardsCreated: number
  bedsCreated: number
  admissionsCreated: number
}

/* ---------- Hospitalar: Setores, Leitos e Internações ---------- */

export type WardKind =
  | 'enfermaria'
  | 'uti'
  | 'semiintensiva'
  | 'obstetrica'
  | 'pediatria'
  | 'psiquiatria'
  | 'isolamento'
  | 'observacao_ps'
  | 'outro'

export const WARD_KIND_LABELS: Record<WardKind, string> = {
  enfermaria: 'Enfermaria',
  uti: 'UTI',
  semiintensiva: 'Semi-intensiva',
  obstetrica: 'Obstétrica',
  pediatria: 'Pediatria',
  psiquiatria: 'Psiquiatria',
  isolamento: 'Isolamento',
  observacao_ps: 'Observação PS',
  outro: 'Outro'
}

export interface Ward {
  id: number
  name: string
  code: string | null
  kind: WardKind
  floor: string | null
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface WardInput {
  name: string
  code?: string | null
  kind?: WardKind
  floor?: string | null
  notes?: string | null
  active?: boolean
}

export interface Room {
  id: number
  wardId: number
  name: string
  notes: string | null
  createdAt: string
}

export interface RoomInput {
  wardId: number
  name: string
  notes?: string | null
}

export type BedKind =
  | 'standard'
  | 'isolamento'
  | 'uti'
  | 'semiintensiva'
  | 'obstetrico'
  | 'pediatrico'
  | 'bercario'

export const BED_KIND_LABELS: Record<BedKind, string> = {
  standard: 'Padrão',
  isolamento: 'Isolamento',
  uti: 'UTI',
  semiintensiva: 'Semi-intensiva',
  obstetrico: 'Obstétrico',
  pediatrico: 'Pediátrico',
  bercario: 'Berçário'
}

export type BedStatus =
  | 'livre'
  | 'ocupado'
  | 'higienizacao'
  | 'manutencao'
  | 'bloqueado'
  | 'reservado'

export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  livre: 'Livre',
  ocupado: 'Ocupado',
  higienizacao: 'Higienização',
  manutencao: 'Manutenção',
  bloqueado: 'Bloqueado',
  reservado: 'Reservado'
}

export interface Bed {
  id: number
  wardId: number
  roomId: number | null
  code: string
  kind: BedKind
  status: BedStatus
  sexRestriction: 'M' | 'F' | null
  currentAdmissionId: number | null
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BedInput {
  wardId: number
  roomId?: number | null
  code: string
  kind?: BedKind
  sexRestriction?: 'M' | 'F' | null
  notes?: string | null
  active?: boolean
}

/** Leito enriquecido com dados do setor e da internação ativa, para o mapa de leitos. */
export interface BedWithRefs extends Bed {
  wardName: string
  wardKind: WardKind
  roomName: string | null
  admission: {
    id: number
    patientId: number
    patientName: string
    patientSex: Sex
    patientBirthDate: string
    admittedAt: string
    attendingProfessionalName: string | null
    admissionDiagnosis: string | null
  } | null
}

export type AdmissionType =
  | 'eletiva'
  | 'urgencia'
  | 'emergencia'
  | 'transferencia_externa'
  | 'obstetrica'

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  eletiva: 'Eletiva',
  urgencia: 'Urgência',
  emergencia: 'Emergência',
  transferencia_externa: 'Transferência externa',
  obstetrica: 'Obstétrica'
}

export type AdmissionStatus = 'ativa' | 'alta' | 'obito' | 'transferencia' | 'evasao'

export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = {
  ativa: 'Internado',
  alta: 'Alta',
  obito: 'Óbito',
  transferencia: 'Transferência externa',
  evasao: 'Evasão'
}

export type DischargeType =
  | 'alta_melhora'
  | 'alta_pedido'
  | 'alta_administrativa'
  | 'transferencia_externa'
  | 'obito'
  | 'evasao'

export const DISCHARGE_TYPE_LABELS: Record<DischargeType, string> = {
  alta_melhora: 'Alta por melhora',
  alta_pedido: 'Alta a pedido',
  alta_administrativa: 'Alta administrativa',
  transferencia_externa: 'Transferência externa',
  obito: 'Óbito',
  evasao: 'Evasão'
}

export interface Admission {
  id: number
  patientId: number
  attendingProfessionalId: number | null
  admittedAt: string
  admissionType: AdmissionType
  admissionOrigin: string | null
  chiefComplaint: string | null
  admissionDiagnosis: string | null
  admissionCid10: string | null
  status: AdmissionStatus
  currentBedId: number | null
  dischargeAt: string | null
  dischargeType: DischargeType | null
  dischargeSummary: string | null
  dischargeCid10: string | null
  notes: string | null
  /** Número da AIH emitida pelo gestor (preenchido manualmente). */
  aihNumber: string | null
  /** Código SIGTAP do procedimento principal autorizado na AIH. */
  aihMainProcedureCode: string | null
  /** Justificativa clínica usada na AIH. */
  aihJustification: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface AihInput {
  admissionId: number
  aihNumber: string | null
  aihMainProcedureCode: string | null
  aihJustification: string | null
}

export interface AdmissionWithRefs extends Admission {
  patient: Pick<Patient, 'id' | 'fullName' | 'cpf' | 'cns' | 'birthDate' | 'sex'>
  attendingProfessional: Pick<Professional, 'id' | 'fullName' | 'specialty'> | null
  currentBed: {
    id: number
    code: string
    wardId: number
    wardName: string
    roomName: string | null
  } | null
}

export interface AdmissionInput {
  patientId: number
  bedId: number
  attendingProfessionalId: number | null
  admittedAt?: string | null
  admissionType: AdmissionType
  admissionOrigin?: string | null
  chiefComplaint?: string | null
  admissionDiagnosis?: string | null
  admissionCid10?: string | null
  notes?: string | null
}

export interface TransferAdmissionInput {
  admissionId: number
  toBedId: number
  reason?: string | null
  notes?: string | null
}

export interface DischargeAdmissionInput {
  admissionId: number
  dischargeType: DischargeType
  dischargeAt?: string | null
  dischargeSummary?: string | null
  dischargeCid10?: string | null
  notes?: string | null
}

export type BedMovementAction =
  | 'admissao'
  | 'transferencia'
  | 'alta'
  | 'obito'
  | 'evasao'
  | 'transferencia_externa'

export const BED_MOVEMENT_ACTION_LABELS: Record<BedMovementAction, string> = {
  admissao: 'Admissão',
  transferencia: 'Transferência interna',
  alta: 'Alta',
  obito: 'Óbito',
  evasao: 'Evasão',
  transferencia_externa: 'Transferência externa'
}

export interface BedMovement {
  id: number
  admissionId: number
  bedId: number | null
  bedCode: string | null
  wardId: number | null
  wardName: string | null
  action: BedMovementAction
  fromBedId: number | null
  fromBedCode: string | null
  reason: string | null
  notes: string | null
  performedByUserId: number | null
  performedByName: string | null
  createdAt: string
}

/** Resumo do mapa de leitos por setor (usado na página /leitos). */
export interface WardOccupancySummary {
  ward: Ward
  total: number
  ocupado: number
  livre: number
  outros: number
  beds: BedWithRefs[]
}

// =====================================================================
// Evoluções clínicas multiprofissionais durante a internação
// =====================================================================

export type EvolutionAuthorRole =
  | 'medico'
  | 'enfermagem'
  | 'fisioterapia'
  | 'nutricao'
  | 'fonoaudiologia'
  | 'psicologia'
  | 'terapia_ocupacional'
  | 'farmacia'
  | 'servico_social'
  | 'outro'

export const EVOLUTION_AUTHOR_ROLE_LABELS: Record<EvolutionAuthorRole, string> = {
  medico: 'Médica',
  enfermagem: 'Enfermagem',
  fisioterapia: 'Fisioterapia',
  nutricao: 'Nutrição',
  fonoaudiologia: 'Fonoaudiologia',
  psicologia: 'Psicologia',
  terapia_ocupacional: 'Terapia Ocupacional',
  farmacia: 'Farmácia',
  servico_social: 'Serviço Social',
  outro: 'Outro'
}

export interface AdmissionEvolution {
  id: number
  admissionId: number
  professionalId: number | null
  authorRole: EvolutionAuthorRole
  evolutionAt: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  freeText: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionEvolutionWithRefs extends AdmissionEvolution {
  professionalName: string | null
  professionalSpecialty: string | null
  createdByUserName: string | null
}

export interface AdmissionEvolutionInput {
  admissionId: number
  professionalId?: number | null
  authorRole: EvolutionAuthorRole
  evolutionAt?: string
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
  freeText?: string | null
}

// =====================================================================
// Sinais vitais
// =====================================================================

export interface AdmissionVitalSigns {
  id: number
  admissionId: number
  professionalId: number | null
  measuredAt: string
  systolicBp: number | null
  diastolicBp: number | null
  heartRate: number | null
  respiratoryRate: number | null
  temperatureC: number | null
  oxygenSaturation: number | null
  painScore: number | null
  bloodGlucose: number | null
  weightKg: number | null
  heightCm: number | null
  notes: string | null
  createdByUserId: number | null
  createdAt: string
}

export interface AdmissionVitalSignsWithRefs extends AdmissionVitalSigns {
  professionalName: string | null
  createdByUserName: string | null
}

export interface AdmissionVitalSignsInput {
  admissionId: number
  professionalId?: number | null
  measuredAt?: string
  systolicBp?: number | null
  diastolicBp?: number | null
  heartRate?: number | null
  respiratoryRate?: number | null
  temperatureC?: number | null
  oxygenSaturation?: number | null
  painScore?: number | null
  bloodGlucose?: number | null
  weightKg?: number | null
  heightCm?: number | null
  notes?: string | null
}

// =====================================================================
// Prescrição hospitalar + MAR (Medication Administration Record)
// =====================================================================

export type MedicationRoute =
  | 'oral'
  | 'iv'
  | 'im'
  | 'sc'
  | 'sl'
  | 'inalatorio'
  | 'topico'
  | 'retal'
  | 'vaginal'
  | 'ocular'
  | 'otologico'
  | 'enteral'
  | 'outro'

export const MEDICATION_ROUTE_LABELS: Record<MedicationRoute, string> = {
  oral: 'VO — via oral',
  iv: 'EV — endovenosa',
  im: 'IM — intramuscular',
  sc: 'SC — subcutânea',
  sl: 'SL — sublingual',
  inalatorio: 'Inalatória',
  topico: 'Tópica',
  retal: 'Retal',
  vaginal: 'Vaginal',
  ocular: 'Ocular',
  otologico: 'Otológica',
  enteral: 'Enteral (sonda)',
  outro: 'Outra'
}

export type PrescriptionStatus = 'ativa' | 'suspensa' | 'cancelada' | 'finalizada'

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada'
}

export type MarStatus = 'aprazado' | 'administrado' | 'recusado' | 'omitido' | 'suspenso'

export const MAR_STATUS_LABELS: Record<MarStatus, string> = {
  aprazado: 'Aprazado',
  administrado: 'Administrado',
  recusado: 'Recusado',
  omitido: 'Omitido',
  suspenso: 'Suspenso'
}

export interface AdmissionPrescriptionItemInput {
  medicationId?: number | null
  medicationName: string
  dose: string
  route: MedicationRoute
  frequencyLabel: string
  intervalHours?: number | null
  durationDays?: number | null
  ifNecessary?: boolean
  startAt?: string
  endAt?: string | null
  notes?: string | null
}

export interface AdmissionPrescriptionInput {
  admissionId: number
  prescribedByProfessionalId?: number | null
  prescribedAt?: string
  notes?: string | null
  items: AdmissionPrescriptionItemInput[]
}

export interface AdmissionPrescriptionItem {
  id: number
  prescriptionId: number
  medicationId: number | null
  medicationName: string
  dose: string
  route: MedicationRoute
  frequencyLabel: string
  intervalHours: number | null
  durationDays: number | null
  ifNecessary: boolean
  startAt: string
  endAt: string | null
  status: PrescriptionStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionPrescription {
  id: number
  admissionId: number
  prescribedByProfessionalId: number | null
  prescribedAt: string
  status: PrescriptionStatus
  notes: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface AdmissionPrescriptionWithItems extends AdmissionPrescription {
  prescribedByProfessionalName: string | null
  createdByUserName: string | null
  items: AdmissionPrescriptionItem[]
}

export interface MedicationAdministration {
  id: number
  prescriptionItemId: number
  scheduledAt: string
  status: MarStatus
  administeredAt: string | null
  doseGiven: string | null
  administeredByUserId: number | null
  administeredByProfessionalId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface MedicationAdministrationWithRefs extends MedicationAdministration {
  medicationName: string
  dose: string
  route: MedicationRoute
  prescriptionId: number
  administeredByUserName: string | null
  administeredByProfessionalName: string | null
}

export interface MarCheckInput {
  status: MarStatus
  administeredAt?: string | null
  doseGiven?: string | null
  administeredByProfessionalId?: number | null
  notes?: string | null
}

export interface AppError {
  code: string
  message: string
}

// ─── Balanço Hídrico ────────────────────────────────────────────────────────

export type FluidBalanceType = 'entrada' | 'saida'

export const FLUID_INPUT_SUBTYPES = [
  'SF 0,9%',
  'SG 5%',
  'Ringer Lactato',
  'Albumina',
  'Sangue total',
  'Concentrado de hemácias',
  'Plasma',
  'Dieta enteral',
  'Dieta parenteral',
  'Água oral',
  'Outros fluidos orais',
  'Outro'
] as const

export const FLUID_OUTPUT_SUBTYPES = [
  'Diurese',
  'Dreno torácico',
  'Dreno abdominal',
  'Sonda nasogástrica',
  'Débito de fístula',
  'Evacuação',
  'Vômito',
  'Sangramento',
  'Outro'
] as const

export type FluidInputSubtype = (typeof FLUID_INPUT_SUBTYPES)[number]
export type FluidOutputSubtype = (typeof FLUID_OUTPUT_SUBTYPES)[number]

export interface FluidBalanceEntry {
  id: number
  admissionId: number
  type: FluidBalanceType
  subtype: string
  volumeMl: number
  recordedAt: string
  professionalId: number | null
  notes: string | null
  createdByUserId: number | null
  createdAt: string
}

export interface FluidBalanceEntryWithRefs extends FluidBalanceEntry {
  professionalName: string | null
  createdByUserName: string | null
}

export interface FluidBalanceInput {
  admissionId: number
  type: FluidBalanceType
  subtype: string
  volumeMl: number
  recordedAt?: string
  professionalId?: number | null
  notes?: string | null
}

export interface FluidBalanceDailySummary {
  date: string
  totalIn: number
  totalOut: number
  balance: number
}

export interface FluidBalanceSummary {
  totalIn: number
  totalOut: number
  balance: number
  byDay: FluidBalanceDailySummary[]
}

// ════════════════════════════════════════════════════════════════════
//   PRONTO-SOCORRO (PS)
// ════════════════════════════════════════════════════════════════════

export type ErArrivalMode = 'proprio' | 'samu' | 'bombeiros' | 'policia' | 'transferencia' | 'outro'

export const ER_ARRIVAL_MODE_LABELS: Record<ErArrivalMode, string> = {
  proprio: 'Por meios próprios',
  samu: 'SAMU',
  bombeiros: 'Bombeiros',
  policia: 'Polícia',
  transferencia: 'Transferência',
  outro: 'Outro'
}

export type ErVisitStatus =
  | 'aguardando_triagem'
  | 'triado'
  | 'em_atendimento'
  | 'aguardando_internacao'
  | 'alta'
  | 'internado'
  | 'transferido'
  | 'evasao'
  | 'obito'

export const ER_VISIT_STATUS_LABELS: Record<ErVisitStatus, string> = {
  aguardando_triagem: 'Aguardando triagem',
  triado: 'Triado',
  em_atendimento: 'Em atendimento',
  aguardando_internacao: 'Aguardando internação',
  alta: 'Alta',
  internado: 'Internado',
  transferido: 'Transferido',
  evasao: 'Evasão',
  obito: 'Óbito'
}

export type TriageColor = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'

export const TRIAGE_LABELS: Record<TriageColor, string> = {
  azul: 'Azul — não urgente',
  verde: 'Verde — pouco urgente',
  amarelo: 'Amarelo — urgente',
  laranja: 'Laranja — muito urgente',
  vermelho: 'Vermelho — emergência'
}

export const TRIAGE_ORDER: Record<TriageColor, number> = {
  vermelho: 0,
  laranja: 1,
  amarelo: 2,
  verde: 3,
  azul: 4
}

export const TRIAGE_COLOR_LABELS: Record<TriageColor, string> = {
  vermelho: 'Vermelho — Emergência',
  laranja: 'Laranja — Muito urgente',
  amarelo: 'Amarelo — Urgente',
  verde: 'Verde — Pouco urgente',
  azul: 'Azul — Não urgente'
}

/** Tempo máximo de espera por cor da classificação Manchester (em minutos). */
export const TRIAGE_TARGET_MINUTES: Record<TriageColor, number> = {
  vermelho: 0,
  laranja: 10,
  amarelo: 60,
  verde: 120,
  azul: 240
}

export interface ErVisit {
  id: number
  patientId: number
  arrivedAt: string
  arrivalMode: ErArrivalMode | null
  chiefComplaint: string
  status: ErVisitStatus
  attendingProfessionalId: number | null
  notes: string | null
  closedAt: string | null
  outcomeSummary: string | null
  admissionId: number | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface ErVisitWithRefs extends ErVisit {
  patientName: string
  patientCpf: string | null
  patientBirthDate: string
  attendingProfessionalName: string | null
  latestTriageColor: TriageColor | null
  latestTriageAt: string | null
}

export interface ErVisitInput {
  patientId: number
  arrivalMode?: ErArrivalMode | null
  chiefComplaint: string
  notes?: string | null
}

export interface ErTriage {
  id: number
  visitId: number
  professionalId: number | null
  triagedAt: string
  color: TriageColor
  targetWaitMinutes: number
  discriminator: string | null
  systolicBp: number | null
  diastolicBp: number | null
  heartRate: number | null
  respiratoryRate: number | null
  temperatureC: number | null
  oxygenSaturation: number | null
  painScore: number | null
  glasgow: number | null
  notes: string | null
  createdByUserId: number | null
  createdAt: string
}

export interface ErTriageWithRefs extends ErTriage {
  professionalName: string | null
}

export interface ErTriageInput {
  visitId: number
  professionalId?: number | null
  color: TriageColor
  discriminator?: string | null
  systolicBp?: number | null
  diastolicBp?: number | null
  heartRate?: number | null
  respiratoryRate?: number | null
  temperatureC?: number | null
  oxygenSaturation?: number | null
  painScore?: number | null
  glasgow?: number | null
  notes?: string | null
}

export type ErCloseOutcome = 'alta' | 'internado' | 'transferido' | 'evasao' | 'obito'

export interface ErCloseInput {
  visitId: number
  outcome: ErCloseOutcome
  outcomeSummary?: string | null
  admissionId?: number | null
}

// ════════════════════════════════════════════════════════════════════
//   CENTRO CIRÚRGICO
// ════════════════════════════════════════════════════════════════════

export interface SurgicalRoom {
  id: number
  name: string
  code: string | null
  floor: string | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SurgicalRoomInput {
  name: string
  code?: string | null
  floor?: string | null
  notes?: string | null
}

export type AnesthesiaType =
  | 'geral'
  | 'raquianestesia'
  | 'peridural'
  | 'local'
  | 'sedacao'
  | 'bloqueio'
  | 'outro'

export const ANESTHESIA_TYPE_LABELS: Record<AnesthesiaType, string> = {
  geral: 'Geral',
  raquianestesia: 'Raquianestesia',
  peridural: 'Peridural',
  local: 'Local',
  sedacao: 'Sedação',
  bloqueio: 'Bloqueio',
  outro: 'Outro'
}

export type SurgeryPriority = 'eletiva' | 'urgencia' | 'emergencia'

export const SURGERY_PRIORITY_LABELS: Record<SurgeryPriority, string> = {
  eletiva: 'Eletiva',
  urgencia: 'Urgência',
  emergencia: 'Emergência'
}

export type SurgeryStatus =
  | 'agendada'
  | 'aguardando'
  | 'em_curso'
  | 'concluida'
  | 'cancelada'
  | 'suspensa'

export const SURGERY_STATUS_LABELS: Record<SurgeryStatus, string> = {
  agendada: 'Agendada',
  aguardando: 'Aguardando entrada',
  em_curso: 'Em curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  suspensa: 'Suspensa'
}

export interface Surgery {
  id: number
  patientId: number
  roomId: number | null
  admissionId: number | null
  surgeonProfessionalId: number | null
  anesthetistProfessionalId: number | null
  scheduledStart: string
  scheduledEnd: string
  actualStart: string | null
  actualEnd: string | null
  procedureName: string
  procedureCid10: string | null
  anesthesiaType: AnesthesiaType | null
  priority: SurgeryPriority
  status: SurgeryStatus
  timeOutCompleted: boolean
  timeOutAt: string | null
  notes: string | null
  cancelReason: string | null
  /** Descrição cirúrgica para a Folha de Sala. */
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface SurgeryWithRefs extends Surgery {
  patientName: string
  patientCpf: string | null
  roomName: string | null
  surgeonName: string | null
  anesthetistName: string | null
}

export interface SurgeryInput {
  patientId: number
  roomId?: number | null
  admissionId?: number | null
  surgeonProfessionalId?: number | null
  anesthetistProfessionalId?: number | null
  scheduledStart: string
  scheduledEnd: string
  procedureName: string
  procedureCid10?: string | null
  anesthesiaType?: AnesthesiaType | null
  priority: SurgeryPriority
  notes?: string | null
}

export interface SurgeryTimeOutItem {
  id: number
  surgeryId: number
  item: string
  checked: boolean
  checkedAt: string | null
  checkedByUserId: number | null
  notes: string | null
}

export interface SurgeryOpme {
  id: number
  surgeryId: number
  description: string
  manufacturer: string | null
  lotNumber: string | null
  serialNumber: string | null
  quantity: number
  unit: string | null
  notes: string | null
  registeredByUserId: number | null
  registeredAt: string
}

export interface SurgeryOpmeInput {
  surgeryId: number
  description: string
  manufacturer?: string | null
  lotNumber?: string | null
  serialNumber?: string | null
  quantity: number
  unit?: string | null
  notes?: string | null
}

/** Checklist padrão WHO Surgical Safety Checklist — fase Time Out. */
export const TIME_OUT_DEFAULT_CHECKLIST = [
  'Equipe se apresenta (nome e função)',
  'Confirmação do paciente, sítio e procedimento',
  'Antibiótico profilático administrado nos últimos 60 min',
  'Eventos críticos antecipados pela equipe cirúrgica',
  'Anestesia: questões críticas antecipadas',
  'Enfermagem: esterilidade e equipamentos verificados',
  'Imagens essenciais expostas'
] as const

// ════════════════════════════════════════════════════════════════════
//   CCIH — Controle de Infecção Hospitalar
// ════════════════════════════════════════════════════════════════════

export type InfectionSite =
  | 'corrente_sanguinea'
  | 'itu'
  | 'pneumonia'
  | 'sitio_cirurgico'
  | 'cateter_central'
  | 'pele_tecidos_moles'
  | 'outro'

export const INFECTION_SITE_LABELS: Record<InfectionSite, string> = {
  corrente_sanguinea: 'Corrente sanguínea (sepse / IPCSL)',
  itu: 'Trato urinário (ITU)',
  pneumonia: 'Pneumonia (PAV / PNM)',
  sitio_cirurgico: 'Sítio cirúrgico (ISC)',
  cateter_central: 'Cateter venoso central',
  pele_tecidos_moles: 'Pele / tecidos moles',
  outro: 'Outro'
}

export type DeviceType = 'cvc' | 'sva' | 'vm' | 'outro'

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  cvc: 'Cateter venoso central (CVC)',
  sva: 'Sonda vesical de demora (SVD/SVA)',
  vm: 'Ventilação mecânica (VM)',
  outro: 'Outro dispositivo invasivo'
}

export interface IrasCase {
  id: number
  patientId: number
  admissionId: number | null
  notificationDate: string
  infectionSite: InfectionSite
  microorganism: string | null
  resistantProfile: string | null
  isDeviceAssociated: boolean
  deviceType: DeviceType | null
  cultureCollected: boolean
  cultureCollectedAt: string | null
  cultureResult: string | null
  notes: string | null
  notifiedByProfessionalId: number | null
  createdAt: string
  updatedAt: string
}

export interface IrasCaseWithRefs extends IrasCase {
  patientName: string
  patientCpf: string | null
  notifiedByProfessionalName: string | null
}

export interface IrasCaseInput {
  patientId: number
  admissionId?: number | null
  infectionSite: InfectionSite
  microorganism?: string | null
  resistantProfile?: string | null
  isDeviceAssociated?: boolean
  deviceType?: DeviceType | null
  cultureCollected?: boolean
  cultureCollectedAt?: string | null
  cultureResult?: string | null
  notifiedByProfessionalId?: number | null
  notes?: string | null
}

export type IsolationKind = 'contato' | 'goticulas' | 'aerossois' | 'protetor' | 'outro'

export const ISOLATION_KIND_LABELS: Record<IsolationKind, string> = {
  contato: 'Contato',
  goticulas: 'Gotículas',
  aerossois: 'Aerossóis',
  protetor: 'Protetor (imunossupressão)',
  outro: 'Outro'
}

export interface Isolation {
  id: number
  admissionId: number
  kind: IsolationKind
  reason: string
  startedAt: string
  endedAt: string | null
  endedReason: string | null
  notes: string | null
  createdAt: string
}

export interface IsolationInput {
  admissionId: number
  kind: IsolationKind
  reason: string
  notes?: string | null
}

export interface IrasIndicators {
  totalCases: number
  bySite: Record<InfectionSite, number>
  deviceAssociated: number
  activeIsolations: number
}

// ════════════════════════════════════════════════════════════════════
//   SINAN — Notificação Compulsória
// ════════════════════════════════════════════════════════════════════

export interface SinanNotification {
  id: number
  patientId: number
  professionalId: number | null
  agravoCid: string
  agravoName: string
  sintomasIniciaisEm: string | null
  notificadoEm: string
  classificacao: string | null
  evolucao: string | null
  observations: string | null
  exportedAt: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export interface SinanNotificationWithRefs extends SinanNotification {
  patientName: string
  patientCpf: string | null
  patientCns: string | null
  patientBirthDate: string | null
  patientSex: Sex | null
  professionalName: string | null
  professionalCns: string | null
}

export interface SinanNotificationInput {
  patientId: number
  professionalId?: number | null
  agravoCid: string
  agravoName: string
  sintomasIniciaisEm?: string | null
  classificacao?: string | null
  evolucao?: string | null
  observations?: string | null
}

/** Agravos mais frequentes de notificação compulsória. */
export const SINAN_COMMON_AGRAVOS: Array<{ cid: string; name: string }> = [
  { cid: 'A90', name: 'Dengue' },
  { cid: 'A92.0', name: 'Chikungunya' },
  { cid: 'A92.5', name: 'Zika' },
  { cid: 'B16', name: 'Hepatite B' },
  { cid: 'B17.1', name: 'Hepatite C' },
  { cid: 'B20', name: 'HIV/AIDS' },
  { cid: 'A53.9', name: 'Sífilis' },
  { cid: 'A15', name: 'Tuberculose' },
  { cid: 'A37', name: 'Coqueluche' },
  { cid: 'B05', name: 'Sarampo' },
  { cid: 'B26', name: 'Caxumba' },
  { cid: 'A33', name: 'Tétano neonatal' },
  { cid: 'A36', name: 'Difteria' },
  { cid: 'G03', name: 'Meningite' },
  { cid: 'U07.1', name: 'COVID-19' }
]

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppError }
