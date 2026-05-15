import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import { AuthShell } from '@renderer/components/AuthShell'

export function LoginPage(): React.JSX.Element {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (user) {
    if (user.mustChangePassword) {
      return <Navigate to="/trocar-senha" replace />
    }
    return <Navigate to="/" replace />
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(username, password)
      if (result.mustChangePassword) {
        navigate('/trocar-senha', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre com suas credenciais para acessar o sistema."
    >
      <form onSubmit={submit} className="auth-card flex flex-col gap-4" noValidate>
        <label className="auth-input-group">
          <span className="auth-input-label">Usuário</span>
          <span className="auth-input-control">
            <span className="auth-input-icon" aria-hidden>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="auth-input"
              placeholder="seu.usuario"
            />
          </span>
        </label>

        <label className="auth-input-group">
          <span className="auth-input-label">Senha</span>
          <span className="auth-input-control">
            <span className="auth-input-icon" aria-hidden>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="auth-input-toggle"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.5 6.3A9.7 9.7 0 0 1 12 6c5 0 9 4 10 6-.4.8-1.3 2.2-2.7 3.5" />
                  <path d="M6.6 6.6C4.6 8 3.4 9.7 2.7 11c.9 1.7 4.3 7 9.3 7 1.3 0 2.5-.3 3.5-.7" />
                  <path d="M9.5 9.5a3 3 0 0 0 4 4" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M2.5 12C4 8.5 7.5 6 12 6s8 2.5 9.5 6c-1.5 3.5-5 6-9.5 6S4 15.5 2.5 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            className="auth-error animate-fade-in-up flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-4 w-4 flex-none"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <span className="leading-relaxed">{error}</span>
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden />
              <span>Entrando…</span>
            </>
          ) : (
            <>
              <span>Entrar</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        <p className="mt-1 text-center text-[11px] text-[var(--app-text-muted)]">
          Primeiro acesso? Use{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
            admin
          </code>{' '}
          /{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
            admin123
          </code>
          . Você será obrigado a trocar a senha no próximo login.
        </p>

        <p className="mt-2 text-center text-[11px]">
          <a
            href="#/setup"
            className="font-medium text-cyan-700 hover:text-cyan-800 hover:underline"
          >
            Configurar conexão de rede (LAN)
          </a>
        </p>
      </form>
    </AuthShell>
  )
}
