import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { IPC } from '@shared/ipc'
import { getCurrentUser, requireRole, requireUser, setCurrentUser } from './session'
import * as usersRepo from './repositories/users'
import * as profRepo from './repositories/professionals'
import * as patientsRepo from './repositories/patients'
import * as reportsRepo from './repositories/reports'
import * as backupRepo from './repositories/backup'
import * as settingsRepo from './repositories/settings'
import * as brandingRepo from './repositories/branding'
import * as exportsRepo from './repositories/exports'
import * as demoRepo from './repositories/demo'
import * as pharmacyRepo from './repositories/pharmacy'
import * as wardsRepo from './repositories/wards'
import * as bedsRepo from './repositories/beds'
import * as admissionsRepo from './repositories/admissions'
import * as evolutionsRepo from './repositories/evolutions'
import * as vitalSignsRepo from './repositories/vitalSigns'
import * as hospitalRxRepo from './repositories/hospitalPrescriptions'
import * as fluidBalanceRepo from './repositories/fluidBalance'
import * as erRepo from './repositories/er'
import * as surgeryRepo from './repositories/surgery'
import * as ccihRepo from './repositories/ccih'
import * as apptsRepo from './repositories/appointments'
import * as attRepo from './repositories/attendances'
import * as triagesRepo from './repositories/triages'
import * as prescriptionsRepo from './repositories/prescriptions'
import * as requisitionsRepo from './repositories/requisitions'
import * as callsRepo from './repositories/calls'
import * as bpaRepo from './repositories/bpa'
import * as timeclockRepo from './repositories/timeclock'
import { createSecondaryWindow, isPanelWindow } from './windows'
import { listAudit, logAudit, purgeAuditOlderThan } from './audit'
import type {
  AppSettings,
  PatientInput,
  UserRole,
  MedicationInput,
  MedicationLotInput,
  StockMovementInput,
  DispensationInput,
  WardInput,
  BedInput,
  BedStatus,
  AdmissionInput,
  TransferAdmissionInput,
  DischargeAdmissionInput,
  AdmissionEvolutionInput,
  AdmissionVitalSignsInput,
  AdmissionPrescriptionInput,
  PrescriptionStatus,
  MarCheckInput,
  ErVisitInput,
  ErVisitStatus,
  ErTriageInput,
  ErCloseInput,
  SurgeryInput,
  SurgeryStatus,
  SurgicalRoomInput,
  SurgeryOpmeInput,
  IrasCaseInput,
  IsolationInput,
  InfectionSite,
  AppointmentStatus,
  TriageColor,
  PatientCallInput,
  PrescriptionInput,
  RequisitionInput,
  RequisitionStatus,
  TriageRecordInput,
  BpaRecordInput,
  TimeclockEntryInput
} from '@shared/types'
import type { AttendanceSaveInput } from './repositories/attendances'

type Handler = (...args: unknown[]) => unknown | Promise<unknown>

function registerHandler(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await handler(...args)
      return { ok: true, data }
    } catch (err) {
      const error = err as Error & { code?: string }
      return {
        ok: false,
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.message || 'Erro interno do servidor.'
        }
      }
    }
  })
}

