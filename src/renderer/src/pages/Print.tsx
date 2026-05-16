import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ageFromBirthDate, formatCpf, formatDateBr, formatDateTimeBr } from '@renderer/lib/utils'
import type {
  AdmissionWithRefs,
  AdmissionEvolutionWithRefs,
  AppointmentWithRefs,
  Attendance,
  BpaRecordWithRefs,
  Patient,
  PrescriptionWithRefs,
  RequisitionWithRefs,
  SinanNotificationWithRefs,
  SurgeryOpme,
  SurgeryTimeOutItem,
  SurgeryWithRefs
} from '@shared/types'
import { ANESTHESIA_TYPE_LABELS, REQUISITION_TYPE_LABELS } from '@shared/types'

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

/**
 * Folha BPA-Individualizado (SIA-SUS). Renderiza os registros de BPA da
 * competência (ano+mês) em formato tabular, no padrão do Boletim de
 * Produção Ambulatorial. Aceita exportar como PDF via PrintToolbar.
 *
 * Layout enxuto fiel ao formulário oficial — pode ser arquivado em
 * papel ou enviado eletronicamente após digitação no sistema do
 * município. Os campos cobertos: competência, CNES, CNS profissional,
 * CBO, CNS paciente, sexo, nascimento, município, procedimento SIGTAP,
 * CID-10, quantidade, data.
 */
