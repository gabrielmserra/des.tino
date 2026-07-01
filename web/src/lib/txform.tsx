import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Transaction } from './types'

type TxFormState = { mode: 'new' } | { mode: 'edit'; tx: Transaction } | null

type TxFormContextValue = {
  state: TxFormState
  openNew: () => void
  openEdit: (tx: Transaction) => void
  close: () => void
}

const Ctx = createContext<TxFormContextValue | undefined>(undefined)

export function TxFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TxFormState>(null)
  return (
    <Ctx.Provider
      value={{
        state,
        openNew: () => setState({ mode: 'new' }),
        openEdit: (tx) => setState({ mode: 'edit', tx }),
        close: () => setState(null),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTxForm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTxForm precisa estar dentro de <TxFormProvider>')
  return ctx
}
