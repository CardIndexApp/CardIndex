import type { Metadata } from 'next'

// Search results are fetched entirely client-side — static shell is fine.
export const revalidate = 3600
export const metadata: Metadata = { title: 'Search' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
