import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc'
import type { UpdaterStatus } from '@shared/ipc'
import type {
  AnonymizeResult,
  AppSettings,
  BrandingLogos,
  BrandingLogoSlot,
  ThemeMode,
  AuditLogEntry,
  AuthUser,
  BackupInfo,
  DashboardStats,
  IpcResult,
  DemoSeedHospitalResult,
  Patient,
  PatientInput,
  Professional,
  ProductionReportRow,
  User,
  UserRole,
  Medication,
  MedicationInput,
  MedicationLot,
  MedicationLotInput,
  MedicationStock,
  StockMovement,
  StockMovementInput,
  Dispensation,
  DispensationInput,
  Ward,
  WardInput,
  Bed,
  BedInput,
  BedStatus,
  BedWithRefs,
  WardOccupancySummary,
  AdmissionInput,
  AdmissionWithRefs,
  AdmissionEvolutionInput,
  AdmissionEvolutionWithRefs,
  AdmissionVitalSignsInput,
  AdmissionVitalSignsWithRefs,
  AdmissionPrescriptionInput,
  AdmissionPrescriptionWithItems,
  MarCheckInput,
  MedicationAdministrationWithRefs,
  PrescriptionStatus,
  BedMovement,
  TransferAdmissionInput,
  DischargeAdmissionInput,
  FluidBalanceEntryWithRefs,
  FluidBalanceInput,
  FluidBalanceSummary,
  ErVisitWithRefs,
  ErVisitInput,
  ErVisitStatus,
  ErTriageWithRefs,
  ErTriageInput,
  ErCloseInput,
  SurgicalRoom,
  SurgicalRoomInput,
  SurgeryWithRefs,
  SurgeryInput,
  SurgeryStatus,
  SurgeryTimeOutItem,
  SurgeryOpme,
  SurgeryOpmeInput,
  IrasCaseWithRefs,
  IrasCaseInput,
  InfectionSite,
  Isolation,
  IsolationInput,
  IrasIndicators
} from '@shared/types'

interface PublicUnitSettings {
  unitName: string
  unitCnes: string
  unitAddress: string
  unitPhone: string
  unitMunicipality: string
  brandingPrefeituraName: string
  brandingSecretariaName: string
  themePrimary: string
  themeMode: ThemeMode
  unitType: 'ubs' | 'hospital' | 'mista'
}

interface UploadLogoInput {
  slot: BrandingLogoSlot
  filename: string
  mimeType: string
  bytes: ArrayBuffer
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) {
    const err = new Error(result.error.message) as Error & { code?: string }
    err.code = result.error.code
    throw err
  }
  return result.data
}

export interface ProfessionalInput {
  fullName: string
  cpf: string | null
  councilType: string | null
  councilNumber: string | null
  specialty: string | null
  active?: boolean
}

