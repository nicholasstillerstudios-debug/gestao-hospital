import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ageFromBirthDate, formatCpf, formatDateBr, formatDateTimeBr } from '@renderer/lib/utils'
import type {
  AppointmentWithRefs,
  Attendance,
  Patient,
  PrescriptionWithRefs,
  RequisitionWithRefs
} from '@shared/types'
import { REQUISITION_TYPE_LABELS } from '@shared/types'

export interface UnitInfo {
  unitName: string
  unitCnes: string
  unitAddress: string
  unitPhone: string
  unitMunicipality: string
  brandingPrefeituraName: string
  brandingSecretariaName: string
}

export interface LetterheadLayout {
  logoHeight: number
  align: 'left' | 'center'
  showFooter: boolean
}

const DEFAULT_LAYOUT: LetterheadLayout = {
  logoHeight: 56,
  align: 'center',
  showFooter: true
}

export interface BrandingLogosState {
  prefeitura: string | null
  secretaria: string | null
  hospital: string | null
}

const EMPTY_UNIT: UnitInfo = {
  unitName: '',
  unitCnes: '',
  unitAddress: '',
  unitPhone: '',
  unitMunicipality: '',
  brandingPrefeituraName: '',
  brandingSecretariaName: ''
}

const EMPTY_LOGOS: BrandingLogosState = { prefeitura: null, secretaria: null, hospital: null }

interface PrintData {
  appointment: AppointmentWithRefs
  attendance: Attendance | null
}

export function useUnitInfo(): {
  unit: UnitInfo
  logos: BrandingLogosState
  layout: LetterheadLayout
} {
  const [unit, setUnit] = useState<UnitInfo>(EMPTY_UNIT)
  const [logos, setLogos] = useState<BrandingLogosState>(EMPTY_LOGOS)
  const [layout, setLayout] = useState<LetterheadLayout>(DEFAULT_LAYOUT)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [u, l] = await Promise.all([
          window.api.settings.getPublic(),
          window.api.branding.getLogos()
        ])
        if (cancelled) return
        setUnit({
          unitName: u.unitName,
          unitCnes: u.unitCnes,
          unitAddress: u.unitAddress,
          unitPhone: u.unitPhone,
          unitMunicipality: u.unitMunicipality,
          brandingPrefeituraName: u.brandingPrefeituraName,
          brandingSecretariaName: u.brandingSecretariaName
        })
        setLogos(l)
        setLayout({
          logoHeight: u.letterheadLogoHeight,
          align: u.letterheadAlign,
          showFooter: u.letterheadShowFooter
        })
      } catch {
        // mantém defaults — header cai para o fallback genérico
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return { unit, logos, layout }
}

async function saveAsPdf(suggestedName: string): Promise<void> {
  try {
    await window.api.print.saveCurrentAsPdf(suggestedName)
  } catch (err) {
    alert((err as Error).message || 'Erro ao gerar PDF.')
  }
}

/**
 * Layout de impressão da ficha de atendimento.
 */
