/**
 * Autocomplete reutilizável para catálogos oficiais (CID-10 / SIGTAP / CIAP-2).
 * Mostra code + name; ao selecionar dispara onPick(code, name).
 * Busca tolerante a acentos (handler de busca já normaliza no backend).
 */
import { useEffect, useRef, useState } from 'react'
import { Input } from '@renderer/components/ui/Field'

type Catalog = 'cid10' | 'sigtap' | 'ciap2'

interface Item {
  code: string
  name: string
}

interface Props {
  catalog: Catalog
  value: string
  onChange: (code: string) => void
  onPick?: (code: string, name: string) => void
  placeholder?: string
  className?: string
}

async function search(cat: Catalog, q: string): Promise<Item[]> {
  if (cat === 'cid10') return await window.api.catalogs.searchCid10(q, 15)
  if (cat === 'sigtap') return await window.api.catalogs.searchSigtap(q, 15)
  return await window.api.catalogs.searchCiap2(q, 15)
}

export function CodePicker({
  catalog,
  value,
  onChange,
  onPick,
  placeholder,
  className
}: Props): React.JSX.Element {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const r = await search(catalog, query.trim())
        if (!cancelled) setResults(r)
      } catch {
        if (!cancelled) setResults([])
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [catalog, query, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Digite código ou nome…'}
      />
      {open && results.length > 0 ? (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-lg">
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-cyan-50"
              onClick={() => {
                setQuery(r.code)
                onChange(r.code)
                onPick?.(r.code, r.name)
                setOpen(false)
              }}
            >
              <span className="font-mono text-xs text-slate-700">{r.code}</span>{' '}
              <span className="text-slate-600">— {r.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