export function registerIpcHandlers(): void {
  // ---------- Meta ----------
  registerHandler(IPC.meta.appInfo, () => ({
    version: app.getVersion(),
    name: app.getName(),
    dbPath: backupRepo.getCurrentDatabasePath()
  }))

  // ---------- Auth ----------
  registerHandler(IPC.auth.login, (username: unknown, password: unknown) => {
    const user = usersRepo.verifyLogin(String(username), String(password))
    if (!user) {
      throw Object.assign(new Error('Usuário ou senha inválidos.'), {
        code: 'INVALID_CREDENTIALS'
      })
    }
    setCurrentUser(user)
    logAudit({ action: 'login', entity: 'user', entityId: user.id })
    return user
  })

  registerHandler(IPC.auth.logout, () => {
    const current = getCurrentUser()
    if (current) logAudit({ action: 'logout', entity: 'user', entityId: current.id })
    setCurrentUser(null)
    return null
  })

  registerHandler(IPC.auth.whoami, () => getCurrentUser())

  registerHandler(IPC.auth.changePassword, (oldPassword: unknown, newPassword: unknown) => {
    const user = requireUser()
    usersRepo.changePassword(user.id, String(oldPassword), String(newPassword))
    const refreshed = usersRepo.getUserById(user.id)
    if (refreshed) setCurrentUser(refreshed)
    return refreshed
  })

  // ---------- Users (admin) ----------
  registerHandler(IPC.users.list, () => {
    requireRole('admin')
    return usersRepo.listUsers()
  })

  registerHandler(IPC.users.create, (input: unknown) => {
    requireRole('admin')
    const i = input as {
      username: string
      password: string
      fullName: string
      role: UserRole
    }
    return usersRepo.createUser(i)
  })

  registerHandler(IPC.users.update, (id: unknown, input: unknown) => {
    requireRole('admin')
    const i = input as { fullName?: string; role?: UserRole }
    return usersRepo.updateUser(Number(id), i)
  })

  registerHandler(IPC.users.resetPassword, (id: unknown, newPassword: unknown) => {
    requireRole('admin')
    usersRepo.resetPassword(Number(id), String(newPassword))
    return null
  })

  registerHandler(IPC.users.setActive, (id: unknown, active: unknown) => {
    requireRole('admin')
    usersRepo.setUserActive(Number(id), Boolean(active))
    return null
  })

  // ---------- Professionals ----------
  registerHandler(IPC.professionals.list, (activeOnly: unknown) => {
    requireUser()
    return profRepo.listProfessionals(Boolean(activeOnly))
  })

  registerHandler(IPC.professionals.get, (id: unknown) => {
    requireUser()
    return profRepo.getProfessional(Number(id))
  })

  registerHandler(IPC.professionals.create, (input: unknown) => {
    requireRole('admin', 'recepcao')
    return profRepo.createProfessional(input as profRepo.ProfessionalInput)
  })

  registerHandler(IPC.professionals.update, (id: unknown, input: unknown) => {
    requireRole('admin', 'recepcao')
    return profRepo.updateProfessional(Number(id), input as profRepo.ProfessionalInput)
  })

  registerHandler(IPC.professionals.setActive, (id: unknown, active: unknown) => {
    requireRole('admin')
    profRepo.setProfessionalActive(Number(id), Boolean(active))
    return null
  })

  // ---------- Patients ----------
  registerHandler(IPC.patients.list, () => {
    requireUser()
    return patientsRepo.listPatients()
  })

  registerHandler(IPC.patients.search, (query: unknown) => {
    requireUser()
    return patientsRepo.searchPatients(String(query ?? ''))
  })

  registerHandler(IPC.patients.get, (id: unknown) => {
    requireUser()
    return patientsRepo.getPatient(Number(id))
  })

  registerHandler(IPC.patients.create, (input: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem')
    return patientsRepo.createPatient(input as PatientInput)
  })

  registerHandler(IPC.patients.update, (id: unknown, input: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem')
    return patientsRepo.updatePatient(Number(id), input as PatientInput)
  })

  registerHandler(IPC.patients.remove, (id: unknown) => {
    requireRole('admin')
    patientsRepo.deletePatient(Number(id))
    return null
  })

  registerHandler(IPC.patients.exportData, async (id: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem', 'medico')
    const patientId = Number(id)
    const data = patientsRepo.exportPatientData(patientId)
    const safeName = data.patient.fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40)
    const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
    const defaultName = `paciente-${safeName || patientId}-${ts}.json`
    const chosen = await dialog.showSaveDialog({
      title: 'Exportar dados do paciente (LGPD)',
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (chosen.canceled || !chosen.filePath) {
      return { saved: false, path: null as string | null }
    }
    writeFileSync(chosen.filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' })
    return { saved: true, path: chosen.filePath }
  })

  registerHandler(IPC.patients.anonymize, (id: unknown) => {
    requireRole('admin')
    return patientsRepo.anonymizePatient(Number(id))
  })

  // ---------- Reports ----------
  registerHandler(IPC.reports.dashboard, (dateIso: unknown) => {
    requireUser()
    return reportsRepo.getDashboardStats(String(dateIso))
  })

  registerHandler(IPC.reports.production, (startIso: unknown, endIso: unknown) => {
    requireUser()
    return reportsRepo.getProductionReport(String(startIso), String(endIso))
  })

  // ---------- Backup ----------
  registerHandler(IPC.backup.export, async () => {
    requireRole('admin')
    return await backupRepo.exportBackup()
  })

  registerHandler(IPC.backup.list, () => {
    requireRole('admin')
    return backupRepo.listBackups()
  })

  registerHandler(IPC.backup.restore, async () => {
    requireRole('admin')
    const result = await backupRepo.restoreBackup()
    if (result.restored) {
      // Agenda saída em 500 ms para a UI conseguir mostrar a mensagem de sucesso.
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 500)
    }
    return result
  })

  // ---------- Audit ----------
  registerHandler(IPC.audit.list, (limit: unknown) => {
    requireRole('admin')
    const parsed = Number(limit)
    return listAudit(Number.isFinite(parsed) && parsed > 0 ? parsed : 200)
  })

  registerHandler(IPC.audit.purge, () => {
    requireRole('admin')
    const settings = settingsRepo.getSettings()
    const removed = purgeAuditOlderThan(settings.auditRetentionDays)
    return { removed, retentionDays: settings.auditRetentionDays }
  })

  // ---------- Settings ----------
  registerHandler(IPC.settings.get, () => {
    requireRole('admin')
    return settingsRepo.getSettings()
  })

  registerHandler(IPC.settings.update, (input: unknown) => {
    requireRole('admin')
    return settingsRepo.updateSettings(input as Partial<AppSettings>)
  })

  // Settings públicos (sem PII): qualquer usuário autenticado pode ler — usado
  // pelos cabeçalhos das telas de impressão e pelo provider de tema.
  registerHandler(IPC.settings.getPublic, () => {
    requireUser()
    const s = settingsRepo.getSettings()
    return {
      unitName: s.unitName,
      unitCnes: s.unitCnes,
      unitAddress: s.unitAddress,
      unitPhone: s.unitPhone,
      unitMunicipality: s.unitMunicipality,
      brandingPrefeituraName: s.brandingPrefeituraName,
      brandingSecretariaName: s.brandingSecretariaName,
      themePrimary: s.themePrimary,
      themeMode: s.themeMode,
      unitType: s.unitType
    }
  })

  // ---------- Branding (logos) ----------
  registerHandler(IPC.branding.uploadLogo, (input: unknown) => {
    requireRole('admin')
    const i = input as {
      slot: 'prefeitura' | 'secretaria' | 'hospital'
      filename: string
      mimeType: string
      bytes: ArrayBuffer | Uint8Array
    }
    return brandingRepo.uploadLogo(i)
  })

  registerHandler(IPC.branding.removeLogo, (slot: unknown) => {
    requireRole('admin')
    return brandingRepo.removeLogo(slot as 'prefeitura' | 'secretaria' | 'hospital')
  })

  // Logos como data URLs: qualquer usuário autenticado pode ler (usadas no header
  // da app e nos cabeçalhos de impressão — não há PII em logo institucional).
  registerHandler(IPC.branding.getLogos, () => {
    requireUser()
    return brandingRepo.getLogos()
  })

  // ---------- CSV exports ----------
  registerHandler(IPC.exports.patientsCsv, async () => {
    requireRole('admin', 'recepcao')
    const csv = exportsRepo.exportPatientsCsv()
    const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
    const chosen = await dialog.showSaveDialog({
      title: 'Exportar pacientes (CSV)',
      defaultPath: `pacientes-${ts}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (chosen.canceled || !chosen.filePath) {
      return { saved: false, path: null as string | null }
    }
    writeFileSync(chosen.filePath, csv, { encoding: 'utf8' })
    return { saved: true, path: chosen.filePath }
  })

  // ---------- Farmácia ----------
  registerHandler(IPC.pharmacy.listMedications, (includeInactive: unknown) => {
    requireUser()
    return pharmacyRepo.listMedications(includeInactive === true)
  })

  registerHandler(IPC.pharmacy.listStock, () => {
    requireUser()
    return pharmacyRepo.listStock()
  })

  registerHandler(IPC.pharmacy.getMedication, (id: unknown) => {
    requireUser()
    return pharmacyRepo.getMedication(Number(id))
  })

  registerHandler(IPC.pharmacy.createMedication, (input: unknown) => {
    requireRole('admin', 'farmacia')
    return pharmacyRepo.createMedication(input as MedicationInput)
  })

  registerHandler(IPC.pharmacy.updateMedication, (id: unknown, input: unknown) => {
    requireRole('admin', 'farmacia')
    return pharmacyRepo.updateMedication(Number(id), input as MedicationInput)
  })

  registerHandler(IPC.pharmacy.setMedicationActive, (id: unknown, active: unknown) => {
    requireRole('admin', 'farmacia')
    return pharmacyRepo.setMedicationActive(Number(id), Boolean(active))
  })

  registerHandler(IPC.pharmacy.listLots, (medicationId: unknown, includeEmpty: unknown) => {
    requireUser()
    return pharmacyRepo.listLots(
      Number(medicationId),
      includeEmpty === undefined ? true : Boolean(includeEmpty)
    )
  })

  registerHandler(IPC.pharmacy.addLot, (input: unknown) => {
    const user = requireRole('admin', 'farmacia')
    return pharmacyRepo.addLot(input as MedicationLotInput, user.id, user.fullName)
  })

  registerHandler(IPC.pharmacy.addMovement, (input: unknown) => {
    const user = requireRole('admin', 'farmacia')
    return pharmacyRepo.addMovement(input as StockMovementInput, user.id, user.fullName)
  })

  registerHandler(IPC.pharmacy.listMovements, (filter: unknown) => {
    requireUser()
    return pharmacyRepo.listMovements((filter as { medicationId?: number; limit?: number }) ?? {})
  })

  registerHandler(IPC.pharmacy.dispense, (input: unknown) => {
    const user = requireRole('admin', 'farmacia')
    return pharmacyRepo.dispense(input as DispensationInput, user.id, user.fullName)
  })

  registerHandler(IPC.pharmacy.listDispensations, (filter: unknown) => {
    requireUser()
    return pharmacyRepo.listDispensations((filter as { patientId?: number; limit?: number }) ?? {})
  })

  registerHandler(IPC.pharmacy.getDispensation, (id: unknown) => {
    requireUser()
    return pharmacyRepo.getDispensation(Number(id))
  })

  // ---------- Hospital: Setores ----------
  registerHandler(IPC.wards.list, (activeOnly: unknown) => {
    requireUser()
    return wardsRepo.listWards(Boolean(activeOnly))
  })

  registerHandler(IPC.wards.get, (id: unknown) => {
    requireUser()
    return wardsRepo.getWard(Number(id))
  })

  registerHandler(IPC.wards.create, (input: unknown) => {
    requireRole('admin')
    return wardsRepo.createWard(input as WardInput)
  })

  registerHandler(IPC.wards.update, (id: unknown, input: unknown) => {
    requireRole('admin')
    return wardsRepo.updateWard(Number(id), input as WardInput)
  })

  registerHandler(IPC.wards.setActive, (id: unknown, active: unknown) => {
    requireRole('admin')
    wardsRepo.setWardActive(Number(id), Boolean(active))
    return null
  })

  registerHandler(IPC.wards.delete, (id: unknown) => {
    requireRole('admin')
    wardsRepo.deleteWard(Number(id))
    return null
  })

  // ---------- Hospital: Leitos ----------
  registerHandler(IPC.beds.list, (activeOnly: unknown) => {
    requireUser()
    return bedsRepo.listBeds(Boolean(activeOnly))
  })

  registerHandler(IPC.beds.listWithRefs, () => {
    requireUser()
    return bedsRepo.listBedsWithRefs()
  })

  registerHandler(IPC.beds.listForWard, (wardId: unknown) => {
    requireUser()
    return bedsRepo.listBedsForWard(Number(wardId))
  })

  registerHandler(IPC.beds.listFree, () => {
    requireUser()
    return bedsRepo.listFreeBeds()
  })

  registerHandler(IPC.beds.get, (id: unknown) => {
    requireUser()
    return bedsRepo.getBedWithRefs(Number(id))
  })

  registerHandler(IPC.beds.create, (input: unknown) => {
    requireRole('admin')
    return bedsRepo.createBed(input as BedInput)
  })

  registerHandler(IPC.beds.update, (id: unknown, input: unknown) => {
    requireRole('admin')
    return bedsRepo.updateBed(Number(id), input as BedInput)
  })

  registerHandler(IPC.beds.setActive, (id: unknown, active: unknown) => {
    requireRole('admin')
    bedsRepo.setBedActive(Number(id), Boolean(active))
    return null
  })

  registerHandler(IPC.beds.setStatus, (id: unknown, status: unknown, reason: unknown) => {
    requireRole('admin', 'enfermagem')
    return bedsRepo.setBedStatus(
      Number(id),
      String(status) as BedStatus,
      reason == null ? null : String(reason)
    )
  })

  registerHandler(IPC.beds.delete, (id: unknown) => {
    requireRole('admin')
    bedsRepo.deleteBed(Number(id))
    return null
  })

  registerHandler(IPC.beds.occupancyByWard, () => {
    requireUser()
    return bedsRepo.listOccupancyByWard()
  })

  // ---------- Hospital: Internações ----------
  registerHandler(IPC.admissions.listActive, () => {
    requireUser()
    return admissionsRepo.listActiveAdmissions()
  })

  registerHandler(IPC.admissions.listForPatient, (patientId: unknown) => {
    requireUser()
    return admissionsRepo.listAdmissionsForPatient(Number(patientId))
  })

  registerHandler(IPC.admissions.listRecentDischarges, (limit: unknown) => {
    requireUser()
    return admissionsRepo.listRecentDischarges(
      typeof limit === 'number' && Number.isFinite(limit) ? limit : 50
    )
  })

  registerHandler(IPC.admissions.get, (id: unknown) => {
    requireUser()
    return admissionsRepo.getAdmission(Number(id))
  })

  registerHandler(IPC.admissions.admit, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return admissionsRepo.admitPatient(input as AdmissionInput)
  })

  registerHandler(IPC.admissions.transfer, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return admissionsRepo.transferAdmission(input as TransferAdmissionInput)
  })

  registerHandler(IPC.admissions.discharge, (input: unknown) => {
    requireRole('admin', 'medico')
    return admissionsRepo.dischargeAdmission(input as DischargeAdmissionInput)
  })

  registerHandler(IPC.admissions.listMovements, (admissionId: unknown) => {
    requireUser()
    return admissionsRepo.listBedMovements(Number(admissionId))
  })

  // ---------- Evoluções clínicas ----------
  registerHandler(IPC.evolutions.listForAdmission, (admissionId: unknown) => {
    requireUser()
    return evolutionsRepo.listEvolutionsForAdmission(Number(admissionId))
  })

  registerHandler(IPC.evolutions.get, (id: unknown) => {
    requireUser()
    return evolutionsRepo.getEvolution(Number(id))
  })

  registerHandler(IPC.evolutions.create, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return evolutionsRepo.createEvolution(input as AdmissionEvolutionInput)
  })

  registerHandler(IPC.evolutions.update, (idAndInput: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    const { id, input } = idAndInput as { id: number; input: AdmissionEvolutionInput }
    return evolutionsRepo.updateEvolution(Number(id), input)
  })

  registerHandler(IPC.evolutions.delete, (id: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return evolutionsRepo.deleteEvolution(Number(id))
  })

  // ---------- Sinais vitais ----------
  registerHandler(IPC.vitalSigns.listForAdmission, (params: unknown) => {
    requireUser()
    const { admissionId, limit } = (params ?? {}) as {
      admissionId: number
      limit?: number
    }
    return vitalSignsRepo.listVitalSignsForAdmission(Number(admissionId), limit)
  })

  registerHandler(IPC.vitalSigns.latestForAdmission, (admissionId: unknown) => {
    requireUser()
    return vitalSignsRepo.getLatestVitalSignsForAdmission(Number(admissionId))
  })

  registerHandler(IPC.vitalSigns.create, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return vitalSignsRepo.createVitalSigns(input as AdmissionVitalSignsInput)
  })

  registerHandler(IPC.vitalSigns.delete, (id: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return vitalSignsRepo.deleteVitalSigns(Number(id))
  })

  // ---------- Prescrição hospitalar ----------
  registerHandler(IPC.hospitalPrescriptions.listForAdmission, (admissionId: unknown) => {
    requireUser()
    return hospitalRxRepo.listPrescriptionsForAdmission(Number(admissionId))
  })

  registerHandler(IPC.hospitalPrescriptions.get, (id: unknown) => {
    requireUser()
    return hospitalRxRepo.getPrescription(Number(id))
  })

  registerHandler(IPC.hospitalPrescriptions.create, (input: unknown) => {
    requireRole('admin', 'medico')
    return hospitalRxRepo.createPrescription(input as AdmissionPrescriptionInput)
  })

  registerHandler(IPC.hospitalPrescriptions.setStatus, (params: unknown) => {
    requireRole('admin', 'medico')
    const { id, status } = params as { id: number; status: PrescriptionStatus }
    return hospitalRxRepo.setPrescriptionStatus(Number(id), status)
  })

  registerHandler(IPC.hospitalPrescriptions.setItemStatus, (params: unknown) => {
    requireRole('admin', 'medico')
    const { itemId, status } = params as { itemId: number; status: PrescriptionStatus }
    return hospitalRxRepo.setPrescriptionItemStatus(Number(itemId), status)
  })

  // ---------- MAR (checagem de medicação) ----------
  registerHandler(IPC.mar.listForAdmission, (admissionId: unknown) => {
    requireUser()
    return hospitalRxRepo.listMarForAdmission(Number(admissionId))
  })

  registerHandler(IPC.mar.listForItem, (itemId: unknown) => {
    requireUser()
    return hospitalRxRepo.listMarForItem(Number(itemId))
  })

  registerHandler(IPC.mar.check, (params: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    const { id, input } = params as { id: number; input: MarCheckInput }
    return hospitalRxRepo.checkAdministration(Number(id), input)
  })

  registerHandler(IPC.mar.revert, (id: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return hospitalRxRepo.revertAdministration(Number(id))
  })

  // ---------- Balanço hídrico ----------
  registerHandler(IPC.fluidBalance.listForAdmission, (admissionId: unknown) => {
    requireUser()
    return fluidBalanceRepo.listEntriesForAdmission(Number(admissionId))
  })

  registerHandler(IPC.fluidBalance.getSummary, (admissionId: unknown) => {
    requireUser()
    return fluidBalanceRepo.getSummaryForAdmission(Number(admissionId))
  })

  registerHandler(IPC.fluidBalance.create, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return fluidBalanceRepo.createEntry(input as import('@shared/types').FluidBalanceInput)
  })

  registerHandler(IPC.fluidBalance.delete, (id: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    fluidBalanceRepo.deleteEntry(Number(id))
    return null
  })

  // ---------- Demo data ----------
  registerHandler(IPC.demo.seedHospital, () => {
    const user = requireRole('admin')
    return demoRepo.seedHospitalDemo(user.id, user.fullName)
  })

  // ============================================================
  //   PRONTO-SOCORRO
  // ============================================================
  registerHandler(IPC.er.listVisits, (includeClosed: unknown) => {
    requireUser()
    return erRepo.listVisits(Boolean(includeClosed))
  })
  registerHandler(IPC.er.getVisit, (id: unknown) => {
    requireUser()
    return erRepo.getVisit(Number(id))
  })
  registerHandler(IPC.er.createVisit, (input: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem', 'medico')
    return erRepo.createVisit(input as ErVisitInput)
  })
  registerHandler(IPC.er.setStatus, (id: unknown, status: unknown, professionalId: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return erRepo.setVisitStatus(
      Number(id),
      String(status) as ErVisitStatus,
      professionalId == null ? null : Number(professionalId)
    )
  })
  registerHandler(IPC.er.closeVisit, (input: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return erRepo.closeVisit(input as ErCloseInput)
  })
  registerHandler(IPC.er.listTriages, (visitId: unknown) => {
    requireUser()
    return erRepo.listTriagesForVisit(Number(visitId))
  })
  registerHandler(IPC.er.createTriage, (input: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return erRepo.createTriage(input as ErTriageInput)
  })

  // ============================================================
  //   CENTRO CIRÚRGICO
  // ============================================================
  registerHandler(IPC.surgery.listRooms, (activeOnly: unknown) => {
    requireUser()
    return surgeryRepo.listRooms(Boolean(activeOnly))
  })
  registerHandler(IPC.surgery.createRoom, (input: unknown) => {
    requireRole('admin')
    return surgeryRepo.createRoom(input as SurgicalRoomInput)
  })
  registerHandler(IPC.surgery.updateRoom, (id: unknown, input: unknown) => {
    requireRole('admin')
    return surgeryRepo.updateRoom(Number(id), input as SurgicalRoomInput)
  })
  registerHandler(IPC.surgery.setRoomActive, (id: unknown, active: unknown) => {
    requireRole('admin')
    return surgeryRepo.setRoomActive(Number(id), Boolean(active))
  })
  registerHandler(IPC.surgery.listSurgeries, (options: unknown) => {
    requireUser()
    return surgeryRepo.listSurgeries(
      (options as { status?: SurgeryStatus; fromDate?: string; toDate?: string }) ?? undefined
    )
  })
  registerHandler(IPC.surgery.getSurgery, (id: unknown) => {
    requireUser()
    return surgeryRepo.getSurgery(Number(id))
  })
  registerHandler(IPC.surgery.createSurgery, (input: unknown) => {
    requireRole('admin', 'medico')
    return surgeryRepo.createSurgery(input as SurgeryInput)
  })
  registerHandler(IPC.surgery.setStatus, (id: unknown, status: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return surgeryRepo.setSurgeryStatus(Number(id), String(status) as SurgeryStatus)
  })
  registerHandler(IPC.surgery.startSurgery, (id: unknown) => {
    requireRole('admin', 'medico')
    return surgeryRepo.startSurgery(Number(id))
  })
  registerHandler(IPC.surgery.finishSurgery, (id: unknown, notes: unknown) => {
    requireRole('admin', 'medico')
    return surgeryRepo.finishSurgery(Number(id), notes == null ? null : String(notes))
  })
  registerHandler(IPC.surgery.cancelSurgery, (id: unknown, reason: unknown) => {
    requireRole('admin', 'medico')
    return surgeryRepo.cancelSurgery(Number(id), String(reason))
  })
  registerHandler(IPC.surgery.listTimeOut, (surgeryId: unknown) => {
    requireUser()
    return surgeryRepo.listTimeOutItems(Number(surgeryId))
  })
  registerHandler(
    IPC.surgery.checkTimeOutItem,
    (itemId: unknown, checked: unknown, notes: unknown) => {
      requireRole('admin', 'medico', 'enfermagem')
      surgeryRepo.checkTimeOutItem(
        Number(itemId),
        Boolean(checked),
        notes == null ? null : String(notes)
      )
      return null
    }
  )
  registerHandler(IPC.surgery.listOpme, (surgeryId: unknown) => {
    requireUser()
    return surgeryRepo.listOpme(Number(surgeryId))
  })
  registerHandler(IPC.surgery.addOpme, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return surgeryRepo.addOpme(input as SurgeryOpmeInput)
  })
  registerHandler(IPC.surgery.removeOpme, (id: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    surgeryRepo.removeOpme(Number(id))
    return null
  })

  // ============================================================
  //   CCIH
  // ============================================================
  registerHandler(IPC.ccih.listIras, (options: unknown) => {
    requireUser()
    return ccihRepo.listIrasCases(
      (options as { fromDate?: string; toDate?: string; site?: InfectionSite }) ?? undefined
    )
  })
  registerHandler(IPC.ccih.getIras, (id: unknown) => {
    requireUser()
    return ccihRepo.getIrasCase(Number(id))
  })
  registerHandler(IPC.ccih.createIras, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return ccihRepo.createIrasCase(input as IrasCaseInput)
  })
  registerHandler(IPC.ccih.updateIras, (id: unknown, input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return ccihRepo.updateIrasCase(Number(id), input as IrasCaseInput)
  })
  registerHandler(IPC.ccih.deleteIras, (id: unknown) => {
    requireRole('admin')
    ccihRepo.deleteIrasCase(Number(id))
    return null
  })
  registerHandler(IPC.ccih.listIsolations, () => {
    requireUser()
    return ccihRepo.listIsolations()
  })
  registerHandler(IPC.ccih.listActiveIsolations, () => {
    requireUser()
    return ccihRepo.listActiveIsolations()
  })
  registerHandler(IPC.ccih.listIsolationsForAdmission, (admissionId: unknown) => {
    requireUser()
    return ccihRepo.listIsolationsForAdmission(Number(admissionId))
  })
  registerHandler(IPC.ccih.startIsolation, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return ccihRepo.startIsolation(input as IsolationInput)
  })
  registerHandler(IPC.ccih.endIsolation, (id: unknown, reason: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return ccihRepo.endIsolation(Number(id), String(reason))
  })
  registerHandler(IPC.ccih.indicators, (options: unknown) => {
    requireUser()
    return ccihRepo.getIndicators(
      (options as { fromDate?: string; toDate?: string }) ?? undefined
    )
  })

  // ============================================================
  //   AGENDA / CONSULTAS
  // ============================================================
  registerHandler(IPC.appointments.listForDay, (dateIso: unknown) => {
    requireUser()
    return apptsRepo.listAppointmentsForDay(String(dateIso))
  })
  registerHandler(IPC.appointments.listForPatient, (patientId: unknown) => {
    requireUser()
    return apptsRepo.listAppointmentsForPatient(Number(patientId))
  })
  registerHandler(IPC.appointments.get, (id: unknown) => {
    requireUser()
    return apptsRepo.getAppointment(Number(id))
  })
  registerHandler(IPC.appointments.create, (input: unknown) => {
    requireRole('admin', 'recepcao', 'medico', 'enfermagem')
    return apptsRepo.createAppointment(input as apptsRepo.AppointmentInput)
  })
  registerHandler(IPC.appointments.update, (id: unknown, input: unknown) => {
    requireRole('admin', 'recepcao', 'medico', 'enfermagem')
    return apptsRepo.updateAppointment(Number(id), input as apptsRepo.AppointmentInput)
  })
  registerHandler(IPC.appointments.updateStatus, (id: unknown, status: unknown) => {
    requireUser()
    return apptsRepo.updateStatus(Number(id), status as AppointmentStatus)
  })
  registerHandler(IPC.appointments.checkIn, (id: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem')
    return apptsRepo.checkIn(Number(id))
  })
  registerHandler(IPC.appointments.setTriage, (id: unknown, color: unknown, notes: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return apptsRepo.setTriage(
      Number(id),
      color as TriageColor,
      notes == null ? null : String(notes)
    )
  })
  registerHandler(IPC.appointments.cancel, (id: unknown, reason: unknown) => {
    requireRole('admin', 'recepcao', 'enfermagem')
    return apptsRepo.cancelAppointment(Number(id), reason == null ? null : String(reason))
  })
  registerHandler(IPC.appointments.queue, (dateIso: unknown) => {
    requireUser()
    return apptsRepo.getQueue(String(dateIso))
  })

  // ============================================================
  //   ATENDIMENTOS (SOAP)
  // ============================================================
  registerHandler(IPC.attendances.listForPatient, (patientId: unknown) => {
    requireUser()
    return attRepo.listForPatient(Number(patientId))
  })
  registerHandler(IPC.attendances.getByAppointment, (appointmentId: unknown) => {
    requireUser()
    return attRepo.getByAppointment(Number(appointmentId))
  })
  registerHandler(IPC.attendances.start, (appointmentId: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return attRepo.startAttendance(Number(appointmentId))
  })
  registerHandler(IPC.attendances.save, (id: unknown, input: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return attRepo.saveAttendance(Number(id), input as AttendanceSaveInput)
  })
  registerHandler(IPC.attendances.finish, (id: unknown, input: unknown) => {
    requireRole('admin', 'enfermagem', 'medico')
    return attRepo.finishAttendance(Number(id), input as AttendanceSaveInput)
  })

  // ============================================================
  //   PRESCRIÇÕES (ambulatorial)
  // ============================================================
  registerHandler(IPC.prescriptions.create, (input: unknown) => {
    requireRole('admin', 'medico')
    return prescriptionsRepo.createPrescription(input as PrescriptionInput)
  })
  registerHandler(IPC.prescriptions.listForPatient, (patientId: unknown) => {
    requireUser()
    return prescriptionsRepo.listForPatient(Number(patientId))
  })
  registerHandler(IPC.prescriptions.get, (id: unknown) => {
    requireUser()
    return prescriptionsRepo.getById(Number(id))
  })
  registerHandler(IPC.prescriptions.delete, (id: unknown) => {
    requireRole('admin', 'medico')
    prescriptionsRepo.deletePrescription(Number(id))
    return null
  })

  // ============================================================
  //   REQUISIÇÕES (exames / encaminhamentos)
  // ============================================================
  registerHandler(IPC.requisitions.create, (input: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return requisitionsRepo.createRequisition(input as RequisitionInput)
  })
  registerHandler(IPC.requisitions.listForPatient, (patientId: unknown) => {
    requireUser()
    return requisitionsRepo.listForPatient(Number(patientId))
  })
  registerHandler(IPC.requisitions.get, (id: unknown) => {
    requireUser()
    return requisitionsRepo.getById(Number(id))
  })
  registerHandler(IPC.requisitions.updateStatus, (id: unknown, status: unknown) => {
    requireRole('admin', 'medico', 'enfermagem')
    return requisitionsRepo.updateStatus(Number(id), status as RequisitionStatus)
  })
  registerHandler(IPC.requisitions.delete, (id: unknown) => {
    requireRole('admin', 'medico')
    requisitionsRepo.deleteRequisition(Number(id))
    return null
  })

  // ============================================================
  //   Appointments CSV export
  // ============================================================
  registerHandler(IPC.exports.appointmentsCsv, async (startIso: unknown, endIso: unknown) => {
    requireRole('admin', 'recepcao')
    const csv = exportsRepo.exportAppointmentsCsv(String(startIso), String(endIso))
    const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
    const chosen = await dialog.showSaveDialog({
      title: 'Exportar agenda (CSV)',
      defaultPath: `agenda-${String(startIso)}-a-${String(endIso)}-${ts}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (chosen.canceled || !chosen.filePath) {
      return { saved: false, path: null as string | null }
    }
    writeFileSync(chosen.filePath, csv, { encoding: 'utf8' })
    return { saved: true, path: chosen.filePath }
  })

  // ============================================================
  //   CHAMADAS de paciente (painel)
  // ============================================================
  registerHandler(IPC.calls.create, (raw: unknown) => {
    const user = requireUser()
    const input = raw as PatientCallInput
    const call = callsRepo.create(
      {
        patientId: input?.patientId ?? null,
        appointmentId: input?.appointmentId ?? null,
        patientName: String(input?.patientName ?? ''),
        room: String(input?.room ?? ''),
        message: input?.message ?? null
      },
      user.id,
      user.fullName
    )
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('patient-call:new', call)
    }
    return call
  })

  // O painel de chamada é uma rota pública; libera leitura quando vier
  // de uma janela de painel registrada (criada por panel.open).
  ipcMain.handle(IPC.calls.recent, async (event, limit: unknown) => {
    try {
      const isPanel = isPanelWindow(event.sender.id)
      if (!isPanel) requireUser()
      const n = typeof limit === 'number' && Number.isFinite(limit) ? limit : 10
      return { ok: true, data: callsRepo.recent(n) }
    } catch (err) {
      const error = err as Error & { code?: string }
      return {
        ok: false,
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.message || 'Erro interno do servidor.'
        }
      }
    }
  })

  registerHandler(IPC.calls.repeat, (callId: unknown) => {
    const user = requireUser()
    const id = Number(callId)
    if (!Number.isFinite(id) || id <= 0) {
      throw Object.assign(new Error('ID de chamada inválido.'), { code: 'VALIDATION_ERROR' })
    }
    const call = callsRepo.repeat(id, user.id, user.fullName)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('patient-call:new', call)
    }
    return call
  })

  // ============================================================
  //   TRIAGEM Manchester
  // ============================================================
  registerHandler(IPC.triages.save, (raw: unknown) => {
    const user = requireRole('admin', 'enfermagem', 'medico')
    const input = raw as TriageRecordInput
    if (!input || typeof input !== 'object') {
      throw Object.assign(new Error('Dados de triagem inválidos.'), { code: 'VALIDATION_ERROR' })
    }
    return triagesRepo.save(input, user.id, user.fullName)
  })
  registerHandler(IPC.triages.getByAppointment, (id: unknown) => {
    requireUser()
    const apptId = Number(id)
    if (!Number.isFinite(apptId) || apptId <= 0) {
      throw Object.assign(new Error('ID de atendimento inválido.'), { code: 'VALIDATION_ERROR' })
    }
    return triagesRepo.getByAppointment(apptId)
  })
  registerHandler(IPC.triages.listForPatient, (id: unknown, limit: unknown) => {
    requireUser()
    const patientId = Number(id)
    if (!Number.isFinite(patientId) || patientId <= 0) {
      throw Object.assign(new Error('ID de paciente inválido.'), { code: 'VALIDATION_ERROR' })
    }
    const n = typeof limit === 'number' && Number.isFinite(limit) ? limit : 20
    return triagesRepo.listForPatient(patientId, n)
  })

  // ============================================================
  //   PAINEL (abrir janela auxiliar)
  // ============================================================
  registerHandler(IPC.panel.open, (hash: unknown) => {
    requireUser()
    const raw = typeof hash === 'string' ? hash : '/painel'
    const safe = raw.startsWith('/') ? raw : `/${raw}`
    const existing = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes(`#${safe}`)
    )
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
      return { reused: true }
    }
    createSecondaryWindow(safe)
    return { reused: false }
  })

  // ============================================================
  //   BPA / Produção SUS
  // ============================================================
  registerHandler(IPC.bpa.listRecords, (options: unknown) => {
    requireUser()
    return bpaRepo.listRecords(
      (options as { year?: number; month?: number; procedureCode?: string }) ?? undefined
    )
  })
  registerHandler(IPC.bpa.createRecord, (input: unknown) => {
    requireRole('admin', 'medico')
    return bpaRepo.createRecord(input as BpaRecordInput)
  })
  registerHandler(IPC.bpa.deleteRecord, (id: unknown) => {
    requireRole('admin', 'medico')
    bpaRepo.deleteRecord(Number(id))
    return null
  })
  registerHandler(IPC.bpa.listConsolidations, () => {
    requireUser()
    return bpaRepo.listConsolidations()
  })
  registerHandler(IPC.bpa.consolidate, (year: unknown, month: unknown) => {
    requireRole('admin', 'medico')
    return bpaRepo.consolidateMonth(Number(year), Number(month))
  })
  registerHandler(IPC.bpa.getSummary, (year: unknown, month: unknown) => {
    requireUser()
    return bpaRepo.getSummaryForPeriod(Number(year), Number(month))
  })

  // ============================================================
  //   PONTO ELETRÔNICO
  // ============================================================
  registerHandler(IPC.timeclock.listEntries, (options: unknown) => {
    requireUser()
    return timeclockRepo.listEntries(
      (options as {
        professionalId?: number
        fromDate?: string
        toDate?: string
        limit?: number
      }) ?? undefined
    )
  })
  registerHandler(IPC.timeclock.createEntry, (input: unknown) => {
    requireUser()
    return timeclockRepo.createEntry(input as TimeclockEntryInput)
  })
  registerHandler(IPC.timeclock.deleteEntry, (id: unknown) => {
    requireUser()
    timeclockRepo.deleteEntry(Number(id))
    return null
  })
  registerHandler(
    IPC.timeclock.getDaySummaries,
    (professionalId: unknown, fromDate: unknown, toDate: unknown) => {
      requireUser()
      return timeclockRepo.getDaySummaries(
        Number(professionalId),
        String(fromDate),
        String(toDate)
      )
    }
  )

  // ---------- Print to PDF ----------
  // Captura o conteúdo da janela atual como PDF A4 e abre Salvar como.
  // O CSS @media print é aplicado automaticamente, ocultando a barra de ferramentas.
  ipcMain.handle(IPC.print.saveCurrentAsPdf, async (event, defaultName: unknown) => {
    try {
      requireUser()
      const sender = BrowserWindow.fromWebContents(event.sender)
      if (!sender) {
        throw Object.assign(new Error('Janela não localizada.'), { code: 'NO_WINDOW' })
      }
      const fallbackName = `documento-${new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')}.pdf`
      const safeDefault =
        typeof defaultName === 'string' && defaultName.trim().length > 0
          ? String(defaultName).replace(/[\\/:*?"<>|]/g, '-')
          : fallbackName
      const chosen = await dialog.showSaveDialog(sender, {
        title: 'Salvar como PDF',
        defaultPath: safeDefault.endsWith('.pdf') ? safeDefault : `${safeDefault}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (chosen.canceled || !chosen.filePath) {
        return { ok: true, data: { saved: false, path: null as string | null } }
      }
      const pdf = await event.sender.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      writeFileSync(chosen.filePath, pdf)
      logAudit({ action: 'export-pdf', entity: 'document', details: { path: chosen.filePath } })
      return { ok: true, data: { saved: true, path: chosen.filePath } }
    } catch (err) {
      const error = err as Error & { code?: string }
      return {
        ok: false,
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.message || 'Erro interno ao gerar PDF.'
        }
      }
    }
  })
}
