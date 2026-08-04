# RPG Player-Character App — Autonomous Build Instructions (v2)

> **To the AI receiving this file:** you have been given (1) this document and (2) a
> tabletop RPG rulebook in some form. Your task is to build a complete, installable
> player-character app for that game by executing the procedure below. The document is
> self-contained: the user does not fill anything in. **You** extract every game-specific
> fact from the rulebook, complete **one checkpoint + a short product Q&A**, then build
> the entire app autonomously.
>
> **Execution order:**
> 1. **Stage A — Ingest & Extract (§2, §3):** read the rulebook systematically and complete
>    the System Profile. Never substitute training-data memory for the rulebook.
> 2. **Stage B — Checkpoint + Product Q&A (§4):** present the System Profile summary,
>    content inventory, proposals, and ambiguity rulings for sign-off (**B.1**), then ask
>    the standard product-decision questions **one at a time** (**B.2**).
> 3. **Stage C — Build (§5–§9):** instantiate the project CLAUDE.md (including the **Data
>    Extraction Ledger**, §9.1) and build phase by phase, autonomously, under the process
>    rules in §10. After Stage B, ask the user questions **only** when the rulebook is
>    genuinely ambiguous on a rules point.
>
> Everything marked **LOCKED** is proven architecture from fully built and rules-audited
> reference implementations — do not substitute or "improve" it.
> Everything marked **CONDITIONAL** is included only when the game actually has that
> subsystem; if the game lacks it, omit it entirely — never invent mechanics.

---

## 1. What you are building

| | |
|---|---|
| **Game** | The RPG in the supplied rulebook — core rules only (no setting/adventure content) |
| **Audience** | Players (player-facing tool with an opt-in GM screen — not a GM-first tool) |
| **Platforms** | Phone, browser, desktop — one installable PWA |
| **Core job** | Character **creation wizard** + full in-play **tracker** + native **dice engine** |
| **Multiplayer** | **Local-first by default**: single-device experience is built and playtested first; real-time shared party & combat sync is architected from day one but its build phase is gated behind the First Session Playable milestone (§9). The Stage B Q&A can promote it to the critical path. |
| **Backend** | Firebase Realtime Database + Storage; offline-capable; runs with no keys in local mode |
| **Theme** | Visual identity evoking the game's genre and trade-dress (proposed at checkpoint); light + dark, **default follows system** (`prefers-color-scheme`), in-app toggle overrides |

**Mandatory scope (every app, every game):** creation wizard · full in-play character
sheet · native dice engine · inventory & resources · **persistent resource/currency header
on every in-play screen** · **roll log** (every roll recorded with enough detail to
re-derive it; `aria-live` announced) · **JSON export/import backup** in Settings ·
**scene/session lifecycle engine** (the app owns boundary events, with confirmation
summary + one-step undo) · searchable rules library (**every automated surface links to
its rules-library entry**) · bestiary/NPC compendium · Firebase multiplayer party with
shared combat tracker (gated per above) · GM screen.
**Conditional:** solo mode (only if official solo rules exist) · expansion content (only
if expansion books are supplied; commitment tiers set at Stage B) · power/spell automation
(only if the game has such a subsystem) · shared group entity (only if the game has one —
§3.8).

---

## 2. Stage A — Rulebook ingestion

The rulebook may arrive in any form. Adapt:

- **PDF file(s):** read systematically cover-to-cover for the System Profile (skim
  fiction/setting chapters; read rules chapters closely). Record page numbers as you
  extract; cite them in data-file comments so the audit (§11) can re-check values fast.
- **Queryable notebook (e.g. NotebookLM):** first map the book's structure (query for the
  table of contents / chapter list), then extract section by section. Notebook answers are
  non-deterministic — corroborate any surprising value with a second, differently-phrased
  query before recording it. **A first-pass answer that summarizes a procedure is not the
  procedure** — for anything sequential (opposed tests, death, task resolution), ask for
  the EXACT step-by-step rule including edge cases (ties, who acts first, who banks
  leftover resources).
- **SRD / website URL:** crawl the section index first, then extract per section. Note
  that SRDs often omit content from the full book — tell the user at the checkpoint what
  the SRD does not cover.
- **Pasted text:** treat as authoritative for what it contains; list at the checkpoint
  everything the §3 profile needs that the text does not cover, and ask for those pages.