export function PrintBpaSheetPage(): React.JSX.Element {
  const params = useParams()
  const navigate = useNavigate()
  const year = Number(params.year)
  const month = Number(params.month)
  const { unit, logos, layout } = useUnitInfo()
  const [records, setRecords] = useState<BpaRecordWithRefs[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.bpa
      .listRecords({ year, month })
      .then((r) => !cancelled && setRecords(r))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [year, month])

  if (error) {
    return <PrintError message={error} onClose={() => navigate(-1)} />
  }
  if (!records) {
    return <div className="print-document">Carregando…</div>
  }

  const ROWS_PER_PAGE = 20
  const pages: BpaRecordWithRefs[][] = []
  for (let i = 0; i < Math.max(records.length, 1); i += ROWS_PER_PAGE) {
    pages.push(records.slice(i, i + ROWS_PER_PAGE))
  }
  const competencia = `${String(month).padStart(2, '0')}/${year}`
  const totalQty = records.reduce((s, r) => s + (r.quantity || 0), 0)

  const fileName = `bpa-i-${year}-${String(month).padStart(2, '0')}`

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf(fileName)}
        onClose={() => navigate(-1)}
      />
      {pages.map((pageRows, pageIdx) => (
        <section key={pageIdx} className={pageIdx > 0 ? 'print-page-break' : undefined}>
          <PrintHeader
            title="BPA-INDIVIDUALIZADO (BPA-I)"
            unit={unit}
            logos={logos}
            layout={layout}
          />

          <table
            style={{
              width: '100%',
              fontSize: 11,
              marginBottom: 8,
              borderCollapse: 'collapse'
            }}
          >
            <tbody>
              <tr>
                <td style={{ border: '1px solid #94a3b8', padding: 4 }}>
                  <strong>Competência:</strong> {competencia}
                </td>
                <td style={{ border: '1px solid #94a3b8', padding: 4 }}>
                  <strong>CNES:</strong> {unit.unitCnes || '———'}
                </td>
                <td style={{ border: '1px solid #94a3b8', padding: 4 }}>
                  <strong>Município:</strong> {unit.unitMunicipality || '———'}
                </td>
                <td style={{ border: '1px solid #94a3b8', padding: 4 }}>
                  <strong>Folha:</strong> {pageIdx + 1} / {pages.length}
                </td>
              </tr>
            </tbody>
          </table>

          <table
            style={{
              width: '100%',
              fontSize: 9,
              borderCollapse: 'collapse',
              tableLayout: 'fixed'
            }}
          >
            <thead>
              <tr style={{ background: '#e2e8f0' }}>
                <th style={bpaTh(30)}>Lin</th>
                <th style={bpaTh(80)}>Data</th>
                <th style={bpaTh(110)}>CNS Profissional</th>
                <th style={bpaTh(55)}>CBO</th>
                <th style={bpaTh(110)}>CNS Paciente</th>
                <th style={bpaTh(220)}>Nome do paciente</th>
                <th style={bpaTh(35)}>Sexo</th>
                <th style={bpaTh(75)}>Nasc.</th>
                <th style={bpaTh(110)}>Procedimento (SIGTAP)</th>
                <th style={bpaTh(65)}>CID-10</th>
                <th style={bpaTh(30)}>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...bpaTd, textAlign: 'center', padding: 12 }}>
                    Nenhum procedimento registrado nesta competência.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td style={bpaTd}>{pageIdx * ROWS_PER_PAGE + idx + 1}</td>
                    <td style={bpaTd}>{r.procedureDate.slice(8, 10)}/{r.procedureDate.slice(5, 7)}</td>
                    <td style={bpaTd}>{r.professionalCns || '———'}</td>
                    <td style={bpaTd}>{r.professionalCboCode || r.cboCode || '——'}</td>
                    <td style={bpaTd}>{r.patientCns || '———'}</td>
                    <td style={{ ...bpaTd, textAlign: 'left' }}>{r.patientName || '———'}</td>
                    <td style={bpaTd}>{r.patientSex ?? '—'}</td>
                    <td style={bpaTd}>
                      {r.patientBirthDate
                        ? `${r.patientBirthDate.slice(8, 10)}/${r.patientBirthDate.slice(5, 7)}/${r.patientBirthDate.slice(0, 4)}`
                        : '———'}
                    </td>
                    <td style={bpaTd}>{r.procedureCode}</td>
                    <td style={bpaTd}>{r.cid10 || '——'}</td>
                    <td style={{ ...bpaTd, textAlign: 'right' }}>{r.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
            {pageIdx === pages.length - 1 ? (
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
                  <td colSpan={10} style={{ ...bpaTd, textAlign: 'right' }}>
                    Total de procedimentos na competência:
                  </td>
                  <td style={{ ...bpaTd, textAlign: 'right' }}>{totalQty}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>

          <footer
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10
            }}
          >
            <div>
              <div>____________________________________</div>
              <div className="muted">Responsável pelo preenchimento</div>
            </div>
            <div>
              <div>____________________________________</div>
              <div className="muted">Coordenador / Gestor</div>
            </div>
          </footer>
        </section>
      ))}
    </div>
  )
}

const bpaTh = (width: number): React.CSSProperties => ({
  border: '1px solid #94a3b8',
  padding: '4px 3px',
  textAlign: 'center',
  fontWeight: 600,
  width
})

