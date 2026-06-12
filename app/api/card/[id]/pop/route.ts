/**
 * GET /api/card/[id]/pop?name=Charizard
 *
 * Returns population report data for a card.
 * Population data is stored in the search_cache table under psa_population,
 * bgs_population, and cgc_population JSON fields (populated by the main card endpoint).
 *
 * Falls back gracefully if no pop data is available.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const name = req.nextUrl.searchParams.get('name') ?? ''

  const supabase = adminClient()

  // Try to find pop data from any cached grade for this card
  const { data: rows } = await supabase
    .from('search_cache')
    .select('psa_population, bgs_population, cgc_population, card_name')
    .eq('card_id', id)
    .not('psa_population', 'is', null)
    .limit(1)

  const row = rows?.[0]

  if (!row) {
    return NextResponse.json({
      data: {
        card_id:   id,
        card_name: name,
        grades:    [],
        fetched_at: null,
      }
    })
  }

  // Build a flat grades array from all population dicts
  const grades: { grade: string; population: number; grader: string }[] = []

  const psaPop = row.psa_population as Record<string, number> | null
  const bgsPop = row.bgs_population as Record<string, number> | null
  const cgcPop = row.cgc_population as Record<string, number> | null

  if (psaPop) {
    for (const [grade, pop] of Object.entries(psaPop)) {
      grades.push({ grade, population: pop, grader: 'PSA' })
    }
  }
  if (bgsPop) {
    for (const [grade, pop] of Object.entries(bgsPop)) {
      grades.push({ grade, population: pop, grader: 'BGS' })
    }
  }
  if (cgcPop) {
    for (const [grade, pop] of Object.entries(cgcPop)) {
      grades.push({ grade, population: pop, grader: 'CGC' })
    }
  }

  return NextResponse.json({
    data: {
      card_id:    id,
      card_name:  row.card_name ?? name,
      grades,
      fetched_at: new Date().toISOString(),
    }
  })
}