- **No digital source at all:** fall back to interviewing the user — walk the §3 slots in
  order, **one question at a time**, and record their answers as the source of record
  (flag at the checkpoint that values are user-supplied and unverified against a printing).

**Hard rules for extraction, regardless of form:**
- Every number, list, table, formula, and procedure in the app comes **from the supplied
  source**. If you cannot find a value, ask for it or mark the feature blocked — never
  fill gaps from memory of the game, even if you know it well. (Your memory of a game and
  its current printing routinely disagree; the printing wins.)
- **Extraction is complete, not sampled.** All spells, all monsters, all gear, all
  talents/feats in the core book go into the data files — the app is not done until the
  core book's every list is fully represented. For very large books, plan multiple
  data-extraction phases in the roadmap (§9), but completeness is non-negotiable.
- **Multiple books supplied:** the core rulebook populates `data.js`; each additional
  official book becomes its own `data-<name>.js` behind a content toggle, off by default
  (§8). The Stage B Q&A assigns each book a **commitment tier** (committed / stretch /
  dropped). Errata/revised versions of core content are canonical everywhere regardless
  of toggle.
- **Paraphrase, don't copy.** Extract numbers and mechanics; rewrite all effect and flavor
  text concisely in your own words. Never reproduce rules prose verbatim. Exclude setting,
  adventure, and art content entirely (see §12).

---

## 3. Stage A — System Profile to extract

Complete every slot below from the rulebook. The **archetype examples** exist so you map
unfamiliar systems honestly instead of forcing them into another game's shape — identify
which archetype (or novel shape) the game actually is, per slot.

**3.1 Core resolution mechanic.** The dice mechanic, success criteria, crit/fumble rules,
modifier model, the advantage mechanism, and the push/re-roll economy (with its costs and
legality limits) if one exists.
*Archetypes:* roll-under d20/d100 (Call of Cthulhu, RuneQuest — natural extremes
crit/fumble; advantage = roll extra dice, keep best/worst); d20+modifier vs DC
(D&D/Pathfinder — advantage = 2d20-keep, scaling proficiency); 2d6+stat tiered outcomes
(PbtA — 10+/7–9/6−, moves carry outcome text, no GM rolls); dice pool counting successes
(Year Zero/WoD/Blades — push with a cost, complications on specific faces); 2d20 target
number (Modiphius — pool 2–5 d20s, roll under skill+attribute, buy dice with
meta-currency, no push but a spendable conviction resource).

**3.2 Opposed / contested test procedure.** The EXACT sequence when two characters roll
against each other: who rolls first, whether one side's result sets the other's target,
the tie rule, and who banks leftover resources on a win or loss. Do not summarize this
slot from a general description — first-pass extraction routinely gets opposed tests
wrong. *Archetypes:* simultaneous roll-and-compare (highest margin wins); defender-first
(defender's successes become the attacker's difficulty; tie often favors the active
character); static defense (defender contributes a number, never rolls).

**3.3 Meta-currencies & shared pools.** Every table-level or character-level currency
outside the character's printed stats: name, who holds it (personal / group-shared / GM
mirror), how it is earned, **every legal spend with exact cost**, the **pool cap**, and
any **decay/reset schedule** (per scene, session, adventure). The GM's mirror economy (if
one exists) is extracted with the same rigor. *Archetypes:* Momentum/Threat (2d20);
Fate/Fortune points; Bennies; Inspiration; Stress/Trauma as spendable; Darkness Points.

**3.4 Attributes & scales.** Attribute list, value ranges, and every legal generation
method (rolled, array, point-buy, playbook-fixed) with its exact procedure. Note: some
games have **no classic attributes** (skill+drive, approach-based, playbook-only) — record
the real shape, and note that two §3 slots may merge when the game genuinely fuses them.

