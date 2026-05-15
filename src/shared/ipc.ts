/**
 * Lista centralizada dos canais IPC usados entre renderer e main.
 * Usada para manter os nomes sincronizados.
 */

export const IPC = {
  auth: {
    login: 'auth:login',
    logout: 'auth:logout',
    changePassword: 'auth:change-password',
    whoami: 'auth:whoami'
  },
  users: {
    list: 'users:list',
    create: 'users:create',
    update: 'users:update',
    resetPassword: 'users:reset-password',
    setActive: 'users:set-active'
  },
  professionals: {
    list: 'professionals:list',
    get: 'professionals:get',
    create: 'professionals:create',
    update: 'professionals:update',
    setActive: 'professionals:set-active'
  },
  patients: {
    list: 'patients:list',
    get: 'patients:get',
    create: 'patients:create',
    update: 'patients:update',
    remove: 'patients:remove',
    search: 'patients:search',
    exportData: 'patients:export-data',
    anonymize: 'patients:anonymize'
  },
  reports: {
    dashboard: 'reports:dashboard',
    production: 'reports:production'
  },
  backup: {
    export: 'backup:export',
    list: 'backup:list',
    restore: 'backup:restore'
  },
  audit: {
    list: 'audit:list',
    purge: 'audit:purge'
  },
  settings: {
    get: 'settings:get',
    getPublic: 'settings:get-public',
    update: 'settings:update'
  },
  branding: {
    uploadLogo: 'branding:upload-logo',
    removeLogo: 'branding:remove-logo',
    getLogos: 'branding:get-logos'
  },
  exports: {
    patientsCsv: 'exports:patients-csv',
    appointmentsCsv: 'exports:appointments-csv'
  },
  appointments: {
    list: 'appointments:list',
    listForDay: 'appointments:list-for-day',
    listForPatient: 'appointments:list-for-patient',
    get: 'appointments:get',
    create: 'appointments:create',
    update: 'appointments:update',
    updateStatus: 'appointments:update-status',
    checkIn: 'appointments:check-in',
    setTriage: 'appointments:set-triage',
    cancel: 'appointments:cancel',
    queue: 'appointments:queue'
  },
  attendances: {
    listForPatient: 'attendances:list-for-patient',
    getByAppointment: 'attendances:get-by-appointment',
    start: 'attendances:start',
    save: 'attendances:save',
    finish: 'attendances:finish'
  },
  prescriptions: {
    create: 'prescriptions:create',
    listForPatient: 'prescriptions:list-for-patient',
    get: 'prescriptions:get',
    delete: 'prescriptions:delete'
  },
  requisitions: {
    create: 'requisitions:create',
    listForPatient: 'requisitions:list-for-patient',
    get: 'requisitions:get',
    updateStatus: 'requisitions:update-status',
    delete: 'requisitions:delete'
  },
  calls: {
    create: 'calls:create',
    recent: 'calls:recent',
    repeat: 'calls:repeat'
  },
  panel: {
    open: 'panel:open'
  },
  triages: {
    save: 'triages:save',
    getByAppointment: 'triages:get-by-appointment',
    listForPatient: 'triages:list-for-patient'
  },
  bpa: {
    listRecords: 'bpa:list-records',
    createRecord: 'bpa:create-record',
    deleteRecord: 'bpa:delete-record',
    listConsolidations: 'bpa:list-consolidations',
    consolidate: 'bpa:consolidate',
    getSummary: 'bpa:get-summary'
  },
  timeclock: {
    listEntries: 'timeclock:list-entries',
    createEntry: 'timeclock:create-entry',
    deleteEntry: 'timeclock:delete-entry',
    getDaySummaries: 'timeclock:get-day-summaries'
  },
  print: {
    saveCurrentAsPdf: 'print:save-current-as-pdf'
  },
  pharmacy: {
    listMedications: 'pharmacy:list-medications',
    listStock: 'pharmacy:list-stock',
    getMedication: 'pharmacy:get-medication',
    createMedication: 'pharmacy:create-medication',
    updateMedication: 'pharmacy:update-medication',
    setMedicationActive: 'pharmacy:set-medication-active',
    listLots: 'pharmacy:list-lots',
    addLot: 'pharmacy:add-lot',
    addMovement: 'pharmacy:add-movement',
    listMovements: 'pharmacy:list-movements',
    dispense: 'pharmacy:dispense',
    listDispensations: 'pharmacy:list-dispensations',
    getDispensation: 'pharmacy:get-dispensation'
  },
  wards: {
    list: 'wards:list',
    get: 'wards:get',
    create: 'wards:create',
    update: 'wards:update',
    setActive: 'wards:set-active',
    delete: 'wards:delete'
  },
  beds: {
    list: 'beds:list',
    listWithRefs: 'beds:list-with-refs',
    listForWard: 'beds:list-for-ward',
    listFree: 'beds:list-free',
    get: 'beds:get',
    create: 'beds:create',
    update: 'beds:update',
    setActive: 'beds:set-active',
    setStatus: 'beds:set-status',
    delete: 'beds:delete',
    occupancyByWard: 'beds:occupancy-by-ward'
  },
  admissions: {
    listActive: 'admissions:list-active',
    listForPatient: 'admissions:list-for-patient',
    listRecentDischarges: 'admissions:list-recent-discharges',
    get: 'admissions:get',
    admit: 'admissions:admit',
    transfer: 'admissions:transfer',
    discharge: 'admissions:discharge',
    listMovements: 'admissions:list-movements'
  },
  evolutions: {
    listForAdmission: 'evolutions:list-for-admission',
    get: 'evolutions:get',
    create: 'evolutions:create',
    update: 'evolutions:update',
    delete: 'evolutions:delete'
  },
  vitalSigns: {
    listForAdmission: 'vital-signs:list-for-admission',
    latestForAdmission: 'vital-signs:latest-for-admission',
    create: 'vital-signs:create',
    delete: 'vital-signs:delete'
  },
  hospitalPrescriptions: {
    listForAdmission: 'hospital-prescriptions:list-for-admission',
    get: 'hospital-prescriptions:get',
    create: 'hospital-prescriptions:create',
    setStatus: 'hospital-prescriptions:set-status',
    setItemStatus: 'hospital-prescriptions:set-item-status'
  },
  mar: {
    listForAdmission: 'mar:list-for-admission',
    listForItem: 'mar:list-for-item',
    check: 'mar:check',
    revert: 'mar:revert'
  },
  fluidBalance: {
    listForAdmission: 'fluid-balance:list-for-admission',
    getSummary: 'fluid-balance:get-summary',
    create: 'fluid-balance:create',
    delete: 'fluid-balance:delete'
  },
  er: {
    listVisits: 'er:list-visits',
    getVisit: 'er:get-visit',
    createVisit: 'er:create-visit',
    setStatus: 'er:set-status',
    closeVisit: 'er:close-visit',
    listTriages: 'er:list-triages',
    createTriage: 'er:create-triage'
  },
  surgery: {
    listRooms: 'surgery:list-rooms',
    createRoom: 'surgery:create-room',
    updateRoom: 'surgery:update-room',
    setRoomActive: 'surgery:set-room-active',
    listSurgeries: 'surgery:list-surgeries',
    getSurgery: 'surgery:get-surgery',
    createSurgery: 'surgery:create-surgery',
    setStatus: 'surgery:set-status',
    startSurgery: 'surgery:start',
    finishSurgery: 'surgery:finish',
    cancelSurgery: 'surgery:cancel',
    listTimeOut: 'surgery:list-time-out',
    checkTimeOutItem: 'surgery:check-time-out-item',
    listOpme: 'surgery:list-opme',
    addOpme: 'surgery:add-opme',
    removeOpme: 'surgery:remove-opme'
  },
  ccih: {
    listIras: 'ccih:list-iras',
    getIras: 'ccih:get-iras',
    createIras: 'ccih:create-iras',
    updateIras: 'ccih:update-iras',
    deleteIras: 'ccih:delete-iras',
    listIsolations: 'ccih:list-isolations',
    listActiveIsolations: 'ccih:list-active-isolations',
    listIsolationsForAdmission: 'ccih:list-isolations-for-admission',
    startIsolation: 'ccih:start-isolation',
    endIsolation: 'ccih:end-isolation',
    indicators: 'ccih:indicators'
  },
  demo: {
    seedHospital: 'demo:seed-hospital'
  },
  meta: {
    appInfo: 'meta:app-info'
  },
  updater: {
    check: 'updater:check',
    quitAndInstall: 'updater:quit-and-install',
    state: 'updater:state'
  }
} as const

export type UpdaterStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available'; version: string }
  | { kind: 'downloading'; percent: number; transferred: number; total: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }
