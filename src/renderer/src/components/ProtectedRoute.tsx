import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@renderer/stores/auth'
import type { UserRole } from '@shared/types'

interface Props {
  roles?: UserRole[]
  children: React.ReactNode
}

export function ProtectedRoute({ roles, children }: Props): React.JSX.Element {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Carregando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg bg-white p-8 text-center shadow ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Acesso negado</h2>
          <p className="mt-1 text-sm text-slate-500">
            Seu perfil não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