**3.5 Derived stats.** Every derived value and its **exact formula including rounding** —
HP/wounds, defenses, speed, carry limit, damage bonuses, initiative, saves, resource
maxima. These formulas drive the wizard and the sheet; they live in the data layer or a
pure rules module, never inline in UI code. If the game derives almost nothing (target
number = stat A + stat B and that's all), record that explicitly — a near-empty slot is a
valid, load-bearing finding.

**3.6 Skills / proficiencies.** The full list with governing attributes, trained/untrained
rules, and value derivation. If the game has no skill list, this slot is the move list /
action-rating list instead. Include specialization mechanisms (focuses, specialties,
expert dice) and exactly what they change (crit range, extra dice, re-rolls).

**3.7 Creation options.** Every choice character creation offers, in rule-legal order —
species/ancestry (+ innate abilities), class/profession/playbook (+ starting skills, gear,
features), faction/template picks (+ mandatory selections), age/background/experience
tiers (+ modifiers), starting power/feat picks. For each: what it grants, what it
constrains, what makes the result legal.

**3.8 Shared group entity — CONDITIONAL.** If the game has a party-level entity (noble
House, crew, ship, warband, covenant, colony, caravan): its **own creation wizard** (steps,
stat arrays, domain/asset choices), its stats and resources, how characters interact with
it mechanically (roles, using its stats in tests, spending its wealth), and **who may edit
it in play**. In multiplayer it is campaign-level shared state, not a character field.
*Archetypes:* Dune House (skill arrays by tier, domains → wealth); Blades crew (playbook,
rep, turf); Traveller ship (mortgage, roles); Ars Magica covenant.

**3.9 Conditions & statuses.** The condition list, causes, exact mechanical effects, and
removal rules. In the app, a condition **auto-applies** its effect to the rolls it touches
— a checkbox with no mechanical teeth is not done. If the game has no fixed list
(complications create ad-hoc negative traits), record the trait-creation and removal
economy instead.

**3.10 Health, damage & death.** The damage model (HP, wound levels, harm/stress tracks,
**or defeat/progress tracks with no HP at all**), armor/soak (or difficulty-based defense),
and the **exact dying/death procedure** step by step, including every escape hatch
(resist-defeat, death saves, trauma-out) and its once-per-X limits. The death procedure
gets a dedicated guided UI — it is the highest-stakes moment in play and must be
impossible to run wrong.

**3.11 Rest & recovery.** Each rest type, duration, what it restores, and its usage
limits. Once-per-X limits are rules — the app enforces them. Include recovery of
narrative resources (crossed-out beliefs/drives, stress, corruption), not just physical
wounds.

**3.12 Scene / session / adventure lifecycle.** What the game defines as a scene, session,
downtime, and adventure — and **exactly what happens at each boundary**: pool decay,
temporary asset/effect expiry, per-scene flags resetting, start-of-adventure resource
resets, end-of-session XP procedures. **The app owns these events**: explicit End
Scene / End Session / End Adventure controls that fire the whole bundle, with a
confirmation summary and one-step undo. If the game has no such structure, record that.

**3.13 Extended / progress tasks.** The game's mechanism for efforts spanning multiple
rolls: extended tests, skill challenges, progress clocks, research projects. The exact
procedure — what a roll contributes, what modifies contribution, complication effects,
multiple contributors — and everything in the book that runs on it (death tracks, healing,
crafting, journeys). Build **one generic tracker component** reused by all of them.

**3.14 Powers / magic / special abilities — CONDITIONAL.** Power lists by school/class/
sphere, the activation roll, resource costs, boost/upcast options, failure/mishap tables,
preparation rules, restrictions (e.g. armor prohibitions), and any power subsystems
(summons, familiars, crafting, corruption). The bar is "tap to cast": activating a power
deducts its cost, rolls the right check, and resolves crits/mishaps from the game's real
tables. **If powers are implemented as talents/feats with embedded mechanics rather than
a subsystem, there is no separate power module — but every talent with a dice effect must
still be automated in the roller ("tap to use"), never merely displayed.**

**3.15 Advancement.** The exact advancement loop — XP thresholds, marks-and-session-end
procedures, milestones, playbook advances, **cost formulas and any one-advance-per-X
gates** — plus identity mechanics that interact with it (weakness/drive/bond/ambition).
Automate earning, spending/rolling, and consequences (new features at thresholds).

**3.16 Inventory, encumbrance & wealth.** The game's *actual* carrying model (slots,
weight, abstract load, **or abstract assets with a permanent-asset cap**), equipped-gear
exemptions, currency denominations and coin weight (or an abstract wealth index and its
price ladder), stackables, durability/quality ratings. Over-limit consequences are
enforced, not just warned.

**3.17 Combat structure.** Initiative method (cards, rolls, side-based, popcorn,
alternating with seize/keep-initiative economics), the action economy per turn, movement
rules (grid, zones — physical or abstract), reactions (parry/dodge/opportunity),
monster/NPC activation rules including multi-attack/ferocity, and **whether multiple
conflict scales share one engine** (dueling/skirmish/warfare; social conflict as combat).
Include any dual play scale (personal vs organization-level actions) and what stats each
scale uses.

