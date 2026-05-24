// ISR: re-generate card pages at most every 10 minutes.
// The actual price data is fetched client-side; this only affects
// OG metadata freshness and server HTML delivery time.
export const revalidate = 600

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
