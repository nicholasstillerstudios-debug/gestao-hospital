/**
 * Assistente de configuração inicial (3 passos):
 *   1. Como este computador vai funcionar? (standalone / servidor / cliente)
 *   2. Detalhes (porta se servidor, URL+teste se cliente)
 *   3. Resumo + Reiniciar
 *
 * Acessível em /setup sem autenticação. Auto-aberto na 1ª execução.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/Button'
import { Field, Input } from '@renderer/components/ui/Field'
import { BrandLogo } from '@renderer/components/BrandLogo'
import { RUN_MODE_LABELS, type RunMode } from '@shared/types'

type Step = 1 | 2 | 3

const MODE_HINT: Record<RunMode, string> = {
  standalone:
    'Apenas este computador usa o sistema. Os dados ficam aqui no SQLite local. Indicado para clínicas pequenas com 1 PC.',
  server:
    'Este computador será o SERVIDOR — guarda o banco e compartilha com as estações da rede (recepção, consultório etc.).',
  client:
    'Este computador será uma ESTAÇÃO — não guarda dados, conecta no servidor da LAN. Use no PC da recepção, consultório etc.'
}

export function SetupPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [runMode, setRunMode] = useState<RunMode>('standalone')
  const [serverPort, setServerPort] = useState(7321)
  const [serverUrl, setServerUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstRun, setFirstRun] = useState(false)

  useEffect(() => {
    void window.api.client.getBoot().then((b) => {
      setRunMode(b.runMode)
      if (b.serverPort) setServerPort(b.serverPort)
      if (b.serverUrl) setServerUrl(b.serverUrl)
      setFirstRun(!!b.firstRun)
    })
  }, [])

  const canAdvance = useMemo(() => {
    if (step === 1) return true
    if (step === 2) {
      if (runMode === 'standalone') return true
      if (runMode === 'server') return serverPort >= 1024 && serverPort <= 65535
      if (runMode === 'client') return serverUrl.trim().length > 0 && testResult?.ok === true
    }
    return true
  }, [step, runMode, serverPort, serverUrl, testResult])

  const test = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await window.api.client.ping(serverUrl)
      setTestResult(
        r.ok
          ? { ok: true, msg: `Conectado ao servidor versão ${r.version ?? '?'}.` }
          : { ok: false, msg: r.error ?? 'Sem resposta.' }
      )
    } finally {
      setTesting(false)
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await window.api.client.setBoot({
        runMode,
        serverPort,
        serverUrl: runMode === 'client' ? serverUrl.trim() : undefined
      })
      setStep(3)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-lg">
        <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <BrandLogo size={36} />
          <div>
            <div className="text-base font-semibold text-slate-800">
              {firstRun ? 'Primeira configuração' : 'Assistente de rede'}
            </div>
            <div className="text-xs text-slate-500">
              Passo {step} de 3 — defina como este computador vai funcionar
            </div>
          </div>
        </header>

        <div className="px-6 py-5">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Escolha o papel deste computador. Você pode mudar depois em <em>Admin → Rede</em>.
              </p>
              <div className="space-y-2">
                {(Object.keys(RUN_MODE_LABELS) as RunMode[]).map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                      runMode === m
                        ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="runMode"
                      checked={runMode === m}
                      onChange={() => setRunMode(m)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">{RUN_MODE_LABELS[m]}</div>
                      <div className="text-xs text-slate-600">{MODE_HINT[m]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-3">
              {runMode === 'standalone' ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Nada a configurar. O banco fica em
                  <code className="ml-1 rounded bg-white px-1 py-0.5 font-mono text-xs">
                    %APPDATA%\Gestão Hospitalar\gestao-hospital.db
                  </code>
                  .
                </div>
              ) : runMode === 'server' ? (
                <>
                  <Field
                    label="Porta TCP"
                    required
                    hint="Padrão 7321. Libere no firewall do Windows."
                  >
                    <Input
                      type="number"
                      min={1024}
                      max={65535}
                      value={serverPort}
                      onChange={(e) => setServerPort(Number(e.target.value) || 7321)}
                    />
                  </Field>
                  <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                    As estações vão se conectar em{' '}
                    <code className="rounded bg-cyan-100 px-1">
                      http://[IP-deste-PC]:{serverPort}
                    </code>
                    . Descubra o IP com <em>ipconfig</em> (cmd) ou nas Configurações de Rede.
                    Recomenda-se reservar IP fixo no roteador.
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="URL do servidor"
                    required
                    hint="Ex.: http://192.168.1.10:7321 — pergunte ao TI a porta usada."
                  >
                    <Input
                      value={serverUrl}
                      onChange={(e) => {
                        setServerUrl(e.target.value)
                        setTestResult(null)
                      }}
                      placeholder="http://IP-do-servidor:7321"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void test()}
                      disabled={testing || !serverUrl.trim()}
                    >
                      {testing ? 'Testando…' : 'Testar conexão'}
                    </Button>
                    {testResult ? (
                      <span
                        className={`text-xs ${testResult.ok ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {testResult.ok ? '✓' : '✗'} {testResult.msg}
                      </span>
                    ) : null}
                  </div>
                  {testResult && !testResult.ok ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                      Não consegui falar com o servidor. Verifique se ele está ligado e em modo
                      Servidor, se a porta está liberada no firewall do Windows, e se você está na
                      mesma rede.
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                <strong>Configuração salva.</strong> Feche e abra o app novamente para que o novo
                modo entre em vigor.
              </div>
              <ul className="ml-5 list-disc text-xs text-slate-600">
                <li>Modo: <strong>{RUN_MODE_LABELS[runMode]}</strong></li>
                {runMode === 'server' ? <li>Porta: {serverPort}</li> : null}
                {runMode === 'client' ? <li>Servidor: {serverUrl}</li> : null}
              </ul>
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 1) navigate('/login')
              else setStep((s) => (s - 1) as Step)
            }}
            disabled={saving}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 2) void save()
                else setStep((s) => (s + 1) as Step)
              }}
              disabled={!canAdvance || saving}
            >
              {step === 2 ? (saving ? 'Salvando…' : 'Salvar') : 'Avançar'}
            </Button>
          ) : (
            <Button onClick={() => navigate('/login')}>Concluir</Button>
          )}
        </footer>
      </div>
    </div>
  )
}