**3.18 Bestiary & NPCs.** Every monster/adversary stat block in the book, including
attack tables and attacks-per-turn; NPC archetypes; animals; **the NPC tier system**
(minion/notable/major build recipes) if one exists; which creatures are deliberately
unstatted forces of nature (record the fact — do not invent stats).

**3.19 Pre-generated characters — CONDITIONAL.** If the book publishes pregens — or
sanctions playing its iconic NPCs — extract them fully for one-tap instantiation, and
record which rules economy they run on (PC rules vs NPC rules) as a checkpoint ruling.

**3.20 Solo rules — CONDITIONAL.** Official solo oracle/tables/procedures only. If the
book has none, there is no solo tab — do not invent one.

**3.21 GM tables.** Fumble tables, fear/horror tables, random encounters, travel mishaps,
story/adventure generators, enemy generators — whatever rollable tables the book gives a
GM; these power the GM screen's reference panel.

---

## 4. Stage B — Checkpoint + Product Q&A

### 4.1 The Checkpoint (one sign-off)

Before writing any application code, present a single, readable summary containing:

1. **System Profile digest** — each §3 slot in 1–3 sentences with the key numbers (e.g.
   "Resolution: roll-under d20 vs skill; nat 1 crit / nat 20 fumble; boons/banes =
   extra d20 keep best/worst; push = re-roll once, take a condition").
2. **Content inventory** — counts per category (skills, powers, monsters, gear, pregens…)
   so the user sees the extraction scale, plus anything the source did not cover.
3. **Proposals** (defaults below — present your concrete choices):
   - **App name:** default `<Game> Player`.
   - **Visual theme:** a palette/typography direction that evokes the game's genre and
     trade-dress **without copying its art or logos** (parchment/ink for a fantasy game,
     terminal-green for cyberpunk, etc.); light/dark with system-default.
   - **Rules-vs-setting boundary:** which chapters you are including vs excluding.
   - **Expansions detected** with proposed commitment tiers; **solo mode** present or
     absent; **group entity** present or absent.
4. **Ambiguity list** — every rules point where the book was unclear, with your proposed
   ruling for each. The user confirms or corrects; rulings get recorded in the project
   CLAUDE.md.

### 4.2 The Product Q&A (standard, one question at a time)

After checkpoint sign-off, ask these **one at a time** (adapt wording to the game; skip
any the user already answered; add game-specific levers you discovered). Record all
answers as **§1.1 Product Decisions** in the project CLAUDE.md, and instantiate the
roadmap to match:

1. **Usage mode** — full shared campaign / local-first with sync later (default) /
   single-device only. Sets Phase 5's gate.
2. **User's seat** — GM / player / rotates. Sets GM-screen priority.
3. **Dice input** — digital-only / digital + manual physical-dice entry / manual-first.
   Shapes the roller.
4. **Expansion commitment** — which supplied books are committed vs stretch vs dropped.
5. **Table device** — phone / tablet / desktop / mixed. Tunes layout effort (baseline
   stays phone-first regardless).
6. **Theme default** — follow system (default) / always dark / always light.

After the Q&A, build autonomously to completion. Ask further questions **only** for
newly discovered rules ambiguities — never for permission to continue.

---

## 5. Architecture — **LOCKED**

- **No build step.** Vanilla JS, native ES modules loaded directly by the browser
  (`<script type="module" src="src/main.js">`). Clone-and-run must always work.
- **Installable PWA:** `manifest.json`, `service-worker.js` (network-first, caches the app
  shell + all data files, versioned `CACHE_VERSION`), an SVG icon, and an in-app
  "Update available — reload" toast when the service worker detects new code.
- **Storage modes:** `localStorage` **local-only mode** works with zero configuration;
  dropping real keys into `firebase-config.js` (clearly marked placeholder block +
  `FIREBASE_ENABLED` flag) switches on cloud sync. Never commit real keys.
- **Firebase:** Realtime Database (bandwidth-priced, low-latency — right for hundreds of
  tiny HP/condition writes) + Storage for portraits (client-side canvas compression to
  ~400px before upload).
- **Auth:** instant anonymous launch, no login wall; optional Google account linking in
  Settings for cross-device backup.
- **Roles from day one:** `members/{uid}.role: "player" | "gm"` in the schema **and** in
  `database.rules.json` (players read/write own sheet + shared combat; GM reads/writes
  all) — so the GM screen needs zero migration. If a shared group entity exists (§3.8),
  its write rules (GM + designated role) are in the schema from day one too.
- **Campaigns:** memorable fantasy-phrase join codes (e.g. `red-dragon-sword`).
- **Themed UI primitives:** no native `alert/confirm/prompt` — a shared `modal()` +
  `showToast/confirmModal/promptModal`, accessible (focus trap, Escape, `aria-modal`,
  focus restore) and sized to the visual viewport (mobile-toolbar safe).
- **Accessibility:** keyboard + screen-reader usable — `aria-live` roll results and
  vitals, labeled icon-only buttons, `aria-current` nav.
- **Responsive:** phone-first; zero horizontal overflow at 360px on every screen.

---

## 6. File structure — **LOCKED**

| File | Purpose |
|---|---|
| `index.html` | App shell: header, bottom nav, screen mount, module entry |
| `styles.css` | Game theme (light + dark) + all component styles |
| `data.js` | **Core rules library** — every §3 list/table/formula from the core book |
| `data-<expansion>.js` | One file per supplied expansion, behind its toggle (CONDITIONAL) |
| `data-monsters.js` | Bestiary stat blocks incl. attack tables & attacks-per-turn (omit if the game has no monster bestiary — record why) |
| `data-npcs.js` | Humanoid NPCs / archetypes / animals / NPC tier recipes |
| `data-pregens.js` | Published pre-generated characters (CONDITIONAL) |
| `data-solo.js` | Official solo tables (CONDITIONAL) |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` flag |
| `database.rules.json` | RTDB security rules (player/GM roles; group-entity write rules) |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA |
| `tests/` + `package.json` | Dev-only headless regression harness (`npm test`); dev-only `playwright-core`; `node_modules` gitignored; not in the SW app shell |
| `README.md` | Setup incl. Firebase steps + the personal-use licensing note (§12) |
| `CLAUDE.md` | This document, instantiated (§9) — the project's living canonical spec |

### 6.1 `src/` module map — **LOCKED** responsibilities

One module per responsibility; explicit `import`/`export`, nothing smuggled through
`window`. Runtime cycles (sheet ↔ roller ↔ combat) are safe under ESM live bindings.

| Module | Responsibility |
|---|---|
| `core.js` | Foundational constants, DOM/util helpers, raw dice functions. No imports. |
| `ui.js` | Themed modals/toasts/confirm/prompt. |
| `rules.js` | Pure rules lookups over the data libraries (find ability, parse gear, build skills, requirement checks). |
| `derived.js` | Character-derived calculations (effective maxima, encumbrance, equipped gear, data normalization/migration). |
| `settings.js` | Feature/content toggles (expansions, solo, GM screen, advanced automation). |
| `store.js` | Local/cloud character (+ group entity) persistence + combat mirroring + JSON export/import. |
| `sync.js` | Firebase auth, campaigns, join codes, presence + theme. |
| `wizard.js` | Creation wizard (+ group-entity wizard, §3.8) + pregens. |
| `roller.js` | The dice engine: every roll type, opposed-test sequence (§3.2), meta-currency spends (§3.3), push flows, ability-embedded automation, damage applier, **roll-log writes**. |
| `sheet.js` | The full character sheet + all in-play tracking UI + persistent resource header. |
| `combat.js` | Shared combat tracker: initiative, turn state, combatant cards, generic progress-task tracker (§3.13), scene/session lifecycle events (§3.12). |
| `power-automation.js` | Automated power/spell resolution (targeting, effects, summons) — CONDITIONAL on §3.14 being a true subsystem. |
| `solo.js` | Solo assistant — CONDITIONAL on §3.20. |
| `gm.js` | GM dashboard. |
| `screens.js` | Top-level screen renderers (home/rules/about) + party banner + roll-log view. |
| `router.js` | Bottom-nav routing + conditional tab gating. |
| `main.js` | Entry point / boot. |

When adding or moving a `src/` file: update the project CLAUDE.md's file tables **and**
the service-worker app-shell list, then bump `CACHE_VERSION` — in the same change.

---

## 7. Data model (Firebase) — **LOCKED** shape; field names follow the game

```
campaigns/{campaignId}
  meta:    { name, joinCode, createdAt, ownerUid }
  members/{uid}: { displayName, characterId, role: "player" | "gm" }
  group:   { <§3.8 group-entity shape: stats, resources, roles, traits> }  // CONDITIONAL
  pools:   { <§3.3 shared meta-currencies, with caps> }
  combat:  { active, round, initiativeOrder[]|currentSide, keptInitiative,
             pendingContest{...},                                   // if §3.2 is sequential
             combatants{ id: { ..., actedThisRound, tracks{...} } } }   // shaped by §3.17
  tasks/{taskId}: { name, requirement, progress, contributors[] }   // §3.13 generic tasks
  rollLog/{pushId}: { by, characterName, roll inputs, dice[], outcome,
                      currencyDeltas, ts }                          // capped (~100)
  broadcast/{pushId}: { text, ts, from }                            // GM→players feed

characters/{characterId}
  owner, campaignId
  identity:  { name, <§3.7 option fields>, appearance, <§3.15 identity fields>, portraitUrl }
  attributes:{ <§3.4 attributes> }
  derived:   { <§3.5 derived stats> }
  state:     { <§3.10 vitals/tracks>, conditions{...}, <death-procedure state>,
               <per-scene/per-session flags per §3.12>, <rest-limit flags>,
               <combat state: movement, ammo, posture> }
  skills:    { <name>: { level/bonus, trained, mark } }             // shape per §3.6
  abilities: [ ... ]                                                // talents/feats/features
  powers:    { <§3.14 shape: known lists, cast skill, preparation> }
  inventory: { items[] (weight/qty/equipped/durability per §3.16), tiny[], money{...} }
  currencies:{ <§3.3 personal currencies, with caps> }
  companions:[ ... ]   effects:[ ... ]   notes: ""   advancementLog:[ ... ]
```

Rules: every rules number the schema references lives in the data files; every schema
addition ships with a normalization path that back-fills defaults on old characters (never
crash on old data); every field addition is documented in the project CLAUDE.md's data
model **in the same change**.

---

## 8. Settings & toggle pattern — **LOCKED**

All optional surfaces follow one pattern: a flag in `settings.js`
(`Settings.<flag>() → !!get("<flag>")`, off by default), a toggle row in Settings & About
with a one-line description, every related UI checks the flag before rendering, and nav
tabs for gated modes are hidden by the router when off. Explicit user choice always beats
role-based defaults (store `true`/`false` distinctly from unset).

Standard toggles: one per expansion book · solo mode · GM screen · advanced/GM automation
(if built).

---

## 9. Build roadmap — instantiate with checkboxes in the project CLAUDE.md

At Stage C start, write the project's `CLAUDE.md`: this document's §1 and §5–§12 carried
over, **§1.1 Product Decisions** (the Stage B Q&A answers), §3 replaced by the
**completed** System Profile (with the checkpoint rulings recorded inline), the file
tables made real, the **Data Extraction Ledger** (§9.1), this roadmap instantiated with
checkboxes, and a changelog seeded with the instantiation row. That file is thereafter
the project's canonical spec, kept in sync per §10.

### 9.1 Data Extraction Ledger — mandatory

The project CLAUDE.md contains a **T-numbered checkbox ledger** listing **every data
table** the app needs, grouped by target data file and mapped to roadmap phases: every §3
list/table/formula, every catalog (talents, gear, powers, monsters), every generator
table, the rules-library quick-reference content, and per-expansion inventories. The
ledger opens with a **"How to continue"** preamble for any AI resuming the project:
work top to bottom within the current phase; query the source; corroborate surprising
values; write the table (paraphrased, cited); **tick the checkbox in the same change**
and append a changelog row; estimated counts yield to real counts (record them);
**an unticked box = data not extracted; never build UI against an unticked table.**

### 9.2 Phases — build strictly in order

- **Phase 0 — Foundations:** scaffold all §6 files; extract the **complete, verified**
  core data library per the ledger (multiple sub-phases for large books) — data before
  features; theme; PWA shell; app shell with router and local storage.
- **Phase 1 — Creation Wizard(s):** the §3.7 flow with honest §3.4 generation, all §3.5
  derivations, legality validation at every step; the group-entity wizard if §3.8 exists;
  pregens if published.
- **Phase 2 — Core Tracker:** the live sheet — vitals with steppers clamped to true
  maxima, conditions, inventory/encumbrance, abilities/powers display, flavor + notes +
  portrait; **persistent resource header on every in-play screen**; **JSON export/import
  in Settings**; persistence + migration.
- **Phase 3 — Dice Engine:** §3.1 natively, wired into sheet skills, weapons, and powers;
  the exact §3.2 opposed sequence; §3.3 currency spends with caps enforced; condition
  effects auto-applied; push economy enforced; crit/fumble consequences from the book's
  real tables; ability-embedded automation ("tap to use"); **roll log** (local always,
  synced when multiplayer; capped; `aria-live`); **rules citations** — every automated
  surface links to its rules-library entry.
- **🏁 Milestone — First Session Playable:** create character → live sheet → roll tests →
  track resources end-to-end, verified at (or rehearsed as) a real play session.
  **Phase 5 is gated on this milestone** unless the Stage B Q&A promoted multiplayer.
- **Phase 4 — In-Play Systems:** guided death procedure (§3.10, impossible to run wrong);
  rests with enforced limits; **scene/session lifecycle engine (§3.12) with confirmation
  summary + one-step undo**; the **generic progress-task tracker (§3.13)**; the full
  advancement loop (§3.15) incl. gates; local combat helper with the bestiary.
- **Phase 5 — Multiplayer & Sync** *(gated per §1.1)*: Firebase, security rules
  (incl. group-entity write rules), anonymous auth + Google link, campaigns/join codes,
  party overview, shared pools, shared combat with two-way sync, shared tasks + roll log,
  portraits, PWA update toast.
- **Phase 6+ — Conditional surfaces:** expansion toggles per commitment tier; solo mode;
  GM screen (party panel, peek sheets, drop-in combatants, hand out damage/conditions,
  rollable §3.21 reference tables); power-automation engine; advanced automation behind
  one shared toggle (time clocks, light sources, afflictions — only if the game has them).
- **Hardening (always):** committed regression-test harness; accessibility pass; the full
  **rules-accuracy audit** (§11) with every finding closed.

**Per-feature spec format (mandatory for every roadmap item):**
- **Rule:** the canonical mechanic with exact numbers (cited to the source).
- **Target:** file · module · function.
- **Behavior/UI:** what to build and where it appears.
- **Schema:** new fields — name · type · default · location (and §7 updated).
- **Acceptance:** how to confirm it works in a browser.

---

## 10. Process rules — **LOCKED**

1. **Living spec.** The project CLAUDE.md is canonical. **Every code change updates it in
   the same change** — features, data model, file tables, roadmap checkboxes, ledger
   ticks, changelog. A code change with a stale CLAUDE.md is incomplete.
2. **Single source of truth.** All rules data and numbers live in the `data*.js` files.
   Never hardcode a rules value in a `src/` module — if a table is missing, add it to the
   data layer first (and to the ledger if it was missed).
3. **Changelog table.** Every change appends a dated row: what, why, root cause for
   fixes, verification performed, cache version.
4. **Verify in a real browser.** Every phase/feature is verified headless (Playwright,
   Firebase requests aborted) before being marked complete: the flow works end-to-end
   with **zero console errors**. "Syntax is valid" is not verification.
5. **Committed regression harness.** `npm test` boots the app headless and asserts at
   minimum: boot/wiring smoke (every tab, zero JS errors); §3.5 derivation invariants
   across generated + pregen characters; dice-engine invariants (incl. the §3.2 opposed
   sequence and §3.3 caps/decay); every automated ability opens a non-empty resolution;
   inventory/encumbrance math; lifecycle-event bundles fire completely and undo cleanly;
   zero horizontal overflow at 360/390px on every screen; a11y basics; and every closed
   audit finding. Every bug fix adds a check that would catch its return.
6. **Cache discipline.** Any shipped-file change bumps `CACHE_VERSION`.
7. **Root-cause fixes.** Debug to the actual cause before editing; record cause + fix in
   the changelog. No symptom-patching.
8. **Scope guard.** Core rules (+ toggled supplied expansions) only. No setting/adventure
   content. Nothing invented presented as official — any house convenience is explicitly
   labeled a house aid.
9. **Module discipline.** Respect §6.1 responsibilities; export/import explicitly; split
   a module that outgrows its job along the same lines.

---

## 11. Rules-accuracy audit — mandatory before "done"

Re-verify the finished app against the rulebook:

- **Data values:** spot-check every category; fully check every formula and every
  creation table.
- **Engine behavior — audit hardest here:** gating, options, limits, and sequencing
  (push/re-roll legality, rest once-per-X, crit option choices, multi-attack counts,
  advantage stacking, restriction enforcement, **the exact opposed-test sequence incl.
  ties and resource banking**, **currency caps + decay schedules**, **once-per-scene
  escape hatches**, **lifecycle boundary bundles**, **one-advance-per-X gates**). In the
  reference projects the data layer audited essentially flawless while nearly all real
  findings were engine behaviors that deviated from the book — expect the same.
- Document findings as a numbered work-list (**Rule / Target / Fix / Why**); close each
  with a regression check; record what was **verified clean** so future audits don't
  re-litigate it.
- Re-verification method: pull the app's value from the data files, query the source for
  the canonical value, compare; corroborate surprising answers before editing.

---

## 12. Content & IP rules

- Extract **numbers and mechanics**; **paraphrase all effect/flavor text concisely —
  never copy rules prose verbatim.** No setting, adventure, art, or logo content.
- The generated app is a **personal play aid** built from the user's own books. State in
  the README that if the user publishes or distributes it, licensing is their
  responsibility, and that openly licensed material (an SRD, ORC/CC content) is the safe
  basis for anything public.

---

## 13. Kickoff Prompt — copy-paste this to start a project

> Copy the block below into a fresh chat along with this template file and (if available)
> the rulebook source. It is kept in sync with this template by design — if you edit one,
> edit the other.

```
Role: You are an Expert Software Architect and AI Project Manager.

Context: I am providing "RPG Player-Character App — Autonomous Build Instructions" (v2),
which defines a strict three-stage execution order (A: Ingest & Extract, B: Checkpoint +
Product Q&A, C: Autonomous Build) for building an installable HTML5/vanilla-JS RPG
companion app.

Objective: Guide me through Stage A and Stage B so we generate the project's canonical
CLAUDE.md — the completed System Profile, the content inventory, the T-numbered Data
Extraction Ledger, my recorded product decisions, and the phased build roadmap — before
any development begins.

Rules & Constraints:
1. No application code until I sign off Stage B. Producing the CLAUDE.md itself is the
   deliverable of this phase.
2. Source first: your FIRST question is to confirm the rulebook source. If a queryable or
   readable source exists (NotebookLM notebook, PDFs, SRD), extract the System Profile
   from it autonomously — map the table of contents first, extract section by section,
   and corroborate every surprising value with a second, differently-phrased query. For
   sequential procedures (opposed tests, death, extended tasks, lifecycle boundaries),
   get the EXACT step-by-step rule including ties and edge cases — never a summary.
3. Bring questions to me only for: (a) genuine rules ambiguities, each with your proposed
   ruling; (b) the standard Stage B product-decision questions (usage mode, my seat at
   the table, dice input, expansion commitment tiers, table device, theme default).
   If NO digital source exists, instead interview me through the §3 System Profile
   slot by slot.
4. Strictly one question at a time. Wait for my answer before the next. Never a list.
5. No assumptions: never substitute training-data memory of the game for the source. A
   missing value gets queried, then asked, then marked blocked — never guessed.
6. On Stage B sign-off, write the project CLAUDE.md per §9 of the instructions —
   including the Data Extraction Ledger with every box unticked — then stop and await my
   go-ahead for Stage C.

Next Steps: Acknowledge these constraints, then ask your first question (the rulebook
source).
```

---

## Template changelog

| Version | Date | Change |
|---|---|---|
| v2 | 2026-07-06 | Lessons from the Dune: Adventures in the Imperium reference build: new §3 slots (opposed-test sequence 3.2, meta-currencies 3.3, group entity 3.8, scene/session lifecycle 3.12, extended/progress tasks 3.13); mandatory Data Extraction Ledger (§9.1); Stage B split into checkpoint + standard product Q&A (§4.2); local-first default with First Session Playable milestone gating Phase 5; mandatory roll log, JSON export/import, persistent resource header, lifecycle confirm+undo, rules-citation links; notebook extraction warning about summarized procedures; kickoff prompt embedded (§13). |
| v1 | — | Original template from the first reference implementation. |
