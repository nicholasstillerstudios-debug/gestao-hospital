import { useEffect, useState } from 'react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input, Select } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { formatDateTimeBr } from '@renderer/lib/utils'
import type {
  InternalTaskWithRefs,
  Patient,
  TaskPriority,
  TaskStatus,
  User,
  UserRole
} from '@shared/types'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@shared/types'

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgente: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  normal: 'bg-slate-100 text-slate-700',
  baixa: 'bg-slate-50 text-slate-500'
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  em_andamento: 'bg-blue-50 text-blue-700',
  concluida: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-slate-100 text-slate-500'
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'recepcao', label: 'Recepção' },
  { value: 'enfermagem', label: 'Enfermagem' },
  { value: 'medico', label: 'Médico' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'admin', label: 'Admin' }
]

export function TasksPage(): React.JSX.Element {
  const [view, setView] = useState<'minhas' | 'todas'>('minhas')
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [list, setList] = useState<InternalTaskWithRefs[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [completing, setCompleting] = useState<InternalTaskWithRefs | null>(null)

  const reload = async (): Promise<void> => {
    if (view === 'minhas') {
      setList(await window.api.tasks.listForMe())
    } else {
      setList(await window.api.tasks.list({ status: status || undefined }))
    }
  }
  useEffect(() => {
    void reload()
    const unsub = window.api.tasks.onNew(() => void reload())
    return unsub
  }, [view, status])

  return (
    <>
      <PageHeader
        title="Tarefas / Avisos internos"
        subtitle="Comunicação entre colaboradores: recepção, enfermagem, médico, farmácia"
      />
      <div className="px-6 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === 'minhas' ? 'bg-cyan-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setView('minhas')}
            >
              Para mim
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === 'todas' ? 'bg-cyan-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setView('todas')}
            >
              Todas
            </button>
            {view === 'todas' ? (
              <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | '')}>
                <option value="">Todos os status</option>
                {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <Button onClick={() => setNewOpen(true)}>Nova tarefa</Button>
        </div>

        <div className="space-y-2">
          {list.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLOR[t.priority]}`}
                    >
                      {TASK_PRIORITY_LABELS[t.priority]}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[t.status]}`}
                    >
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                    <span className="text-xs text-slate-500">
                      Criado em {formatDateTimeBr(t.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">{t.title}</div>
                  {t.description ? (
                    <div className="mt-1 text-xs text-slate-600">{t.description}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-500">
                    De <strong>{t.fromUserName ?? '—'}</strong> para{' '}
                    <strong>{t.toUserName ?? t.toRole ?? '—'}</strong>
                    {t.patientName ? (
                      <>
                        {' '}
                        · Paciente <strong>{t.patientName}</strong>
                      </>
                    ) : null}
                    {t.dueAt ? <> · Prazo {t.dueAt}</> : null}
                  </div>
                  {t.completedByName ? (
                    <div className="mt-1 text-xs italic text-emerald-700">
                      Concluída por {t.completedByName} em{' '}
                      {t.completedAt ? formatDateTimeBr(t.completedAt) : '—'}
                      {t.completionNotes ? ` — "${t.completionNotes}"` : ''}
                    </div>
                  ) : null}
                </div>
                {t.status === 'pendente' || t.status === 'em_andamento' ? (
                  <div className="flex flex-none gap-1">
                    {t.status === 'pendente' ? (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await window.api.tasks.updateStatus(t.id, 'em_andamento')
                          void reload()
                        }}
                      >
                        Iniciar
                      </Button>
                    ) : null}
                    <Button onClick={() => setCompleting(t)}>Concluir</Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {view === 'minhas' ? 'Nenhuma tarefa pendente para você.' : 'Nenhuma tarefa.'}
            </div>
          ) : null}
        </div>
      </div>

      {newOpen ? (
        <NewTaskModal
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            setNewOpen(false)
            void reload()
          }}
        />
      ) : null}
      {completing ? (
        <CompleteTaskModal
          task={completing}
          onClose={() => setCompleting(null)}
          onSaved={() => {
            setCompleting(null)
            void reload()
          }}
        />
      ) : null}
    </>
  )
}

function NewTaskModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState<'user' | 'role'>('role')
  const [users, setUsers] = useState<User[]>([])
  const [toUserId, setToUserId] = useState<number | ''>('')
  const [toRole, setToRole] = useState<UserRole>('enfermagem')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueAt, setDueAt] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.api.users.list().then((all) => setUsers(all.filter((u) => u.active)))
  }, [])

  useEffect(() => {
    if (patientQuery.trim().length < 2) {
      setPatientResults([])
      return
    }
    const t = setTimeout(() => {
      void window.api.patients.search(patientQuery).then(setPatientResults)
    }, 250)
    return () => clearTimeout(t)
  }, [patientQuery])

  const save = async (): Promise<void> => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await window.api.tasks.create({
        title: title.trim(),
        description: description.trim() || null,
        toUserId: target === 'user' ? (toUserId === '' ? null : Number(toUserId)) : null,
        toRole: target === 'role' ? toRole : null,
        patientId: patient?.id ?? null,
        priority,
        dueAt: dueAt || null
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Nova tarefa / aviso" onClose={onClose} size="lg">
      <div className="space-y-3">
        <Field label="Título / Aviso" required>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Paciente João aguardando ECG"
          />
        </Field>
        <Field label="Descrição / detalhes">
          <textarea
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Destinatário">
            <Select value={target} onChange={(e) => setTarget(e.target.value as 'user' | 'role')}>
              <option value="role">Função (todos do grupo)</option>
              <option value="user">Usuário específico</option>
            </Select>
          </Field>
          {target === 'role' ? (
            <Field label="Função" required>
              <Select value={toRole} onChange={(e) => setToRole(e.target.value as UserRole)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Usuário" required>
              <Select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Prioridade">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prazo (opcional)">
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          <Field label="Paciente relacionado (opcional)">
            {patient ? (
              <div className="rounded-md bg-cyan-50 px-3 py-2 text-sm">
                <strong>{patient.fullName}</strong>
                <button
                  className="ml-2 text-xs text-cyan-700"
                  onClick={() => setPatient(null)}
                >
                  trocar
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar paciente…"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                <div className="mt-1 max-h-32 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className="block w-full px-2 py-1 text-left text-sm hover:bg-slate-100"
                      onClick={() => setPatient(p)}
                    >
                      {p.fullName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!title.trim() || saving}>
            {saving ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CompleteTaskModal({
  task,
  onClose,
  onSaved
}: {
  task: InternalTaskWithRefs
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const finish = async (status: 'concluida' | 'cancelada'): Promise<void> => {
    setSaving(true)
    try {
      await window.api.tasks.updateStatus(task.id, status, notes.trim() || null)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={task.title} onClose={onClose}>
      <div className="space-y-3">
        {task.description ? (
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{task.description}</div>
        ) : null}
        <Field label="Observação ao concluir (opcional)">
          <textarea
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="O que foi feito, encaminhamentos…"
          />
        </Field>
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => void finish('cancelada')} disabled={saving}>
            Cancelar tarefa
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Voltar
            </Button>
            <Button onClick={() => void finish('concluida')} disabled={saving}>
              {saving ? 'Salvando…' : 'Marcar concluída'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
