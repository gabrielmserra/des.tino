import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMonths } from './api'
import type { Month } from './types'

type MonthContextValue = {
  months: Month[]
  selected: Month | null
  selectedId: number | null
  setSelectedId: (id: number | null) => void
  loading: boolean
}

const MonthContext = createContext<MonthContextValue | undefined>(undefined)

export function MonthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ['months'], queryFn: fetchMonths })
  const months = data ?? []
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    // Também se auto-corrige se o mês selecionado foi excluído (deixou de
    // existir na lista) — cai pro primeiro mês restante automaticamente.
    const stillExists = selectedId != null && months.some((m) => m.id === selectedId)
    if (!stillExists && months.length > 0) {
      setSelectedId(months[0].id)
    }
  }, [months, selectedId])

  const selected = months.find((m) => m.id === selectedId) ?? null

  return (
    <MonthContext.Provider
      value={{ months, selected, selectedId, setSelectedId, loading: isLoading }}
    >
      {children}
    </MonthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMonths() {
  const ctx = useContext(MonthContext)
  if (!ctx) throw new Error('useMonths precisa estar dentro de <MonthProvider>')
  return ctx
}
