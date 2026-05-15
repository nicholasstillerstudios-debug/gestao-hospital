import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '@renderer/components/BrandLogo'
import { useAuth } from '@renderer/stores/auth'
import type { PatientCall } from '@shared/types'

/**
 * Painel público de chamada de pacientes para TV/monitor da recepção.
 * - Sem autenticação (acessado via `/painel` ou via "Abrir painel" na Administração).
 * - Usa Web Speech API (síntese nativa do SO) para anunciar a chamada em PT-BR.
 * - Escuta eventos em tempo real via IPC (`api.calls.onNewCall`) e polla a
 *   cada 5s como fallback caso esteja em outra janela que não recebeu o evento.
 */

const PRIMARY_FALLBACK = '#0e7490'

function formatTimeBr(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function pickPortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  // Prefere vozes pt-BR femininas (Maria no Windows); depois qualquer pt-BR; depois pt-*.
  const ptBr = voices.filter((v) => /pt[-_]BR/i.test(v.lang))
  const ptAny = voices.filter((v) => /^pt/i.test(v.lang))
  const preferredName = ptBr.find((v) => /maria|ana|luciana|camila/i.test(v.name))
  return preferredName ?? ptBr[0] ?? ptAny[0] ?? null
}

function speak(text: string, repeats: number = 2): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const voice = pickPortugueseVoice()
  for (let i = 0; i < repeats; i++) {
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'pt-BR'
    u.rate = 0.95
    u.pitch = 1
    u.volume = 1
    window.speechSynthesis.speak(u)
  }
}

/**
 * Toca um sino de 3 notas (C5→E5→G5) antes da voz para chamar a atenção
 * de quem está olhando o painel. Usa Web Audio API — não precisa de arquivo.
 */
let sharedAudioCtx: AudioContext | null = null
function playChime(): void {
  if (typeof window === 'undefined') return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx()
    const ctx = sharedAudioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const notes = [523.25, 659.25, 783.99] // C5 — E5 — G5
    const noteDur = 0.18
    const gap = 0.04
    const start = ctx.currentTime + 0.02
    notes.forEach((freq, i) => {
      const t0 = start + i * (noteDur + gap)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + noteDur + 0.02)
    })
  } catch {
    // sino é best-effort
  }
}

/**
 * setTimeout id em escopo de módulo para que possamos cancelar uma fala
 * ainda agendada se o usuário silenciar o painel ou o componente desmontar
 * dentro da janela de 750ms entre o sino e a voz.
 */
let announceTimerId: number | null = null

function announce(call: PatientCall): void {
  if (announceTimerId !== null) {
    window.clearTimeout(announceTimerId)
    announceTimerId = null
  }
  playChime()
  // Aguarda o sino terminar (~0.7s) antes da voz para não sobrepor.
  announceTimerId = window.setTimeout(() => {
    announceTimerId = null
    speak(callMessage(call), 2)
  }, 750)
}

