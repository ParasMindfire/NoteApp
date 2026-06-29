import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SPEC_PATH = join(ROOT, '.openspec', 'changes', 'AB-1016-e2e-journey', 'spec.md')
const JOURNEY_PATH = join(ROOT, 'apps', 'web', 'e2e', 'journey.spec.ts')

// Fail fast if journey spec doesn't exist yet
if (!existsSync(JOURNEY_PATH)) {
  console.error(`journey.spec.ts not found at: ${JOURNEY_PATH}`)
  console.error('Run TASK-2 to create it before running coverage check.')
  process.exit(1)
}

const specText = readFileSync(SPEC_PATH, 'utf8')
const journeyText = readFileSync(JOURNEY_PATH, 'utf8')

// Extract FR-* identifiers from "Validates:" lines in spec.md scenarios.
// These are the FRs the journey claims to cover — the only ones we check.
const FR_PATTERN = /FR-[A-Z][A-Z0-9-]*-\d+/g
const VALIDATES_LINE = /\*\*Validates:.*$/gm

const specFRs = new Set()
for (const match of specText.matchAll(VALIDATES_LINE)) {
  for (const fr of match[0].matchAll(FR_PATTERN)) {
    specFRs.add(fr[0])
  }
}

if (specFRs.size === 0) {
  console.error('No FR identifiers found in spec.md Validates: lines — check spec format.')
  process.exit(1)
}

// Check each claimed FR appears somewhere in journey.spec.ts
const uncovered = []
for (const fr of [...specFRs].sort()) {
  if (!journeyText.includes(fr)) {
    uncovered.push(fr)
  }
}

console.log(`Checking ${specFRs.size} FRs from spec.md scenarios against journey.spec.ts…\n`)

if (uncovered.length > 0) {
  console.error(`FRs with no E2E coverage (${uncovered.length} of ${specFRs.size}):`)
  for (const fr of uncovered) {
    console.error(`  - ${fr}`)
  }
  process.exit(1)
}

console.log(`All FRs covered (${specFRs.size} total)`)
process.exit(0)