const api = {
  meta: {
    appInfo: (): Promise<{ version: string; name: string; dbPath: string }> =>
      invoke(IPC.meta.appInfo)
  },
  auth: {
    login: (username: string, password: string): Promise<AuthUser> =>
      invoke(IPC.auth.login, username, password),
    logout: (): Promise<null> => invoke(IPC.auth.logout),
    whoami: (): Promise<AuthUser | null> => invoke(IPC.auth.whoami),
    changePassword: (oldPassword: string, newPassword: string): Promise<AuthUser> =>
      invoke(IPC.auth.changePassword, oldPassword, newPassword)
  },
  users: {
    list: (): Promise<User[]> => invoke(IPC.users.list),
    create: (input: {
      username: string
      password: string
      fullName: string
      role: UserRole
    }): Promise<User> => invoke(IPC.users.create, input),
    update: (id: number, input: { fullName?: string; role?: UserRole }): Promise<User> =>
      invoke(IPC.users.update, id, input),
    resetPassword: (id: number, newPassword: string): Promise<null> =>
      invoke(IPC.users.resetPassword, id, newPassword),
    setActive: (id: number, active: boolean): Promise<null> =>
      invoke(IPC.users.setActive, id, active)
  },
  professionals: {
    list: (activeOnly = false): Promise<Professional[]> =>
      invoke(IPC.professionals.list, activeOnly),
    get: (id: number): Promise<Professional | null> => invoke(IPC.professionals.get, id),
    create: (input: ProfessionalInput): Promise<Professional> =>
      invoke(IPC.professionals.create, input),
    update: (id: number, input: ProfessionalInput): Promise<Professional> =>
      invoke(IPC.professionals.update, id, input),
    setActive: (id: number, active: boolean): Promise<null> =>
      invoke(IPC.professionals.setActive, id, active)
  },
  patients: {
    list: (): Promise<Patient[]> => invoke(IPC.patients.list),
    search: (query: string): Promise<Patient[]> => invoke(IPC.patients.search, query),
    get: (id: number): Promise<Patient | null> => invoke(IPC.patients.get, id),
    create: (input: PatientInput): Promise<Patient> => invoke(IPC.patients.create, input),
    update: (id: number, input: PatientInput): Promise<Patient> =>
      invoke(IPC.patients.update, id, input),
    remove: (id: number): Promise<null> => invoke(IPC.patients.remove, id),
    exportData: (id: number): Promise<{ saved: boolean; path: string | null }> =>
      invoke(IPC.patients.exportData, id),
    anonymize: (id: number): Promise<AnonymizeResult> => invoke(IPC.patients.anonymize, id)
  },
  reports: {
    dashboard: (dateIso: string): Promise<DashboardStats> => invoke(IPC.reports.dashboard, dateIso),
    production: (startIso: string, endIso: string): Promise<ProductionReportRow[]> =>
      invoke(IPC.reports.production, startIso, endIso)
  },
  backup: {
    export: (): Promise<BackupInfo | null> => invoke(IPC.backup.export),
    list: (): Promise<BackupInfo[]> => invoke(IPC.backup.list),
    restore: (): Promise<{
      restored: boolean
      backupOfCurrent: string | null
      restoredFrom: string | null
    }> => invoke(IPC.backup.restore)
  },
  audit: {
    list: (limit?: number): Promise<AuditLogEntry[]> => invoke(IPC.audit.list, limit ?? 200),
    purge: (): Promise<{ removed: number; retentionDays: number }> => invoke(IPC.audit.purge)
  },
  settings: {
    get: (): Promise<AppSettings> => invoke(IPC.settings.get),
    getPublic: (): Promise<PublicUnitSettings> => invoke(IPC.settings.getPublic),
    update: (input: Partial<AppSettings>): Promise<AppSettings> =>
      invoke(IPC.settings.update, input)
  },
  branding: {
    uploadLogo: (input: UploadLogoInput): Promise<BrandingLogos> =>
      invoke(IPC.branding.uploadLogo, input),
    removeLogo: (slot: BrandingLogoSlot): Promise<BrandingLogos> =>
      invoke(IPC.branding.removeLogo, slot),
    getLogos: (): Promise<BrandingLogos> => invoke(IPC.branding.getLogos)
  },
  exports: {
    patientsCsv: (): Promise<{ saved: boolean; path: string | null }> =>
      invoke(IPC.exports.patientsCsv)
  },
  print: {
    saveCurrentAsPdf: (defaultName?: string): Promise<{ saved: boolean; path: string | null }> =>
      invoke(IPC.print.saveCurrentAsPdf, defaultName ?? null)
  },
  demo: {
    seedHospital: (): Promise<DemoSeedHospitalResult> => invoke(IPC.demo.seedHospital)
  },
  pharmacy: {
    listMedications: (includeInactive = false): Promise<Medication[]> =>
      invoke(IPC.pharmacy.listMedications, includeInactive),
    listStock: (): Promise<MedicationStock[]> => invoke(IPC.pharmacy.listStock),
    getMedication: (id: number): Promise<Medication | null> =>
      invoke(IPC.pharmacy.getMedication, id),
    createMedication: (input: MedicationInput): Promise<Medication> =>
      invoke(IPC.pharmacy.createMedication, input),
    updateMedication: (id: number, input: MedicationInput): Promise<Medication> =>
      invoke(IPC.pharmacy.updateMedication, id, input),
    setMedicationActive: (id: number, active: boolean): Promise<Medication> =>
      invoke(IPC.pharmacy.setMedicationActive, id, active),
    listLots: (medicationId: number, includeEmpty = true): Promise<MedicationLot[]> =>
      invoke(IPC.pharmacy.listLots, medicationId, includeEmpty),
    addLot: (input: MedicationLotInput): Promise<MedicationLot> =>
      invoke(IPC.pharmacy.addLot, input),
    addMovement: (input: StockMovementInput): Promise<StockMovement> =>
      invoke(IPC.pharmacy.addMovement, input),
    listMovements: (
      filter: {
        medicationId?: number
        limit?: number
      } = {}
    ): Promise<StockMovement[]> => invoke(IPC.pharmacy.listMovements, filter),
    dispense: (input: DispensationInput): Promise<Dispensation> =>
      invoke(IPC.pharmacy.dispense, input),
    listDispensations: (
      filter: {
        patientId?: number
        limit?: number
      } = {}
    ): Promise<Dispensation[]> => invoke(IPC.pharmacy.listDispensations, filter),
    getDispensation: (id: number): Promise<Dispensation | null> =>
      invoke(IPC.pharmacy.getDispensation, id)
  },
  wards: {
    list: (activeOnly = false): Promise<Ward[]> => invoke(IPC.wards.list, activeOnly),
    get: (id: number): Promise<Ward | null> => invoke(IPC.wards.get, id),
    create: (input: WardInput): Promise<Ward> => invoke(IPC.wards.create, input),
    update: (id: number, input: WardInput): Promise<Ward> => invoke(IPC.wards.update, id, input),
    setActive: (id: number, active: boolean): Promise<null> =>
      invoke(IPC.wards.setActive, id, active),
    delete: (id: number): Promise<null> => invoke(IPC.wards.delete, id)
  },
  beds: {
    list: (activeOnly = false): Promise<Bed[]> => invoke(IPC.beds.list, activeOnly),
    listWithRefs: (): Promise<BedWithRefs[]> => invoke(IPC.beds.listWithRefs),
    listForWard: (wardId: number): Promise<BedWithRefs[]> => invoke(IPC.beds.listForWard, wardId),
    listFree: (): Promise<BedWithRefs[]> => invoke(IPC.beds.listFree),
    get: (id: number): Promise<BedWithRefs | null> => invoke(IPC.beds.get, id),
    create: (input: BedInput): Promise<Bed> => invoke(IPC.beds.create, input),
    update: (id: number, input: BedInput): Promise<Bed> => invoke(IPC.beds.update, id, input),
    setActive: (id: number, active: boolean): Promise<null> =>
      invoke(IPC.beds.setActive, id, active),
    setStatus: (id: number, status: BedStatus, reason?: string | null): Promise<Bed> =>
      invoke(IPC.beds.setStatus, id, status, reason ?? null),
    delete: (id: number): Promise<null> => invoke(IPC.beds.delete, id),
    occupancyByWard: (): Promise<WardOccupancySummary[]> => invoke(IPC.beds.occupancyByWard)
  },
  admissions: {
    listActive: (): Promise<AdmissionWithRefs[]> => invoke(IPC.admissions.listActive),
    listForPatient: (patientId: number): Promise<AdmissionWithRefs[]> =>
      invoke(IPC.admissions.listForPatient, patientId),
    listRecentDischarges: (limit?: number): Promise<AdmissionWithRefs[]> =>
      invoke(IPC.admissions.listRecentDischarges, limit ?? 50),
    get: (id: number): Promise<AdmissionWithRefs | null> => invoke(IPC.admissions.get, id),
    admit: (input: AdmissionInput): Promise<AdmissionWithRefs> =>
      invoke(IPC.admissions.admit, input),
    transfer: (input: TransferAdmissionInput): Promise<AdmissionWithRefs> =>
      invoke(IPC.admissions.transfer, input),
    discharge: (input: DischargeAdmissionInput): Promise<AdmissionWithRefs> =>
      invoke(IPC.admissions.discharge, input),
    listMovements: (admissionId: number): Promise<BedMovement[]> =>
      invoke(IPC.admissions.listMovements, admissionId)
  },
  evolutions: {
    listForAdmission: (admissionId: number): Promise<AdmissionEvolutionWithRefs[]> =>
      invoke(IPC.evolutions.listForAdmission, admissionId),
    get: (id: number): Promise<AdmissionEvolutionWithRefs | null> => invoke(IPC.evolutions.get, id),
    create: (input: AdmissionEvolutionInput): Promise<AdmissionEvolutionWithRefs> =>
      invoke(IPC.evolutions.create, input),
    update: (id: number, input: AdmissionEvolutionInput): Promise<AdmissionEvolutionWithRefs> =>
      invoke(IPC.evolutions.update, { id, input }),
    delete: (id: number): Promise<null> => invoke(IPC.evolutions.delete, id)
  },
  vitalSigns: {
    listForAdmission: (
      admissionId: number,
      limit?: number
    ): Promise<AdmissionVitalSignsWithRefs[]> =>
      invoke(IPC.vitalSigns.listForAdmission, { admissionId, limit }),
    latestForAdmission: (admissionId: number): Promise<AdmissionVitalSignsWithRefs | null> =>
      invoke(IPC.vitalSigns.latestForAdmission, admissionId),
    create: (input: AdmissionVitalSignsInput): Promise<AdmissionVitalSignsWithRefs> =>
      invoke(IPC.vitalSigns.create, input),
    delete: (id: number): Promise<null> => invoke(IPC.vitalSigns.delete, id)
  },
  hospitalPrescriptions: {
    listForAdmission: (admissionId: number): Promise<AdmissionPrescriptionWithItems[]> =>
      invoke(IPC.hospitalPrescriptions.listForAdmission, admissionId),
    get: (id: number): Promise<AdmissionPrescriptionWithItems | null> =>
      invoke(IPC.hospitalPrescriptions.get, id),
    create: (input: AdmissionPrescriptionInput): Promise<AdmissionPrescriptionWithItems> =>
      invoke(IPC.hospitalPrescriptions.create, input),
    setStatus: (id: number, status: PrescriptionStatus): Promise<AdmissionPrescriptionWithItems> =>
      invoke(IPC.hospitalPrescriptions.setStatus, { id, status }),
    setItemStatus: (
      itemId: number,
      status: PrescriptionStatus
    ): Promise<AdmissionPrescriptionWithItems> =>
      invoke(IPC.hospitalPrescriptions.setItemStatus, { itemId, status })
  },
  mar: {
    listForAdmission: (admissionId: number): Promise<MedicationAdministrationWithRefs[]> =>
      invoke(IPC.mar.listForAdmission, admissionId),
    listForItem: (itemId: number): Promise<MedicationAdministrationWithRefs[]> =>
      invoke(IPC.mar.listForItem, itemId),
    check: (id: number, input: MarCheckInput): Promise<MedicationAdministrationWithRefs> =>
      invoke(IPC.mar.check, { id, input }),
    revert: (id: number): Promise<MedicationAdministrationWithRefs> => invoke(IPC.mar.revert, id)
  },
  fluidBalance: {
    listForAdmission: (admissionId: number): Promise<FluidBalanceEntryWithRefs[]> =>
      invoke(IPC.fluidBalance.listForAdmission, admissionId),
    getSummary: (admissionId: number): Promise<FluidBalanceSummary> =>
      invoke(IPC.fluidBalance.getSummary, admissionId),
    create: (input: FluidBalanceInput): Promise<FluidBalanceEntryWithRefs> =>
      invoke(IPC.fluidBalance.create, input),
    delete: (id: number): Promise<null> => invoke(IPC.fluidBalance.delete, id)
  },
  er: {
    listVisits: (includeClosed?: boolean): Promise<ErVisitWithRefs[]> =>
      invoke(IPC.er.listVisits, includeClosed ?? false),
    getVisit: (id: number): Promise<ErVisitWithRefs | null> => invoke(IPC.er.getVisit, id),
    createVisit: (input: ErVisitInput): Promise<ErVisitWithRefs> =>
      invoke(IPC.er.createVisit, input),
    setStatus: (
      id: number,
      status: ErVisitStatus,
      professionalId?: number | null
    ): Promise<ErVisitWithRefs> => invoke(IPC.er.setStatus, id, status, professionalId ?? null),
    closeVisit: (input: ErCloseInput): Promise<ErVisitWithRefs> =>
      invoke(IPC.er.closeVisit, input),
    listTriages: (visitId: number): Promise<ErTriageWithRefs[]> =>
      invoke(IPC.er.listTriages, visitId),
    createTriage: (input: ErTriageInput): Promise<ErTriageWithRefs> =>
      invoke(IPC.er.createTriage, input)
  },
  surgery: {
    listRooms: (activeOnly?: boolean): Promise<SurgicalRoom[]> =>
      invoke(IPC.surgery.listRooms, activeOnly ?? false),
    createRoom: (input: SurgicalRoomInput): Promise<SurgicalRoom> =>
      invoke(IPC.surgery.createRoom, input),
    updateRoom: (id: number, input: SurgicalRoomInput): Promise<SurgicalRoom> =>
      invoke(IPC.surgery.updateRoom, id, input),
    setRoomActive: (id: number, active: boolean): Promise<SurgicalRoom> =>
      invoke(IPC.surgery.setRoomActive, id, active),
    listSurgeries: (options?: {
      status?: SurgeryStatus
      fromDate?: string
      toDate?: string
    }): Promise<SurgeryWithRefs[]> => invoke(IPC.surgery.listSurgeries, options),
    getSurgery: (id: number): Promise<SurgeryWithRefs | null> =>
      invoke(IPC.surgery.getSurgery, id),
    createSurgery: (input: SurgeryInput): Promise<SurgeryWithRefs> =>
      invoke(IPC.surgery.createSurgery, input),
    setStatus: (id: number, status: SurgeryStatus): Promise<SurgeryWithRefs> =>
      invoke(IPC.surgery.setStatus, id, status),
    startSurgery: (id: number): Promise<SurgeryWithRefs> =>
      invoke(IPC.surgery.startSurgery, id),
    finishSurgery: (id: number, notes?: string | null): Promise<SurgeryWithRefs> =>
      invoke(IPC.surgery.finishSurgery, id, notes ?? null),
    cancelSurgery: (id: number, reason: string): Promise<SurgeryWithRefs> =>
      invoke(IPC.surgery.cancelSurgery, id, reason),
    listTimeOut: (surgeryId: number): Promise<SurgeryTimeOutItem[]> =>
      invoke(IPC.surgery.listTimeOut, surgeryId),
    checkTimeOutItem: (itemId: number, checked: boolean, notes?: string | null): Promise<null> =>
      invoke(IPC.surgery.checkTimeOutItem, itemId, checked, notes ?? null),
    listOpme: (surgeryId: number): Promise<SurgeryOpme[]> =>
      invoke(IPC.surgery.listOpme, surgeryId),
    addOpme: (input: SurgeryOpmeInput): Promise<SurgeryOpme> => invoke(IPC.surgery.addOpme, input),
    removeOpme: (id: number): Promise<null> => invoke(IPC.surgery.removeOpme, id)
  },
  ccih: {
    listIras: (options?: {
      fromDate?: string
      toDate?: string
      site?: InfectionSite
    }): Promise<IrasCaseWithRefs[]> => invoke(IPC.ccih.listIras, options),
    getIras: (id: number): Promise<IrasCaseWithRefs | null> => invoke(IPC.ccih.getIras, id),
    createIras: (input: IrasCaseInput): Promise<IrasCaseWithRefs> =>
      invoke(IPC.ccih.createIras, input),
    updateIras: (id: number, input: IrasCaseInput): Promise<IrasCaseWithRefs> =>
      invoke(IPC.ccih.updateIras, id, input),
    deleteIras: (id: number): Promise<null> => invoke(IPC.ccih.deleteIras, id),
    listIsolations: (): Promise<Isolation[]> => invoke(IPC.ccih.listIsolations),
    listActiveIsolations: (): Promise<Isolation[]> => invoke(IPC.ccih.listActiveIsolations),
    listIsolationsForAdmission: (admissionId: number): Promise<Isolation[]> =>
      invoke(IPC.ccih.listIsolationsForAdmission, admissionId),
    startIsolation: (input: IsolationInput): Promise<Isolation> =>
      invoke(IPC.ccih.startIsolation, input),
    endIsolation: (id: number, reason: string): Promise<Isolation> =>
      invoke(IPC.ccih.endIsolation, id, reason),
    indicators: (options?: { fromDate?: string; toDate?: string }): Promise<IrasIndicators> =>
      invoke(IPC.ccih.indicators, options)
  },
  updater: {
    check: (): Promise<UpdaterStatus> => invoke(IPC.updater.check),
    state: (): Promise<UpdaterStatus> => invoke(IPC.updater.state),
    quitAndInstall: (): Promise<null> => invoke(IPC.updater.quitAndInstall),
    onState: (handler: (state: UpdaterStatus) => void): (() => void) => {
      const listener = (_event: unknown, state: UpdaterStatus): void => handler(state)
      ipcRenderer.on(IPC.updater.state, listener)
      return () => ipcRenderer.removeListener(IPC.updater.state, listener)
    }
  }
}

export type GestaoUbsApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  console.error('contextIsolation está desativado — a API não foi exposta.')
}