export function PrintAttendancePage(): React.JSX.Element {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<PrintData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { unit, logos } = useUnitInfo()
  const [params] = useSearchParams()
  const autoPrint = params.get('autoprint') !== '0'

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const appt = await window.api.appointments.get(Number(appointmentId))
        if (!appt) throw new Error('Agendamento não encontrado.')
        const att = await window.api.attendances.getByAppointment(appt.id)
        if (cancelled) return
        setData({ appointment: appt, attendance: att })
        if (autoPrint) {
          setTimeout(() => {
            window.print()
          }, 200)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    void load()
    const onAfterPrint = (): void => {
      if (autoPrint) navigate(-1)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [appointmentId, navigate, autoPrint])

  if (error) {
    return <PrintError message={error} onClose={() => navigate(-1)} />
  }

  if (!data) return <div className="p-8 text-sm text-slate-500">Preparando impressão…</div>

  const { appointment, attendance } = data
  const patient = appointment.patient
  const age = ageFromBirthDate(patient.birthDate)
  const fileName = `ficha-${patient.fullName}-${appointment.scheduledAt.slice(0, 10)}`

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => saveAsPdf(fileName)}
        onClose={() => navigate(-1)}
      />
      <article className="print-page">
        <PrintHeader title="Ficha de atendimento" unit={unit} logos={logos} />
        <section className="print-section">
          <h2>Identificação do paciente</h2>
          <Grid>
            <Cell label="Nome">{patient.fullName}</Cell>
            <Cell label="Data de nascimento">
              {formatDateBr(patient.birthDate)}
              {age != null ? ` (${age} anos)` : ''}
            </Cell>
            <Cell label="CPF">{formatCpf(patient.cpf) || '—'}</Cell>
            <Cell label="CNS">{patient.cns ?? '—'}</Cell>
            <Cell label="Sexo">
              {patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : 'Outro'}
            </Cell>
          </Grid>
        </section>

        <section className="print-section">
          <h2>Atendimento</h2>
          <Grid>
            <Cell label="Data">{formatDateTimeBr(appointment.scheduledAt)}</Cell>
            <Cell label="Profissional">
              {appointment.professional.fullName}
              {appointment.professional.specialty ? ` — ${appointment.professional.specialty}` : ''}
            </Cell>
            <Cell label="Motivo">{appointment.reason ?? '—'}</Cell>
            {appointment.triageColor ? (
              <Cell label="Triagem">{appointment.triageColor.toUpperCase()}</Cell>
            ) : null}
          </Grid>
        </section>

        {attendance ? (
          <section className="print-section">
            <h2>Registro clínico (SOAP)</h2>
            <SoapBlock label="S — Subjetivo" value={attendance.subjective} />
            <SoapBlock label="O — Objetivo" value={attendance.objective} />
            <SoapBlock label="A — Avaliação / Hipótese" value={attendance.assessment} />
            <SoapBlock label="P — Plano / Conduta" value={attendance.plan} />
            {attendance.prescription ? (
              <SoapBlock label="Prescrição" value={attendance.prescription} />
            ) : null}
          </section>
        ) : (
          <section className="print-section">
            <p className="muted">Atendimento ainda não realizado.</p>
          </section>
        )}

        <PrintSignature
          professional={appointment.professional.fullName}
          municipality={unit.unitMunicipality}
        />
      </article>
    </div>
  )
}

/**
 * Layout de impressão do atestado médico.
 */
export function PrintAttestationPage(): React.JSX.Element {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointment, setAppointment] = useState<AppointmentWithRefs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { unit, logos } = useUnitInfo()
  const autoPrint = params.get('autoprint') !== '0'

  const days = Math.max(1, Number.parseInt(params.get('dias') ?? '1', 10) || 1)
  const cidCode = params.get('cid') ?? null

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const appt = await window.api.appointments.get(Number(appointmentId))
        if (!appt) throw new Error('Agendamento não encontrado.')
        const p = await window.api.patients.get(appt.patient.id)
        if (cancelled) return
        setAppointment(appt)
        setPatient(p)
        if (autoPrint) {
          setTimeout(() => {
            window.print()
          }, 200)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    void load()
    const onAfterPrint = (): void => {
      if (autoPrint) navigate(-1)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [appointmentId, navigate, autoPrint])

  if (error) {
    return <PrintError message={error} onClose={() => navigate(-1)} />
  }

  if (!patient || !appointment) {
    return <div className="p-8 text-sm text-slate-500">Preparando impressão…</div>
  }

  const today = new Date()
  const fileName = `atestado-${patient.fullName}-${appointment.scheduledAt.slice(0, 10)}`

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => saveAsPdf(fileName)}
        onClose={() => navigate(-1)}
      />
      <article className="print-page">
        <PrintHeader title="Atestado médico" unit={unit} logos={logos} />
        <section className="print-section">
          <p className="text-justify leading-relaxed">
            Atesto, para os devidos fins, que o(a) Sr(a). <strong>{patient.fullName}</strong>
            {patient.cpf ? <> (CPF {formatCpf(patient.cpf)})</> : null} esteve sob meus cuidados em
            consulta realizada em{' '}
            <strong>{formatDateBr(appointment.scheduledAt.slice(0, 10))}</strong> e necessita de{' '}
            <strong>
              {days} dia{days > 1 ? 's' : ''}
            </strong>{' '}
            de afastamento de suas atividades habituais a partir desta data.
            {cidCode ? (
              <>
                {' '}
                CID-10: <strong>{cidCode}</strong>.
              </>
            ) : null}
          </p>
          <p className="mt-6">
            {appointment.professional.specialty ? `${appointment.professional.specialty} — ` : ''}
            {today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
          </p>
        </section>

        <PrintSignature
          professional={appointment.professional.fullName}
          municipality={unit.unitMunicipality}
        />
      </article>
    </div>
  )
}

