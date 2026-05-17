import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import {
  PALETTE_COMMANDS,
  filterCommands,
  type PaletteCommand
} from '@renderer/lib/commandPalette'
import type { Patient } from '@shared/types'

type Item =
  | { kind: 'cmd'; cmd: PaletteCommand }
  | { kind: 'patient'; patient: Patient }

export function CommandPalette(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const meta = e.ctrlKey || e.metaKey
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setPatients([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setPatients([])
      return
    }
    const t = setTimeout(() => {
      void window.api.patients.search(query).then((r) => setPatients(r.slice(0, 6)))
    }, 200)
    return () => clearTimeout(t)
  }, [open, query])

  const items: Item[] = useMemo(() => {
    const cmds = filterCommands(query, PALETTE_COMMANDS).slice(0, 12)
    const cmdItems: Item[] = cmds.map((cmd) => ({ kind: 'cmd' as const, cmd }))
    const patientItems: Item[] = patients.map((p) => ({ kind: 'patient' as const, patient: p }))
    return [...patientItems, ...cmdItems]
  }, [query, patients])

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, items.length - 1)))
  }, [items])

  if (!user || !open) return null

  const choose = (it: Item): void => {
    if (it.kind === 'cmd') {
      if (it.cmd.openPanel) {
        void window.api.panel.open(it.cmd.to)
      } else {
        navigate(it.cmd.to)
      }
    } else {
      navigate(`/pacientes/${it.patient.id}`)
    }
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[selected]
      if (it) choose(it)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar paciente, módulo ou ação…  (Ctrl+K)"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              {query.trim().length < 2
                ? 'Digite para buscar — ↑↓ navega · Enter abre'
                : 'Nenhum resultado.'}
            </div>
          ) : (
            items.map((it, i) => {
              const isCmd = it.kind === 'cmd'
              const label = isCmd ? it.cmd.label : it.patient.fullName
              const sub = isCmd
                ? it.cmd.group
                : `Paciente${it.patient.cpf ? ` · CPF ${it.patient.cpf}` : ''}${it.patient.birthDate ? ` · nasc. ${it.patient.birthDate.slice(0, 10)}` : ''}`
              return (
                <button
                  key={isCmd ? `c-${it.cmd.id}` : `p-${it.patient.id}`}
                  onClick={() => choose(it)}
                  onMouseEnter={() => setSelected(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                    selected === i ? 'bg-cyan-50' : ''
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-md text-xs font-semibold ${
                      isCmd ? 'bg-slate-100 text-slate-600' : 'bg-cyan-100 text-cyan-700'
                    }`}
                  >
                    {isCmd ? '▸' : '•'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{label}</div>
                    <div className="truncate text-xs text-slate-500">{sub}</div>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1">↑↓</kbd> navegar ·{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1">Ctrl</kbd>+
            <kbd className="rounded border border-slate-300 bg-white px-1">K</kbd> atalho global
          </span>
        </div>
      </div>
    </div>
  )
}
