import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import { AuthShell } from '@renderer/components/AuthShell'

export function ChangePasswordPage(): React.JSX.Element {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirm) {
      setError('A confirmação não confere.')
      return
    }
    setLoading(true)
    try {
      await changePassword(oldPassword, newPassword)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Trocar senha"
      subtitle={
        user.mustChangePassword
          ? 'Por segurança, defina uma nova senha antes de continuar.'
          : 'Escolha uma nova senha para o seu usuário.'
      }
    >
      <form onSubmit={submit} className="auth-card flex flex-col gap-4" noValidate>
        <label className="auth-input-group">
          <span className="auth-input-label">Senha atual</span>
          <span className="auth-input-control">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="auth-input"
              autoFocus
            />
          </span>
        </label>
        <label className="auth-input-group">
          <span className="auth-input-label">Nova senha</span>
          <span className="auth-input-control">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="auth-input"
            />
          </span>
          <span className="auth-input-hint">Mínimo de 6 caracteres.</span>
        </label>
        <label className="auth-input-group">
          <span className="auth-input-label">Confirmar nova senha</span>
          <span className="auth-input-control">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="auth-input"
            />
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
              <span>Salvando…</span>
            </>
          ) : (
            <span>Atualizar senha</span>
          )}
        </button>
      </form>
    </AuthShell>
  )
}
