import type React from 'react'
import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '@shared/ipc'

/**
 * Banner fixo no rodapé que reage ao estado do auto-updater.
 *
 * - Esconde-se em estados sem ação do usuário (idle, checking, not-available).
 * - Em "downloading", mostra progresso.
 * - Em "downloaded", mostra botão "Reiniciar agora".
 * - Em "error", mostra mensagem discreta com botão "Tentar de novo".
 */
export function UpdateBanner(): React.JSX.Element | null {
  const [state, setState] = useState<UpdaterStatus>({ kind: 'idle' })

  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    const init = async (): Promise<void> => {
      try {
        const initial = await window.api.updater.state()
        if (!cancelled) setState(initial)
      } catch {
        // ignore
      }
      if (cancelled) return
      unsub = window.api.updater.onState((s) => setState(s))
    }
    void init()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [])

  const dismissable = state.kind === 'error' || state.kind === 'not-available'
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    setDismissed(false)
  }, [state.kind])

  if (state.kind === 'idle' || state.kind === 'checking' || state.kind === 'not-available') {
    return null
  }
  if (dismissed && dismissable) return null

  if (state.kind === 'available') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cyan-700/30 bg-cyan-50 px-4 py-2 text-sm text-cyan-900 shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span>Nova versão disponível ({state.version}). Baixando em segundo plano…</span>
        </div>
      </div>
    )
  }

  if (state.kind === 'downloading') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cyan-700/30 bg-cyan-50 px-4 py-2 text-sm text-cyan-900 shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="shrink-0">Baixando atualização…</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-cyan-200">
            <div
              className="h-full bg-cyan-700 transition-[width]"
              style={{ width: `${Math.round(state.percent)}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-xs text-cyan-800">
            {Math.round(state.percent)}%
          </span>
        </div>
      </div>
    )
  }

  if (state.kind === 'downloaded') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-700/30 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span>
            Atualização <strong>{state.version}</strong> pronta. Reinicie para aplicar.
          </span>
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
            onClick={() => {
              void window.api.updater.quitAndInstall()
            }}
          >
            Reiniciar agora
          </button>
        </div>
      </div>
    )
  }

  // error
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-700/30 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <span className="truncate">Não foi possível verificar atualizações: {state.message}</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-800"
            onClick={() => {
              void window.api.updater.check()
            }}
          >
            Tentar de novo
          </button>
          <button
            type="button"
            className="rounded-md bg-transparent px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
            onClick={() => setDismissed(true)}
          >
            Dispensar
          </button>
        </div>
      </div>
    </div>
  )
}