/**
 * Layout de impressão do receituário.
 */
export function PrintPrescriptionPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [rx, setRx] = useState<PrescriptionWithRefs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { unit, logos } = useUnitInfo()
  const autoPrint = params.get('autoprint') !== '0'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const item = await window.api.prescriptions.get(Number(id))
        if (!item) throw new Error('Receituário não encontrado.')
        if (cancelled) return
        setRx(item)
        if (autoPrint) {
          setTimeout(() => {
            window.print()
          }, 200)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()
    const onAfterPrint = (): void => {
      if (autoPrint) navigate(-1)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [id, navigate, autoPrint])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!rx) return <div className="p-8 text-sm text-slate-500">Preparando impressão…</div>

  const fileName = `receituario-${rx.patient.fullName}-${rx.issuedAt.slice(0, 10)}`
  const age = ageFromBirthDate(rx.patient.birthDate)

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => saveAsPdf(fileName)}
        onClose={() => navigate(-1)}
      />
      <article className="print-page">
        <PrintHeader title="Receituário" unit={unit} logos={logos} />
        <section className="print-section">
          <Grid>
            <Cell label="Paciente">{rx.patient.fullName}</Cell>
            <Cell label="Nascimento">
              {formatDateBr(rx.patient.birthDate)}
              {age != null ? ` (${age} anos)` : ''}
            </Cell>
            <Cell label="CPF">{formatCpf(rx.patient.cpf) || '—'}</Cell>
            <Cell label="CNS">{rx.patient.cns ?? '—'}</Cell>
            <Cell label="Data">{formatDateBr(rx.issuedAt.slice(0, 10))}</Cell>
            <Cell label="Profissional">
              {rx.professional.fullName}
              {rx.professional.councilType && rx.professional.councilNumber
                ? ` — ${rx.professional.councilType} ${rx.professional.councilNumber}${rx.professional.councilUf ? `/${rx.professional.councilUf}` : ''}`
                : ''}
            </Cell>
          </Grid>
        </section>

        <section className="print-section">
          <h2>Prescrição</h2>
          <ol className="prescription-list">
            {rx.items.map((it, idx) => (
              <li key={idx}>
                <div className="prescription-line">
                  <strong>{it.medication}</strong>
                  {it.dose ? ` — ${it.dose}` : ''}
                  {it.via ? ` — via ${it.via}` : ''}
                </div>
                {it.posology ? <div>Posologia: {it.posology}</div> : null}
                <div className="muted">
                  {it.duration ? `Duração: ${it.duration}` : null}
                  {it.duration && it.quantity ? ' · ' : ''}
                  {it.quantity ? `Quantidade: ${it.quantity}` : null}
                </div>
                {it.notes ? <div className="muted">Obs.: {it.notes}</div> : null}
              </li>
            ))}
          </ol>
          {rx.notes ? (
            <p className="mt-4">
              <strong>Observações gerais:</strong> {rx.notes}
            </p>
          ) : null}
        </section>

        <PrintSignature
          professional={rx.professional.fullName}
          subtitle={
            rx.professional.councilType && rx.professional.councilNumber
              ? `${rx.professional.councilType} ${rx.professional.councilNumber}${rx.professional.councilUf ? `/${rx.professional.councilUf}` : ''}`
              : undefined
          }
          municipality={unit.unitMunicipality}
        />
      </article>
    </div>
  )
}

/**
 * Layout de impressão da requisição (SADT/exames/encaminhamento).
 */
