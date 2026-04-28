/**
 * CI-100 — CardIndex Market Index constituents.
 *
 * 100 cards chosen for liquidity, price discovery, and era coverage:
 *   - Base Set / Jungle / Fossil / Team Rocket / Gym / Neo holos (PSA 10)
 *   - Gold Stars and E-series key cards (PSA 10)
 *   - Sun & Moon GX alt arts (PSA 10)
 *   - Sword & Shield VMAX/VSTAR alt arts (PSA 10)
 *   - Scarlet & Violet Special Art Rares (PSA 10)
 *
 * pokemontcg.io card IDs are used verbatim as the card_id.
 * The seed endpoint calls pokemontcg.io to resolve the correct ID from
 * (name + set name), so `tcgId` here is advisory — the resolved ID wins.
 */

export interface SeedCard {
  name: string       // pokemontcg.io card name (exact)
  setName: string    // pokemontcg.io set name (used for disambiguation)
  setId: string      // pokemontcg.io set ID (used to fetch card list)
  number: string     // card number within set
  grade: string      // grade for this constituent
}

export const CI_100: SeedCard[] = [
  // ── BASE SET (Shadowless) ──────────────────────────────────────────────────
  { name: 'Charizard',   setId: 'base1', setName: 'Base',   number: '4',  grade: 'PSA 10' },
  { name: 'Blastoise',   setId: 'base1', setName: 'Base',   number: '2',  grade: 'PSA 10' },
  { name: 'Venusaur',    setId: 'base1', setName: 'Base',   number: '15', grade: 'PSA 10' },
  { name: 'Mewtwo',      setId: 'base1', setName: 'Base',   number: '10', grade: 'PSA 10' },
  { name: 'Raichu',      setId: 'base1', setName: 'Base',   number: '14', grade: 'PSA 10' },
  { name: 'Gyarados',    setId: 'base1', setName: 'Base',   number: '6',  grade: 'PSA 10' },
  { name: 'Chansey',     setId: 'base1', setName: 'Base',   number: '3',  grade: 'PSA 10' },
  { name: 'Hitmonchan',  setId: 'base1', setName: 'Base',   number: '7',  grade: 'PSA 10' },
  { name: 'Alakazam',    setId: 'base1', setName: 'Base',   number: '1',  grade: 'PSA 10' },
  { name: 'Zapdos',      setId: 'base1', setName: 'Base',   number: '16', grade: 'PSA 10' },
  { name: 'Ninetales',   setId: 'base1', setName: 'Base',   number: '12', grade: 'PSA 10' },
  { name: 'Nidoking',    setId: 'base1', setName: 'Base',   number: '11', grade: 'PSA 10' },

  // ── JUNGLE ────────────────────────────────────────────────────────────────
  { name: 'Scyther',     setId: 'jungle', setName: 'Jungle', number: '10', grade: 'PSA 10' },
  { name: 'Flareon',     setId: 'jungle', setName: 'Jungle', number: '3',  grade: 'PSA 10' },
  { name: 'Jolteon',     setId: 'jungle', setName: 'Jungle', number: '4',  grade: 'PSA 10' },
  { name: 'Vaporeon',    setId: 'jungle', setName: 'Jungle', number: '12', grade: 'PSA 10' },
  { name: 'Snorlax',     setId: 'jungle', setName: 'Jungle', number: '11', grade: 'PSA 10' },
  { name: 'Clefable',    setId: 'jungle', setName: 'Jungle', number: '1',  grade: 'PSA 10' },
  { name: 'Pinsir',      setId: 'jungle', setName: 'Jungle', number: '9',  grade: 'PSA 10' },

  // ── FOSSIL ────────────────────────────────────────────────────────────────
  { name: 'Gengar',      setId: 'fossil', setName: 'Fossil', number: '5',  grade: 'PSA 10' },
  { name: 'Moltres',     setId: 'fossil', setName: 'Fossil', number: '12', grade: 'PSA 10' },
  { name: 'Articuno',    setId: 'fossil', setName: 'Fossil', number: '2',  grade: 'PSA 10' },
  { name: 'Lapras',      setId: 'fossil', setName: 'Fossil', number: '10', grade: 'PSA 10' },
  { name: 'Zapdos',      setId: 'fossil', setName: 'Fossil', number: '15', grade: 'PSA 10' },
  { name: 'Dragonite',   setId: 'fossil', setName: 'Fossil', number: '4',  grade: 'PSA 10' },
  { name: 'Aerodactyl',  setId: 'fossil', setName: 'Fossil', number: '1',  grade: 'PSA 10' },

  // ── TEAM ROCKET ───────────────────────────────────────────────────────────
  { name: 'Dark Charizard',  setId: 'base3', setName: 'Team Rocket', number: '4',  grade: 'PSA 10' },
  { name: 'Dark Blastoise',  setId: 'base3', setName: 'Team Rocket', number: '3',  grade: 'PSA 10' },

  // ── GYM HEROES / GYM CHALLENGE ────────────────────────────────────────────
  { name: "Blaine's Charizard",  setId: 'gym2', setName: 'Gym Challenge',   number: '2', grade: 'PSA 10' },
  { name: "Misty's Tears",       setId: 'gym2', setName: 'Gym Challenge',   number: '105', grade: 'PSA 10' },
  { name: "Lt. Surge's Raichu",  setId: 'gym1', setName: 'Gym Heroes',      number: '10', grade: 'PSA 10' },

  // ── NEO GENESIS / DISCOVERY / REVELATION ─────────────────────────────────
  { name: 'Lugia',         setId: 'neo1', setName: 'Neo Genesis',    number: '9',  grade: 'PSA 10' },
  { name: 'Typhlosion',    setId: 'neo1', setName: 'Neo Genesis',    number: '17', grade: 'PSA 10' },
  { name: 'Feraligatr',    setId: 'neo1', setName: 'Neo Genesis',    number: '5',  grade: 'PSA 10' },
  { name: 'Meganium',      setId: 'neo1', setName: 'Neo Genesis',    number: '10', grade: 'PSA 10' },
  { name: 'Espeon',        setId: 'neo2', setName: 'Neo Discovery',  number: '1',  grade: 'PSA 10' },
  { name: 'Umbreon',       setId: 'neo2', setName: 'Neo Discovery',  number: '13', grade: 'PSA 10' },
  { name: 'Shining Magikarp',  setId: 'neo3', setName: 'Neo Revelation',  number: '66', grade: 'PSA 10' },
  { name: 'Shining Gyarados',  setId: 'neo3', setName: 'Neo Revelation',  number: '65', grade: 'PSA 10' },
  { name: 'Shining Tyranitar', setId: 'neo4', setName: 'Neo Destiny',     number: '113', grade: 'PSA 10' },
  { name: 'Shining Charizard', setId: 'neo4', setName: 'Neo Destiny',     number: '107', grade: 'PSA 10' },

  // ── GOLD STARS ────────────────────────────────────────────────────────────
  { name: 'Charizard ☆',  setId: 'ex15', setName: 'EX Dragon Frontiers', number: '100', grade: 'PSA 10' },
  { name: 'Espeon ☆',     setId: 'pop5', setName: 'POP Series 5',         number: '16',  grade: 'PSA 10' },
  { name: 'Umbreon ☆',    setId: 'pop5', setName: 'POP Series 5',         number: '17',  grade: 'PSA 10' },
  { name: 'Rayquaza ☆',   setId: 'ex8',  setName: 'EX Deoxys',            number: '107', grade: 'PSA 10' },
  { name: 'Mewtwo ☆',     setId: 'ex14', setName: 'EX Holon Phantoms',    number: '103', grade: 'PSA 10' },
  { name: 'Pikachu ☆',    setId: 'pop4', setName: 'POP Series 4',         number: '12',  grade: 'PSA 10' },

  // ── EX ERA ────────────────────────────────────────────────────────────────
  { name: 'Rayquaza EX',   setId: 'ex3',  setName: 'EX Dragon',              number: '97',  grade: 'PSA 10' },
  { name: 'Charizard EX',  setId: 'ex6',  setName: 'EX FireRed & LeafGreen', number: '105', grade: 'PSA 10' },
  { name: 'Umbreon EX',    setId: 'ex10', setName: 'EX Unseen Forces',       number: '112', grade: 'PSA 10' },
  { name: 'Espeon EX',     setId: 'ex10', setName: 'EX Unseen Forces',       number: '102', grade: 'PSA 10' },
  { name: 'Celebi EX',     setId: 'ex5',  setName: 'EX Hidden Legends',      number: '92',  grade: 'PSA 10' },

  // ── DIAMOND & PEARL / PLATINUM / HGSS ────────────────────────────────────
  { name: 'Charizard',     setId: 'dp7',   setName: 'Stormfront',            number: '103', grade: 'PSA 10' },
  { name: 'Mewtwo LV.X',   setId: 'dp4',   setName: 'Majestic Dawn',         number: '96',  grade: 'PSA 10' },
  { name: 'Palkia G LV.X', setId: 'pl1',   setName: 'Platinum',              number: '125', grade: 'PSA 10' },
  { name: 'Ho-Oh LEGEND',  setId: 'hgss1', setName: 'HeartGold & SoulSilver',number: '111', grade: 'PSA 10' },
  { name: 'Lugia LEGEND',  setId: 'hgss1', setName: 'HeartGold & SoulSilver',number: '113', grade: 'PSA 10' },

  // ── BW / XY ERA ───────────────────────────────────────────────────────────
  { name: 'Mewtwo-EX',    setId: 'bw4',  setName: 'Next Destinies',  number: '98',  grade: 'PSA 10' },
  { name: 'Charizard-EX', setId: 'xy2',  setName: 'Flashfire',       number: '107', grade: 'PSA 10' },
  { name: 'Umbreon-EX',   setId: 'xy10', setName: 'Fates Collide',   number: '119', grade: 'PSA 10' },
  { name: 'Charizard-EX', setId: 'xy12', setName: 'Evolutions',      number: '101', grade: 'PSA 10' },

  // ── SUN & MOON ERA ────────────────────────────────────────────────────────
  { name: 'Umbreon-GX',             setId: 'sm1',  setName: 'Sun & Moon',          number: '146', grade: 'PSA 10' },
  { name: 'Espeon-GX',              setId: 'sm1',  setName: 'Sun & Moon',          number: '140', grade: 'PSA 10' },
  { name: 'Charizard-GX',           setId: 'sm3',  setName: 'Burning Shadows',     number: '150', grade: 'PSA 10' },
  { name: 'Mewtwo-GX',              setId: 'sm35', setName: 'Shining Legends',     number: '73',  grade: 'PSA 10' },
  { name: 'Shining Charizard',      setId: 'sm35', setName: 'Shining Legends',     number: '27',  grade: 'PSA 10' },
  { name: 'Pikachu & Zekrom-GX',    setId: 'sm9',  setName: 'Team Up',             number: '184', grade: 'PSA 10' },
  { name: 'Reshiram & Charizard-GX',setId: 'sm10', setName: 'Unbroken Bonds',      number: '217', grade: 'PSA 10' },
  { name: 'Mewtwo & Mew-GX',        setId: 'sm11', setName: 'Unified Minds',       number: '222', grade: 'PSA 10' },
  { name: 'Pikachu-GX',             setId: 'smp',  setName: 'SM Black Star Promos',number: 'SM232', grade: 'PSA 10' },

  // ── SWORD & SHIELD ERA ────────────────────────────────────────────────────
  { name: 'Charizard VMAX',          setId: 'swsh35', setName: "Champion's Path",  number: '74',  grade: 'PSA 10' },
  { name: 'Charizard V',             setId: 'swsh35', setName: "Champion's Path",  number: '79',  grade: 'PSA 10' },
  { name: 'Pikachu VMAX',            setId: 'swsh4',  setName: 'Vivid Voltage',    number: '188', grade: 'PSA 10' },
  { name: 'Shadow Rider Calyrex VMAX',setId: 'swsh6', setName: 'Chilling Reign',   number: '205', grade: 'PSA 10' },
  { name: 'Umbreon VMAX',            setId: 'swsh7',  setName: 'Evolving Skies',   number: '215', grade: 'PSA 10' },
  { name: 'Umbreon V',               setId: 'swsh7',  setName: 'Evolving Skies',   number: '214', grade: 'PSA 10' },
  { name: 'Espeon VMAX',             setId: 'swsh7',  setName: 'Evolving Skies',   number: '208', grade: 'PSA 10' },
  { name: 'Rayquaza VMAX',           setId: 'swsh7',  setName: 'Evolving Skies',   number: '218', grade: 'PSA 10' },
  { name: 'Glaceon VMAX',            setId: 'swsh7',  setName: 'Evolving Skies',   number: '209', grade: 'PSA 10' },
  { name: 'Leafeon VMAX',            setId: 'swsh7',  setName: 'Evolving Skies',   number: '211', grade: 'PSA 10' },
  { name: 'Sylveon VMAX',            setId: 'swsh7',  setName: 'Evolving Skies',   number: '212', grade: 'PSA 10' },
  { name: 'Mew VMAX',                setId: 'swsh8',  setName: 'Fusion Strike',    number: '269', grade: 'PSA 10' },
  { name: 'Charizard VSTAR',         setId: 'swsh9',  setName: 'Brilliant Stars',  number: '174', grade: 'PSA 10' },
  { name: 'Arceus VSTAR',            setId: 'swsh9',  setName: 'Brilliant Stars',  number: '184', grade: 'PSA 10' },
  { name: 'Origin Forme Dialga VSTAR',setId: 'swsh10',setName: 'Astral Radiance',  number: '214', grade: 'PSA 10' },
  { name: 'Origin Forme Palkia VSTAR',setId: 'swsh10',setName: 'Astral Radiance',  number: '215', grade: 'PSA 10' },
  { name: 'Giratina VSTAR',          setId: 'swsh11', setName: 'Lost Origin',      number: '196', grade: 'PSA 10' },
  { name: 'Lugia V',                 setId: 'swsh12', setName: 'Silver Tempest',   number: '186', grade: 'PSA 10' },
  { name: 'Lugia VSTAR',             setId: 'swsh12', setName: 'Silver Tempest',   number: '211', grade: 'PSA 10' },

  // ── SCARLET & VIOLET ERA ──────────────────────────────────────────────────
  { name: 'Charizard ex',            setId: 'sv1',    setName: 'Scarlet & Violet', number: '234', grade: 'PSA 10' },
  { name: 'Gardevoir ex',            setId: 'sv1',    setName: 'Scarlet & Violet', number: '228', grade: 'PSA 10' },
  { name: 'Miraidon ex',             setId: 'sv1',    setName: 'Scarlet & Violet', number: '243', grade: 'PSA 10' },
  { name: 'Koraidon ex',             setId: 'sv1',    setName: 'Scarlet & Violet', number: '247', grade: 'PSA 10' },
  { name: 'Iono',                    setId: 'sv2',    setName: 'Paldea Evolved',   number: '269', grade: 'PSA 10' },
  { name: 'Charizard ex',            setId: 'sv3',    setName: 'Obsidian Flames',  number: '234', grade: 'PSA 10' },
  { name: 'Iron Valiant ex',         setId: 'sv4',    setName: 'Paradox Rift',     number: '245', grade: 'PSA 10' },
  { name: 'Roaring Moon ex',         setId: 'sv4',    setName: 'Paradox Rift',     number: '251', grade: 'PSA 10' },
  { name: 'Charizard ex',            setId: 'sv3pt5', setName: 'Paldean Fates',    number: '191', grade: 'PSA 10' },
  { name: 'Dragapult ex',            setId: 'sv6',    setName: 'Twilight Masquerade', number: '218', grade: 'PSA 10' },
  { name: 'Terapagos ex',            setId: 'sv7',    setName: 'Stellar Crown',    number: '167', grade: 'PSA 10' },
  { name: 'Eevee ex',                setId: 'sv8pt5', setName: 'Prismatic Evolutions', number: '193', grade: 'PSA 10' },
  { name: 'Umbreon ex',              setId: 'sv8pt5', setName: 'Prismatic Evolutions', number: '198', grade: 'PSA 10' },
  { name: 'Espeon ex',               setId: 'sv8pt5', setName: 'Prismatic Evolutions', number: '197', grade: 'PSA 10' },
  // 151 set — iconic reprints
  { name: 'Charizard ex',            setId: 'sv3pt5', setName: 'Paldean Fates',    number: '191', grade: 'PSA 10' },
  { name: 'Mewtwo ex',               setId: 'mcd25',  setName: 'McDonald\'s Match Battle', number: '8', grade: 'PSA 10' },
  // Ancient Mew promo — exceptionally collectible
  { name: 'Ancient Mew',             setId: 'mcd25',  setName: 'WizardsBlackStar', number: '42', grade: 'PSA 10' },
]

// Deduplicate by card_id key (name+set+number combo)
const seen = new Set<string>()
export const CI_100_DEDUPED = CI_100.filter(c => {
  const key = `${c.setId}-${c.number}-${c.grade}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
