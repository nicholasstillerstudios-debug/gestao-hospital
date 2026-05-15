import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Atalhos globais. Os listeners são registrados no document e ignorados quando
 * o foco está em campos editáveis para não atrapalhar a digitação.
 *
 *  - Ctrl/Cmd + K  → busca de pacientes (navega para /pacientes e foca o campo)
 *  - Ctrl/Cmd + N  → novo paciente (/pacientes/novo)
 *  - Ctrl/Cmd + B  → backup / administração (/admin/backup)
 *  - Esc           → não capturado aqui (cada modal trata internamente)
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate()

  useEffect(() => {
    const focusSearch = (): void => {
      const el = document.querySelector<HTMLInputElement>('[data-shortcut="patient-search"]')
      if (el) {
        el.focus()
        el.select()
      }
    }

    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable === true

      const ctrlOrMeta = e.ctrlKey || e.metaKey

      if (ctrlOrMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // se já está em /pacientes apenas foca; senão navega e foca após render
        if (window.location.hash.includes('/pacientes')) {
          focusSearch()
        } else {
          navigate('/pacientes')
          setTimeout(focusSearch, 80)
        }
        return
      }

      if (ctrlOrMeta && e.key.toLowerCase() === 'n' && !editable) {
        e.preventDefault()
        navigate('/pacientes/novo')
        return
      }

      if (ctrlOrMeta && e.key.toLowerCase() === 'b' && !editable) {
        e.preventDefault()
        navigate('/admin/backup')
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [navigate])
}