export function PrintRequisitionPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [req, setReq] = useState<RequisitionWithRefs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { unit, logos } = useUnitInfo()
  const autoPrint = params.get('autoprint') !== '0'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const item = await window.api.requisitions.get(Number(id))
        if (!item) throw new Error('Requisição não encontrada.')
        if (cancelled) return
        setReq(item)
        if (autoPrint) {
          setTimeout(() => {
            window.print()
          }, 200)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()
    const onAfterPrint = (): void => {
      if (autoPrint) navigate(-1)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [id, navigate, autoPrint])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!req) return <div className="p-8 text-sm text-slate-500">Preparando impressão…</div>

  const fileName = `requisicao-${req.type}-${req.patient.fullName}-${req.issuedAt.slice(0, 10)}`
  const age = ageFromBirthDate(req.patient.birthDate)

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => saveAsPdf(fileName)}
        onClose={() => navigate(-1)}
      />
      <article className="print-page">
        <PrintHeader title={REQUISITION_TYPE_LABELS[req.type]} unit={unit} logos={logos} />
        <section className="print-section">
          <Grid>
            <Cell label="Paciente">{req.patient.fullName}</Cell>
            <Cell label="Nascimento">
              {formatDateBr(req.patient.birthDate)}
              {age != null ? ` (${age} anos)` : ''}
            </Cell>
            <Cell label="CPF">{formatCpf(req.patient.cpf) || '—'}</Cell>
            <Cell label="CNS">{req.patient.cns ?? '—'}</Cell>
            <Cell label="Data">{formatDateBr(req.issuedAt.slice(0, 10))}</Cell>
            <Cell label="Profissional solicitante">
              {req.professional.fullName}
              {req.professional.councilType && req.professional.councilNumber
                ? ` — ${req.professional.councilType} ${req.professional.councilNumber}${req.professional.councilUf ? `/${req.professional.councilUf}` : ''}`
                : ''}
            </Cell>
          </Grid>
        </section>

        <section className="print-section">
          <h2>Itens solicitados</h2>
          <ol className="requisition-list">
            {req.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
          {req.observations ? (
            <p className="mt-4">
              <strong>Observações / hipótese diagnóstica:</strong> {req.observations}
            </p>
          ) : null}
        </section>

        <PrintSignature
          professional={req.professional.fullName}
          subtitle={
            req.professional.councilType && req.professional.councilNumber
              ? `${req.professional.councilType} ${req.professional.councilNumber}${req.professional.councilUf ? `/${req.professional.councilUf}` : ''}`
              : undefined
          }
          municipality={unit.unitMunicipality}
        />
      </article>
    </div>
  )
}

function PrintError({
  message,
  onClose
}: {
  message: string
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="p-8">
      <p className="text-sm text-red-700">Erro: {message}</p>
      <button
        className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        onClick={onClose}
      >
        Voltar
      </button>
    </div>
  )
}

function PrintToolbar(props: {
  onPrint: () => void
  onSavePdf: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="print-toolbar print:hidden">
      <button onClick={props.onPrint}>Imprimir</button>
      <button onClick={props.onSavePdf}>Baixar PDF</button>
      <button onClick={props.onClose}>Fechar</button>
    </div>
  )
}

export function PrintHeader({
  title,
  unit,
  logos,
  layout = DEFAULT_LAYOUT
}: {
  title: string
  unit: UnitInfo
  logos: BrandingLogosState
  layout?: LetterheadLayout
}): React.JSX.Element {
  const hasUnit = unit.unitName.trim().length > 0
  const hasAnyLogo = logos.prefeitura || logos.secretaria || logos.hospital
  const prefeituraText = unit.brandingPrefeituraName || 'PREFEITURA MUNICIPAL'
  const secretariaText = unit.brandingSecretariaName || 'SECRETARIA MUNICIPAL DE SAÚDE'
  const unidadeText = hasUnit ? unit.unitName : 'UNIDADE BÁSICA DE SAÚDE'
  const logoStyle = { height: `${layout.logoHeight}px`, width: 'auto' } as const
  const alignStyle: React.CSSProperties = {
    textAlign: layout.align,
    alignItems: layout.align === 'center' ? 'center' : 'flex-start'
  }
  const logosJustify =
    layout.align === 'center' ? 'space-around' : ('flex-start' as const)

  return (
    <header className="print-header">
      {hasAnyLogo ? (
        <div className="print-letterhead" style={alignStyle}>
          <div
            className="print-letterhead-logos"
            style={{ justifyContent: logosJustify, gap: '24px' }}
          >
            <div className="print-letterhead-logo">
              {logos.prefeitura ? (
                <img src={logos.prefeitura} alt="Logo Prefeitura" style={logoStyle} />
              ) : null}
            </div>
            <div className="print-letterhead-logo">
              {logos.secretaria ? (
                <img src={logos.secretaria} alt="Logo Secretaria" style={logoStyle} />
              ) : null}
            </div>
            <div className="print-letterhead-logo">
              {logos.hospital ? (
                <img src={logos.hospital} alt="Logo do Hospital" style={logoStyle} />
              ) : null}
            </div>
          </div>
          <div className="print-letterhead-text">
            <div className="line-1">{prefeituraText}</div>
            <div className="line-2">{secretariaText}</div>
            <div className="line-3">{unidadeText}</div>
          </div>
          {layout.showFooter ? (
            <div className="muted print-letterhead-address">
              {unit.unitCnes ? <>CNES {unit.unitCnes}</> : null}
              {unit.unitCnes && unit.unitAddress ? ' · ' : null}
              {unit.unitAddress || null}
              {unit.unitPhone ? <> · Tel. {unit.unitPhone}</> : null}
              {unit.unitMunicipality ? <> · {unit.unitMunicipality}</> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ textAlign: layout.align }}>
          <strong>{hasUnit ? unit.unitName : 'SECRETARIA MUNICIPAL DE SAÚDE'}</strong>
          {layout.showFooter ? (
            <div className="muted">
              {hasUnit ? (
                <>
                  {unit.unitCnes ? <>CNES {unit.unitCnes} · </> : null}
                  {unit.unitAddress || 'Unidade Básica de Saúde (UBS)'}
                  {unit.unitPhone ? <> · Tel. {unit.unitPhone}</> : null}
                </>
              ) : (
                'Unidade Básica de Saúde (UBS)'
              )}
            </div>
          ) : null}
        </div>
      )}
      <h1>{title}</h1>
    </header>
  )
}

function Grid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <dl className="print-grid">{children}</dl>
}

