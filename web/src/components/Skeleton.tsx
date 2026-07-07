import type { CSSProperties } from 'react'

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: 'var(--card2)', ...style }}
    />
  )
}

/** Skeleton do Dashboard: KPIs + gráfico. */
export function DashboardSkeleton() {
  return (
    <div className="p-4">
      <Skeleton className="mb-1 h-7 w-40" />
      <Skeleton className="mb-4 h-3 w-32" />
      <Skeleton className="mb-3 h-24 w-full rounded-2xl" />
      <div className="mb-3 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}

/** Skeleton genérico de lista: N cards retangulares empilhados. */
export function ListSkeleton({ rows = 4, rowHeight = 88 }: { rows?: number; rowHeight?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="mb-1 h-7 w-32" />
      <Skeleton className="mb-2 h-3 w-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-2xl" style={{ height: rowHeight }} />
      ))}
    </div>
  )
}