const bpaTd: React.CSSProperties = {
  border: '1px solid #94a3b8',
  padding: '3px',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

// ════════════════════════════════════════════════════════════════════
//   AIH — Autorização de Internação Hospitalar
// ════════════════════════════════════════════════════════════════════
export function PrintAIHPage(): React.JSX.Element {
  const { admissionId } = useParams()
  const navigate = useNavigate()
  const { unit, logos, layout } = useUnitInfo()
  const [adm, setAdm] = useState<AdmissionWithRefs | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.admissions
      .get(Number(admissionId))
      .then((a) => !cancelled && setAdm(a))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [admissionId])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!adm) return <div className="print-document">Carregando…</div>

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf(`aih-${adm.id}`)}
        onClose={() => navigate(-1)}
      />
      <PrintHeader title="AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR (AIH)" unit={unit} logos={logos} layout={layout} />
      <Grid>
        <Cell label="Nº AIH">{adm.aihNumber || '——————————'}</Cell>
        <Cell label="Data da admissão">{formatDateBr(adm.admittedAt)}</Cell>
        <Cell label="Caráter">{adm.admissionType}</Cell>
        <Cell label="Leito atual">
          {adm.currentBed ? `${adm.currentBed.code} (${adm.currentBed.wardName})` : '—'}
        </Cell>
      </Grid>
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Identificação do paciente
      </h3>
      <Grid>
        <Cell label="Nome">{adm.patient.fullName}</Cell>
        <Cell label="Sexo">{adm.patient.sex}</Cell>
        <Cell label="Nascimento">{formatDateBr(adm.patient.birthDate)} ({ageFromBirthDate(adm.patient.birthDate)} anos)</Cell>
        <Cell label="CPF">{adm.patient.cpf ? formatCpf(adm.patient.cpf) : '—'}</Cell>
        <Cell label="CNS">{adm.patient.cns || '—'}</Cell>
      </Grid>
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Dados da autorização
      </h3>
      <Grid>
        <Cell label="CID-10 principal">{adm.admissionCid10 || '——'}</Cell>
        <Cell label="Diagnóstico">{adm.admissionDiagnosis || '—'}</Cell>
        <Cell label="Proc. principal (SIGTAP)">{adm.aihMainProcedureCode || '——————————'}</Cell>
        <Cell label="Médico solicitante">
          {adm.attendingProfessional?.fullName ?? '—'}
        </Cell>
      </Grid>
      <SoapBlock label="Justificativa clínica" value={adm.aihJustification || '—'} />
      <SoapBlock label="Queixa principal" value={adm.chiefComplaint || '—'} />
      <PrintSignature professional="________________________________________" subtitle="Médico solicitante / CRM" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//   Resumo de Alta Hospitalar