function Cell({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function SoapBlock({ label, value }: { label: string; value: string | null }): React.JSX.Element {
  return (
    <div className="print-soap">
      <h3>{label}</h3>
      <p>{value && value.trim().length > 0 ? value : <span className="muted">—</span>}</p>
    </div>
  )
}

function PrintSignature({
  professional,
  subtitle,
  municipality
}: {
  professional: string
  subtitle?: string
  municipality?: string
}): React.JSX.Element {
  const today = new Date()
  return (
    <footer className="print-signature">
      {municipality ? (
        <div className="muted">
          {municipality},{' '}
          {today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      ) : null}
      <div className="signature-line" />
      <div>{professional}</div>
      {subtitle ? <div className="muted">{subtitle}</div> : null}
    </footer>
  )
}

/**
 * Modelo do papel timbrado — usado pela aba Timbrado para exportar PDF
 * de exemplo (sem dados reais). Mesma estética dos outros prints.
 */
export function PrintModelPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { unit, logos, layout } = useUnitInfo()
  const [params] = useSearchParams()
  const autoPrint = params.get('autoprint') === '1'

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => void saveAsPdf('modelo-timbrado'), 350)
      return () => clearTimeout(t)
    }
    return
  }, [autoPrint])

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf('modelo-timbrado')}
        onClose={() => navigate(-1)}
      />
      <PrintHeader
        title="MODELO DE PAPEL TIMBRADO"
        unit={unit}
        logos={logos}
        layout={layout}
      />
      <section>
        <h2 className="muted" style={{ textTransform: 'uppercase', fontSize: 12, marginTop: 16 }}>
          Conteúdo do documento
        </h2>
        <p>
          Este é um modelo de pré-visualização do papel timbrado configurado em{' '}
          <em>Admin → Timbrado</em>. Use o botão acima para exportar como PDF e verificar como
          ficará a impressão real das fichas, atestados, receituários e requisições.
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          Ajuste a altura dos logos, alinhamento e visibilidade do rodapé para que o cabeçalho
          fique como esperado em qualquer documento gerado pelo sistema.
        </p>
        <Grid>
          <Cell label="Paciente">Nome do paciente</Cell>
          <Cell label="Data de nascimento">dd/mm/aaaa</Cell>
          <Cell label="CPF">000.000.000-00</Cell>
          <Cell label="Profissional">Nome do profissional</Cell>
        </Grid>
        <SoapBlock label="Subjetivo" value="Aqui aparece o relato do paciente." />
        <SoapBlock label="Plano" value="Conduta, exames solicitados, retorno." />
      </section>
      <PrintSignature professional="________________________________________" subtitle="CRM/COREN" />
    </div>
  )
}
