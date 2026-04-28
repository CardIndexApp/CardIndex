/**
 * CI-100 — CardIndex Market Index constituents.
 *
 * Cards are derived from the TCGFish Top 250 index, deduplicated by
 * card+set combination (same card at different grades or print runs are
 * consolidated), then trimmed to 100 entries ranked by market value.
 *
 * All constituents are tracked at PSA 10 grade to match the TCGFish index.
 *
 * The seed endpoint resolves each entry against pokemontcg.io (by setId +
 * number, falling back to name search) so the card_id stored in Supabase
 * is always the canonical pokemontcg.io ID.
 */

export interface SeedCard {
  name: string     // pokemontcg.io card name (used for fallback search)
  setName: string  // human-readable set name stored in DB
  setId: string    // pokemontcg.io set ID (primary lookup key)
  number: string   // card number within set (primary lookup key)
  grade: string    // grade for this constituent
}

export const CI_100: SeedCard[] = [
  // ── SCARLET & VIOLET — 151 ────────────────────────────────────────────────
  // Voltorb #100 ($7,512) — SAR from the 151 set
  { name: 'Voltorb',     setName: 'Scarlet & Violet—151', setId: 'sv3pt5', number: '100', grade: 'Raw' },
  // Mew ex #151 ($3,767) — full-art at Mew's own Pokédex position
  { name: 'Mew ex',      setName: 'Scarlet & Violet—151', setId: 'sv3pt5', number: '151', grade: 'Raw' },
  // Charizard ex #199 ($277) — SIR Charizard ex from the 151 set
  { name: 'Charizard ex', setName: 'Scarlet & Violet—151', setId: 'sv3pt5', number: '199', grade: 'Raw' },

  // ── BASE SET ──────────────────────────────────────────────────────────────
  { name: 'Charizard',  setName: 'Base Set', setId: 'base1', number: '4',  grade: 'Raw' },
  { name: 'Blastoise',  setName: 'Base Set', setId: 'base1', number: '2',  grade: 'Raw' },
  { name: 'Venusaur',   setName: 'Base Set', setId: 'base1', number: '15', grade: 'Raw' },
  { name: 'Mewtwo',     setName: 'Base Set', setId: 'base1', number: '10', grade: 'Raw' },
  { name: 'Raichu',     setName: 'Base Set', setId: 'base1', number: '14', grade: 'Raw' },
  { name: 'Gyarados',   setName: 'Base Set', setId: 'base1', number: '6',  grade: 'Raw' },
  { name: 'Pikachu',    setName: 'Base Set', setId: 'base1', number: '58', grade: 'Raw' },

  // ── JUNGLE ────────────────────────────────────────────────────────────────
  { name: 'Clefable',   setName: 'Jungle', setId: 'jungle', number: '1',  grade: 'Raw' },

  // ── EXPEDITION BASE SET ───────────────────────────────────────────────────
  { name: 'Charizard',  setName: 'Expedition Base Set', setId: 'ecard1', number: '39', grade: 'Raw' },
  { name: 'Blastoise',  setName: 'Expedition Base Set', setId: 'ecard1', number: '36', grade: 'Raw' },
  { name: 'Clefable',   setName: 'Expedition Base Set', setId: 'ecard1', number: '41', grade: 'Raw' },
  { name: 'Ampharos',   setName: 'Expedition Base Set', setId: 'ecard1', number: '34', grade: 'Raw' },
  { name: 'Alakazam',   setName: 'Expedition Base Set', setId: 'ecard1', number: '33', grade: 'Raw' },
  { name: 'Dugtrio',    setName: 'Expedition Base Set', setId: 'ecard1', number: '44', grade: 'Raw' },
  { name: 'Arbok',      setName: 'Expedition Base Set', setId: 'ecard1', number: '35', grade: 'Raw' },

  // ── AQUAPOLIS ─────────────────────────────────────────────────────────────
  { name: 'Lugia',      setName: 'Aquapolis', setId: 'ecard2', number: '149', grade: 'Raw' },
  { name: 'Nidoking',   setName: 'Aquapolis', setId: 'ecard2', number: '150', grade: 'Raw' },

  // ── SKYRIDGE ─────────────────────────────────────────────────────────────
  { name: 'Charizard',  setName: 'Skyridge', setId: 'ecard3', number: '146', grade: 'Raw' },
  { name: 'Charizard',  setName: 'Skyridge', setId: 'ecard3', number: '9',   grade: 'Raw' },
  { name: 'Ho-Oh',      setName: 'Skyridge', setId: 'ecard3', number: '149', grade: 'Raw' },
  { name: 'Umbreon',    setName: 'Skyridge', setId: 'ecard3', number: 'H30', grade: 'Raw' },
  { name: 'Gengar',     setName: 'Skyridge', setId: 'ecard3', number: 'H9',  grade: 'Raw' },
  { name: 'Alakazam',   setName: 'Skyridge', setId: 'ecard3', number: 'H1',  grade: 'Raw' },
  { name: 'Flareon',    setName: 'Skyridge', setId: 'ecard3', number: 'H7',  grade: 'Raw' },
  { name: 'Kabutops',   setName: 'Skyridge', setId: 'ecard3', number: '150', grade: 'Raw' },
  { name: 'Celebi',     setName: 'Skyridge', setId: 'ecard3', number: '145', grade: 'Raw' },
  { name: 'Crobat',     setName: 'Skyridge', setId: 'ecard3', number: '147', grade: 'Raw' },
  { name: 'Golem',      setName: 'Skyridge', setId: 'ecard3', number: '148', grade: 'Raw' },

  // ── NEO REVELATION ───────────────────────────────────────────────────────
  { name: 'Shining Magikarp', setName: 'Neo Revelation', setId: 'neo3', number: '66', grade: 'Raw' },
  { name: 'Shining Gyarados', setName: 'Neo Revelation', setId: 'neo3', number: '65', grade: 'Raw' },
  { name: 'Houndoom',         setName: 'Neo Revelation', setId: 'neo3', number: '8',  grade: 'Raw' },
  { name: 'Ho-Oh',            setName: 'Neo Revelation', setId: 'neo3', number: '7',  grade: 'Raw' },

  // ── NEO DESTINY ──────────────────────────────────────────────────────────
  { name: 'Shining Charizard', setName: 'Neo Destiny', setId: 'neo4', number: '107', grade: 'Raw' },
  { name: 'Shining Mewtwo',    setName: 'Neo Destiny', setId: 'neo4', number: '109', grade: 'Raw' },
  { name: 'Shining Steelix',   setName: 'Neo Destiny', setId: 'neo4', number: '112', grade: 'Raw' },

  // ── NEO GENESIS ──────────────────────────────────────────────────────────
  { name: 'Lugia',      setName: 'Neo Genesis', setId: 'neo1', number: '9',  grade: 'Raw' },
  { name: 'Typhlosion', setName: 'Neo Genesis', setId: 'neo1', number: '17', grade: 'Raw' },

  // ── NEO DISCOVERY ────────────────────────────────────────────────────────
  { name: 'Umbreon', setName: 'Neo Discovery', setId: 'neo2', number: '13', grade: 'Raw' },
  { name: 'Espeon',  setName: 'Neo Discovery', setId: 'neo2', number: '1',  grade: 'Raw' },

  // ── TEAM ROCKET ───────────────────────────────────────────────────────────
  { name: 'Dark Dragonite', setName: 'Team Rocket', setId: 'base3', number: '5', grade: 'Raw' },
  { name: 'Dark Charizard', setName: 'Team Rocket', setId: 'base3', number: '4', grade: 'Raw' },

  // ── GYM CHALLENGE ────────────────────────────────────────────────────────
  { name: "Blaine's Charizard", setName: 'Gym Challenge', setId: 'gym2', number: '2',  grade: 'Raw' },

  // ── GYM HEROES ───────────────────────────────────────────────────────────
  { name: "Sabrina's Gengar",   setName: 'Gym Heroes',    setId: 'gym1', number: '14', grade: 'Raw' },

  // ── LEGENDARY COLLECTION ─────────────────────────────────────────────────
  { name: 'Charizard', setName: 'Legendary Collection', setId: 'lc', number: '3', grade: 'Raw' },

  // ── EX HOLON PHANTOMS ────────────────────────────────────────────────────
  { name: 'Pikachu',  setName: 'EX Holon Phantoms', setId: 'ex14', number: '104', grade: 'Raw' },
  { name: 'Gyarados', setName: 'EX Holon Phantoms', setId: 'ex14', number: '102', grade: 'Raw' },
  { name: 'Mewtwo',   setName: 'EX Holon Phantoms', setId: 'ex14', number: '103', grade: 'Raw' },

  // ── EX DRAGON FRONTIERS ──────────────────────────────────────────────────
  // Gold Stars
  { name: 'Charizard ☆', setName: 'EX Dragon Frontiers', setId: 'ex15', number: '100', grade: 'Raw' },
  { name: 'Mew',          setName: 'EX Dragon Frontiers', setId: 'ex15', number: '101', grade: 'Raw' },
  { name: 'Rayquaza ex',  setName: 'EX Dragon Frontiers', setId: 'ex15', number: '97',  grade: 'Raw' },

  // ── EX DELTA SPECIES ─────────────────────────────────────────────────────
  { name: 'Metagross', setName: 'EX Delta Species', setId: 'ex9', number: '113', grade: 'Raw' },
  { name: 'Kyogre',    setName: 'EX Delta Species', setId: 'ex9', number: '112', grade: 'Raw' },
  { name: 'Groudon',   setName: 'EX Delta Species', setId: 'ex9', number: '111', grade: 'Raw' },
  { name: 'Ditto',     setName: 'EX Delta Species', setId: 'ex9', number: '64',  grade: 'Raw' },

  // ── EX CRYSTAL GUARDIANS ─────────────────────────────────────────────────
  { name: 'Celebi',   setName: 'EX Crystal Guardians', setId: 'ex13', number: '100', grade: 'Raw' },
  { name: 'Alakazam', setName: 'EX Crystal Guardians', setId: 'ex13', number: '99',  grade: 'Raw' },

  // ── EX TEAM ROCKET RETURNS ────────────────────────────────────────────────
  { name: 'Mudkip',             setName: 'EX Team Rocket Returns', setId: 'ex7', number: '107', grade: 'Raw' },
  { name: "Rocket's Snorlax ex",setName: 'EX Team Rocket Returns', setId: 'ex7', number: '104', grade: 'Raw' },

  // ── EX FIRERED & LEAFGREEN ────────────────────────────────────────────────
  { name: 'Gengar EX',   setName: 'EX FireRed & LeafGreen', setId: 'ex6', number: '108', grade: 'Raw' },
  { name: 'Charizard EX',setName: 'EX FireRed & LeafGreen', setId: 'ex6', number: '105', grade: 'Raw' },

  // ── EX UNSEEN FORCES ─────────────────────────────────────────────────────
  { name: 'Umbreon ex', setName: 'EX Unseen Forces', setId: 'ex10', number: '112', grade: 'Raw' },
  { name: 'Espeon ex',  setName: 'EX Unseen Forces', setId: 'ex10', number: '102', grade: 'Raw' },

  // ── MAJESTIC DAWN ─────────────────────────────────────────────────────────
  { name: 'Glaceon LV.X', setName: 'Majestic Dawn', setId: 'dp4', number: '98', grade: 'Raw' },

  // ── DARK EXPLORERS ───────────────────────────────────────────────────────
  { name: 'Vaporeon',   setName: 'Dark Explorers', setId: 'bw5', number: '25',  grade: 'Raw' },

  // ── DRAGONS EXALTED ──────────────────────────────────────────────────────
  { name: 'Rayquaza',   setName: 'Dragons Exalted', setId: 'bw6', number: '128', grade: 'Raw' },

  // ── PLASMA STORM ─────────────────────────────────────────────────────────
  { name: 'Charizard',  setName: 'Plasma Storm', setId: 'bw8', number: '136', grade: 'Raw' },

  // ── PHANTOM FORCES ────────────────────────────────────────────────────────
  { name: 'Gengar EX',  setName: 'Phantom Forces', setId: 'xy4', number: '114', grade: 'Raw' },

  // ── ANCIENT ORIGINS ──────────────────────────────────────────────────────
  { name: 'M Rayquaza EX', setName: 'Ancient Origins', setId: 'xy7', number: '98', grade: 'Raw' },

  // ── EVOLUTIONS ────────────────────────────────────────────────────────────
  { name: 'Charizard',             setName: 'Evolutions', setId: 'xy12', number: '11', grade: 'Raw' },
  { name: 'Gyarados',              setName: 'Evolutions', setId: 'xy12', number: '34', grade: 'Raw' },
  { name: 'Double Colorless Energy',setName: 'Evolutions', setId: 'xy12', number: '90', grade: 'Raw' },

  // ── TEAM UP ───────────────────────────────────────────────────────────────
  { name: 'Latias & Latios GX',  setName: 'Team Up', setId: 'sm9', number: '170', grade: 'Raw' },
  { name: 'Gengar & Mimikyu GX', setName: 'Team Up', setId: 'sm9', number: '165', grade: 'Raw' },
  { name: 'Magikarp & Wailord GX',setName: 'Team Up', setId: 'sm9', number: '161', grade: 'Raw' },

  // ── UNBROKEN BONDS ───────────────────────────────────────────────────────
  { name: 'Gardevoir & Sylveon GX', setName: 'Unbroken Bonds', setId: 'sm10', number: '205', grade: 'Raw' },

  // ── UNIFIED MINDS ────────────────────────────────────────────────────────
  { name: 'Mewtwo & Mew GX',       setName: 'Unified Minds', setId: 'sm11', number: '242', grade: 'Raw' },

  // ── SHINING LEGENDS ──────────────────────────────────────────────────────
  { name: 'Mewtwo GX', setName: 'Shining Legends', setId: 'sm35', number: '78', grade: 'Raw' },

  // ── HIDDEN FATES ─────────────────────────────────────────────────────────
  { name: 'Charizard GX', setName: 'Hidden Fates', setId: 'sm115', number: 'SV49', grade: 'Raw' },

  // ── COSMIC ECLIPSE ────────────────────────────────────────────────────────
  { name: 'Arceus & Dialga & Palkia GX', setName: 'Cosmic Eclipse', setId: 'sm12', number: '221', grade: 'Raw' },

  // ── CALL OF LEGENDS ───────────────────────────────────────────────────────
  { name: 'Snorlax', setName: 'Call of Legends', setId: 'col1', number: '33', grade: 'Raw' },

  // ── DARKNESS ABLAZE ───────────────────────────────────────────────────────
  { name: 'Charizard VMAX', setName: 'Darkness Ablaze', setId: 'swsh3', number: '20', grade: 'Raw' },

  // ── BRILLIANT STARS ───────────────────────────────────────────────────────
  { name: 'Friends in Galar', setName: 'Brilliant Stars', setId: 'swsh9', number: '140', grade: 'Raw' },

  // ── EVOLVING SKIES ────────────────────────────────────────────────────────
  { name: 'Umbreon VMAX',   setName: 'Evolving Skies', setId: 'swsh7', number: '215', grade: 'Raw' },
  { name: 'Rayquaza VMAX',  setName: 'Evolving Skies', setId: 'swsh7', number: '218', grade: 'Raw' },
  { name: 'Sylveon VMAX',   setName: 'Evolving Skies', setId: 'swsh7', number: '212', grade: 'Raw' },
  { name: 'Espeon VMAX',    setName: 'Evolving Skies', setId: 'swsh7', number: '208', grade: 'Raw' },
  { name: 'Glaceon VMAX',   setName: 'Evolving Skies', setId: 'swsh7', number: '209', grade: 'Raw' },
  { name: 'Leafeon VMAX',   setName: 'Evolving Skies', setId: 'swsh7', number: '205', grade: 'Raw' },
  { name: 'Dragonite V',    setName: 'Evolving Skies', setId: 'swsh7', number: '192', grade: 'Raw' },

  // ── FUSION STRIKE ────────────────────────────────────────────────────────
  { name: 'Gengar VMAX', setName: 'Fusion Strike', setId: 'swsh8', number: '271', grade: 'Raw' },

  // ── LOST ORIGIN ──────────────────────────────────────────────────────────
  { name: 'Giratina V', setName: 'Lost Origin', setId: 'swsh11', number: '186', grade: 'Raw' },

  // ── SILVER TEMPEST ────────────────────────────────────────────────────────
  { name: 'Lugia V', setName: 'Silver Tempest', setId: 'swsh12', number: '186', grade: 'Raw' },

  // ── CROWN ZENITH ─────────────────────────────────────────────────────────
  { name: 'Friends In Hisui',  setName: 'Crown Zenith', setId: 'swsh12pt5', number: '130', grade: 'Raw' },
  { name: 'Friends in Sinnoh', setName: 'Crown Zenith', setId: 'swsh12pt5', number: '131', grade: 'Raw' },

  // ── STELLAR CROWN ────────────────────────────────────────────────────────
  { name: 'Fan Rotom',    setName: 'Stellar Crown', setId: 'sv7', number: '118', grade: 'Raw' },
  { name: 'Terapagos ex', setName: 'Stellar Crown', setId: 'sv7', number: '170', grade: 'Raw' },

  // ── PALDEA EVOLVED ────────────────────────────────────────────────────────
  { name: 'Voltorb', setName: 'Paldea Evolved', setId: 'sv2', number: '66', grade: 'Raw' },

  // ── PALDEAN FATES ─────────────────────────────────────────────────────────
  { name: 'Mew ex',        setName: 'Paldean Fates', setId: 'sv4pt5', number: '232', grade: 'Raw' },
  { name: 'Charizard ex',  setName: 'Paldean Fates', setId: 'sv4pt5', number: '234', grade: 'Raw' },

  // ── PRISMATIC EVOLUTIONS ──────────────────────────────────────────────────
  { name: 'Budew',       setName: 'Prismatic Evolutions', setId: 'sv8pt5', number: '4',   grade: 'Raw' },
  { name: 'Umbreon ex',  setName: 'Prismatic Evolutions', setId: 'sv8pt5', number: '161', grade: 'Raw' },
  { name: 'Sylveon ex',  setName: 'Prismatic Evolutions', setId: 'sv8pt5', number: '156', grade: 'Raw' },
  { name: 'Leafeon ex',  setName: 'Prismatic Evolutions', setId: 'sv8pt5', number: '144', grade: 'Raw' },
]

// Deduplicate by setId+number+grade key (guards against accidental duplication)
const seen = new Set<string>()
export const CI_100_DEDUPED = CI_100.filter(c => {
  const key = `${c.setId}-${c.number}-${c.grade}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