function cancelPendingAnnounce(): void {
  if (announceTimerId !== null) {
    window.clearTimeout(announceTimerId)
    announceTimerId = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function callMessage(call: PatientCall): string {
  if (call.message && call.message.trim().length > 0) return call.message
  const room = call.room ? `Compareça ao ${call.room}.` : ''
  return `Atenção. Paciente ${call.patientName}. ${room}`.trim()
}

export function CallPanelPage(): React.JSX.Element {
  const navigate = useNavigate()
  // Se houver usuário logado na sessão, é porque o painel foi aberto na
  // janela principal por engano (clicar no menu antigo). Mostramos botão
  // "Voltar ao sistema" para o operador sair daqui. Na janela secundária
  // do painel (que abre via panel.open) não há sessão logada — botão some.
  const sessionUser = useAuth((s) => s.user)
  const [calls, setCalls] = useState<PatientCall[]>([])
  const [now, setNow] = useState(() => new Date())
  const [voicesReady, setVoicesReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [flashKey, setFlashKey] = useState<number | null>(null)
  const lastAnnouncedIdRef = useRef<number | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      const recent = await window.api.calls.recent(8)
      setCalls(recent)
      if (recent.length > 0 && lastAnnouncedIdRef.current === null) {
        // Não anuncia a primeira carga ao abrir — evita surpresa.
        lastAnnouncedIdRef.current = recent[0].id
      }
    } catch {
      // painel é público e resiliente; silêncio aqui é ok
    }
  }, [])

  useEffect(() => {
    void load()
    const pollId = setInterval(() => void load(), 5000)
    const clockId = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(pollId)
      clearInterval(clockId)
    }
  }, [load])

  // Garante que getVoices() já populou (Chrome carrega async).
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const update = (): void => setVoicesReady(window.speechSynthesis.getVoices().length > 0)
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  // Escuta eventos em tempo real vindos do main process.
  useEffect(() => {
    if (!window.api?.calls?.onNewCall) return
    const off = window.api.calls.onNewCall((call) => {
      setCalls((prev) => {
        const exists = prev.some((c) => c.id === call.id)
        if (exists) return prev
        return [call, ...prev].slice(0, 8)
      })
      if (!muted) announce(call)
      setFlashKey(call.id)
      lastAnnouncedIdRef.current = call.id
    })
    return () => {
      off()
      cancelPendingAnnounce()
    }
  }, [muted])

  // Se o polling descobriu chamada nova que não veio pelo IPC (ex.: painel em
  // outra janela/máquina), anuncia também.
  useEffect(() => {
    if (calls.length === 0) return
    const newest = calls[0]
    if (lastAnnouncedIdRef.current !== null && newest.id > lastAnnouncedIdRef.current) {
      if (!muted) announce(newest)
      setFlashKey(newest.id)
      lastAnnouncedIdRef.current = newest.id
    }
  }, [calls, muted])

  // Quando o usuário silencia, cancela qualquer voz pendente entre o sino e a fala.
  useEffect(() => {
    if (muted) cancelPendingAnnounce()
  }, [muted])

  const current = calls[0] ?? null
  const history = useMemo(() => calls.slice(1, 5), [calls])

  const timeNow = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const dateNow = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const primary =
    (typeof document !== 'undefined' &&
      getComputedStyle(document.documentElement).getPropertyValue('--color-ubs-primary').trim()) ||
    PRIMARY_FALLBACK

  return (
    <div
      className="call-panel relative flex h-full flex-col overflow-hidden text-white"
      style={{
        background: `
          radial-gradient(60% 50% at 0% 0%, ${primary}55 0%, transparent 55%),
          radial-gradient(55% 45% at 100% 100%, ${primary}33 0%, transparent 50%),
          linear-gradient(180deg, #0a1a24 0%, #050e15 100%)
        `
      }}
    >
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={52} tone="light" />
          <div className="leading-tight">
            <div className="text-xl font-semibold tracking-tight">Gestão Hospitalar</div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
              Painel de chamada
            </div>
          </div>
          {sessionUser ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="ml-4 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/85 ring-1 ring-white/20 transition hover:bg-white/20 hover:text-white"
              title="Voltar para o sistema"
            >
              ← Voltar ao sistema
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-3xl font-semibold tabular-nums tracking-tight">{timeNow}</div>
            <div className="text-xs text-white/60 first-letter:uppercase">{dateNow}</div>
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/80 ring-1 ring-white/15 transition hover:bg-white/15 hover:text-white"
            title="Silenciar / reativar voz"
          >
            {muted ? '🔇 Voz desligada' : '🔊 Voz ligada'}
          </button>
          {!voicesReady ? (
            <span className="rounded-md bg-amber-500/20 px-2 py-1 text-[11px] text-amber-200">
              Vozes carregando…
            </span>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-12">
        {current ? (
          <div
            key={flashKey ?? 'current'}
            className="call-panel-current w-full max-w-5xl animate-call-burst text-center"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
              Chamando agora
            </div>
            <h1 className="mt-4 text-[6.5vw] font-bold leading-none tracking-tight text-white drop-shadow-[0_4px_30px_rgba(14,116,144,0.45)]">
              {current.patientName}
            </h1>
            <div className="mt-6 inline-flex items-center gap-4 rounded-2xl bg-white/10 px-8 py-4 ring-1 ring-white/20 backdrop-blur">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Dirija-se ao
              </span>
              <span className="text-3xl font-semibold tracking-tight" style={{ color: '#e0f7ff' }}>
                {current.room}
              </span>
            </div>
            <div className="mt-4 text-xs text-white/55">
              Chamado às {formatTimeBr(current.calledAt)}
              {current.calledByName ? ` por ${current.calledByName}` : ''}
            </div>
          </div>
        ) : (
          <div className="max-w-xl text-center text-white/70">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
              Nenhuma chamada recente
            </div>
            <p className="mt-4 text-2xl leading-snug">
              Aguarde a próxima chamada. O painel atualiza automaticamente assim que um profissional
              convocar o próximo paciente.
            </p>
          </div>
        )}
      </main>

      {history.length > 0 ? (
        <footer className="px-10 py-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Chamadas anteriores
            </div>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {history.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10 backdrop-blur"
                >
                  <div className="truncate text-base font-semibold text-white">{c.patientName}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                    <span className="truncate">{c.room}</span>
                    <span className="tabular-nums">{formatTimeBr(c.calledAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
