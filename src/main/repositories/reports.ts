import { getDb } from '../db'
import type { DashboardStats, ProductionReportRow } from '@shared/types'

export function getDashboardStats(_todayIso: string): DashboardStats {
  const db = getDb()
  const patients = db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }
  const profs = db.prepare('SELECT COUNT(*) as c FROM professionals WHERE active = 1').get() as {
    c: number
  }
  const activeAdmissions = db
    .prepare<[], { c: number }>(`SELECT COUNT(*) as c FROM admissions WHERE status = 'ativa'`)
    .get() as { c: number }
  const beds = db
    .prepare<
      [],
      { total: number; free: number }
    >(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'livre' THEN 1 ELSE 0 END) as free FROM beds WHERE active = 1`)
    .get() as { total: number; free: number }

  return {
    patientsCount: patients.c,
    professionalsActive: profs.c,
    activeAdmissions: activeAdmissions.c,
    freeBeds: beds.free ?? 0,
    totalBeds: beds.total ?? 0
  }
}

export function getProductionReport(startIso: string, endIso: string): ProductionReportRow[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id AS professionalId,
              p.full_name AS professionalName,
              p.specialty AS specialty,
              SUM(CASE WHEN a.admitted_at >= ? AND a.admitted_at < ? THEN 1 ELSE 0 END) AS totalAdmissions,
              SUM(CASE WHEN a.discharge_at IS NOT NULL AND a.discharge_at >= ? AND a.discharge_at < ? THEN 1 ELSE 0 END) AS totalDischarges
         FROM professionals p
         LEFT JOIN admissions a
           ON a.attending_professional_id = p.id
        GROUP BY p.id
        ORDER BY p.full_name`
    )
    .all(startIso, endIso, startIso, endIso) as ProductionReportRow[]
  return rows.map((r) => ({
    ...r,
    totalAdmissions: r.totalAdmissions ?? 0,
    totalDischarges: r.totalDischarges ?? 0
  }))
}