// ════════════════════════════════════════════════════════════════════
export function PrintDischargeSummaryPage(): React.JSX.Element {
  const { admissionId } = useParams()
  const navigate = useNavigate()
  const { unit, logos, layout } = useUnitInfo()
  const [adm, setAdm] = useState<AdmissionWithRefs | null>(null)
  const [evolutions, setEvolutions] = useState<AdmissionEvolutionWithRefs[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const a = await window.api.admissions.get(Number(admissionId))
        if (cancelled) return
        setAdm(a)
        if (a) {
          const evs = await window.api.evolutions.listForAdmission(a.id)
          if (!cancelled) setEvolutions(evs)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [admissionId])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!adm) return <div className="print-document">Carregando…</div>

  const totalDias =
    adm.dischargeAt && adm.admittedAt
      ? Math.max(
          1,
          Math.floor(
            (new Date(adm.dischargeAt).getTime() - new Date(adm.admittedAt).getTime()) /
              (24 * 3600 * 1000)
          )
        )
      : '—'

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf(`alta-${adm.id}`)}
        onClose={() => navigate(-1)}
      />
      <PrintHeader title="RESUMO DE ALTA HOSPITALAR" unit={unit} logos={logos} layout={layout} />
      <Grid>
        <Cell label="Paciente">{adm.patient.fullName}</Cell>
        <Cell label="CPF / CNS">
          {adm.patient.cpf ? formatCpf(adm.patient.cpf) : '—'}
          {adm.patient.cns ? ` · CNS ${adm.patient.cns}` : ''}
        </Cell>
        <Cell label="Nascimento">{formatDateBr(adm.patient.birthDate)}</Cell>
        <Cell label="Sexo">{adm.patient.sex}</Cell>
      </Grid>
      <Grid>
        <Cell label="Admissão">{formatDateTimeBr(adm.admittedAt)}</Cell>
        <Cell label="Alta">{adm.dischargeAt ? formatDateTimeBr(adm.dischargeAt) : '—'}</Cell>
        <Cell label="Dias internado">{totalDias}</Cell>
        <Cell label="Tipo de alta">{adm.dischargeType ?? '—'}</Cell>
      </Grid>
      <SoapBlock label="Diagnóstico de admissão (CID-10)" value={`${adm.admissionCid10 ?? '—'} — ${adm.admissionDiagnosis ?? ''}`} />
      <SoapBlock label="Diagnóstico de alta (CID-10)" value={adm.dischargeCid10 ?? '—'} />
      <SoapBlock label="Queixa principal na admissão" value={adm.chiefComplaint} />
      <SoapBlock label="Resumo da internação / evolução" value={adm.dischargeSummary} />
      {evolutions.length > 0 ? (
        <section style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
            Evoluções clínicas durante a internação
          </h3>
          <ul style={{ fontSize: 11, marginLeft: 16 }}>
            {evolutions.slice(0, 10).map((e) => (
              <li key={e.id} style={{ marginBottom: 4 }}>
                <strong>{formatDateTimeBr(e.evolutionAt)}</strong>
                {e.professionalName ? ` — ${e.professionalName}` : ''}:{' '}
                {(e.assessment || e.plan || e.subjective || '').slice(0, 240) || '—'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="muted" style={{ fontSize: 10, marginTop: 16 }}>
        Orientações pós-alta: retornar à unidade em caso de piora, dor intensa, febre persistente
        ou qualquer sintoma novo. Manter medicações prescritas e consultas de retorno conforme
        agendamento.
      </p>
      <PrintSignature
        professional={adm.attendingProfessional?.fullName ?? '________________________________________'}
        subtitle="Médico responsável / CRM"
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//   Folha de Sala Cirúrgica
// ════════════════════════════════════════════════════════════════════
export function PrintSurgeryReportPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { unit, logos, layout } = useUnitInfo()
  const [surgery, setSurgery] = useState<SurgeryWithRefs | null>(null)
  const [timeOut, setTimeOut] = useState<SurgeryTimeOutItem[]>([])
  const [opme, setOpme] = useState<SurgeryOpme[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const sId = Number(id)
        const [s, t, o] = await Promise.all([
          window.api.surgery.getSurgery(sId),
          window.api.surgery.listTimeOut(sId),
          window.api.surgery.listOpme(sId)
        ])
        if (cancelled) return
        setSurgery(s)
        setTimeOut(t)
        setOpme(o)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!surgery) return <div className="print-document">Carregando…</div>

  const dur =
    surgery.actualStart && surgery.actualEnd
      ? Math.round(
          (new Date(surgery.actualEnd).getTime() - new Date(surgery.actualStart).getTime()) / 60000
        )
      : null

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf(`folha-sala-${surgery.id}`)}
        onClose={() => navigate(-1)}
      />
      <PrintHeader title="FOLHA DE SALA CIRÚRGICA" unit={unit} logos={logos} layout={layout} />
      <Grid>
        <Cell label="Paciente">{surgery.patientName}</Cell>
        <Cell label="CPF">{surgery.patientCpf ? formatCpf(surgery.patientCpf) : '—'}</Cell>
        <Cell label="Sala">{surgery.roomName ?? '—'}</Cell>
        <Cell label="Prioridade">{surgery.priority}</Cell>
      </Grid>
      <Grid>
        <Cell label="Procedimento">{surgery.procedureName}</Cell>
        <Cell label="CID-10">{surgery.procedureCid10 ?? '—'}</Cell>
        <Cell label="Anestesia">
          {surgery.anesthesiaType ? ANESTHESIA_TYPE_LABELS[surgery.anesthesiaType] : '—'}
        </Cell>
        <Cell label="Status">{surgery.status}</Cell>
      </Grid>
      <Grid>
        <Cell label="Cirurgião">{surgery.surgeonName ?? '—'}</Cell>
        <Cell label="Anestesista">{surgery.anesthetistName ?? '—'}</Cell>
        <Cell label="Início">{surgery.actualStart ? formatDateTimeBr(surgery.actualStart) : '—'}</Cell>
        <Cell label="Fim">{surgery.actualEnd ? formatDateTimeBr(surgery.actualEnd) : '—'}</Cell>
      </Grid>
      {dur != null ? (
        <p style={{ fontSize: 11, marginTop: 6 }}>
          <strong>Duração:</strong> {dur} minutos
        </p>
      ) : null}
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Time-out (WHO Surgical Safety)
      </h3>
      <ul style={{ fontSize: 11, marginLeft: 16 }}>
        {timeOut.length === 0 ? (
          <li>—</li>
        ) : (
          timeOut.map((t) => (
            <li key={t.id}>
              {t.checked ? '☒' : '☐'} {t.item}
              {t.checkedAt ? ` — ${formatDateTimeBr(t.checkedAt)}` : ''}
            </li>
          ))
        )}
      </ul>
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Materiais (OPME)
      </h3>
      <ul style={{ fontSize: 11, marginLeft: 16 }}>
        {opme.length === 0 ? (
          <li>—</li>
        ) : (
          opme.map((o) => (
            <li key={o.id}>
              {o.quantity}× {o.description}
              {o.lotNumber ? ` · lote ${o.lotNumber}` : ''}
              {o.manufacturer ? ` · ${o.manufacturer}` : ''}
            </li>
          ))
        )}
      </ul>
      <SoapBlock label="Descrição cirúrgica" value={surgery.description} />
      <SoapBlock label="Observações" value={surgery.notes} />
      <PrintSignature
        professional={surgery.surgeonName ?? '________________________________________'}
        subtitle="Cirurgião / CRM"
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//   Ficha de Notificação SINAN
// ════════════════════════════════════════════════════════════════════
export function PrintSinanPage(): React.JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const { unit, logos, layout } = useUnitInfo()
  const [n, setN] = useState<SinanNotificationWithRefs | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.sinan
      .get(Number(id))
      .then((r) => !cancelled && setN(r))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <PrintError message={error} onClose={() => navigate(-1)} />
  if (!n) return <div className="print-document">Carregando…</div>

  return (
    <div className="print-document">
      <PrintToolbar
        onPrint={() => window.print()}
        onSavePdf={() => void saveAsPdf(`sinan-${n.id}`)}
        onClose={() => navigate(-1)}
      />
      <PrintHeader title="FICHA DE NOTIFICAÇÃO / INVESTIGAÇÃO — SINAN" unit={unit} logos={logos} layout={layout} />
      <Grid>
        <Cell label="Nº da notificação">{n.id}</Cell>
        <Cell label="Data da notificação">{formatDateTimeBr(n.notificadoEm)}</Cell>
        <Cell label="Agravo (CID-10)">{n.agravoCid}</Cell>
        <Cell label="Agravo">{n.agravoName}</Cell>
      </Grid>
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Identificação do paciente
      </h3>
      <Grid>
        <Cell label="Nome">{n.patientName}</Cell>
        <Cell label="CPF">{n.patientCpf ? formatCpf(n.patientCpf) : '—'}</Cell>
        <Cell label="CNS">{n.patientCns || '—'}</Cell>
        <Cell label="Nascimento">{n.patientBirthDate ? formatDateBr(n.patientBirthDate) : '—'}</Cell>
        <Cell label="Sexo">{n.patientSex || '—'}</Cell>
      </Grid>
      <h3 style={{ marginTop: 16, fontSize: 12, textTransform: 'uppercase', color: '#475569' }}>
        Dados clínicos
      </h3>
      <Grid>
        <Cell label="Início dos sintomas">
          {n.sintomasIniciaisEm ? formatDateBr(n.sintomasIniciaisEm) : '—'}
        </Cell>
        <Cell label="Classificação">{n.classificacao || '—'}</Cell>
        <Cell label="Evolução">{n.evolucao || '—'}</Cell>
      </Grid>
      <SoapBlock label="Observações" value={n.observations} />
      <PrintSignature
        professional={n.professionalName ?? '________________________________________'}
        subtitle={n.professionalCns ? `CNS ${n.professionalCns}` : 'Profissional notificador'}
      />
    </div>
  )
}
