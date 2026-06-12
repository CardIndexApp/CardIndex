import Navbar from '@/components/Navbar'
import ToolsClient from './ToolsClient'

export const metadata = {
  title: 'Tools — CardIndex',
  description: 'Fee calculator, ROI calculator, and grading ROI calculator for Pokémon card trading.',
}

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px 0' }}>
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Tools</p>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>Calculators</h1>
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>
          <ToolsClient />
        </div>
      </main>
    </>
  )
}
