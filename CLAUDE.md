# REICH '62 Player — Project Spec (canonical)

> Instantiated from `source/BUILD_TEMPLATE_v2.md` (RPG Player-Character App — Autonomous
> Build Instructions v2). Three sources of record:
> `source/reich62_manual.md` (1116 lines — core rules),
> `source/reich62_bestiary.md` (303 lines — Bestiary & Adversary Compendium) and
> `source/genesys_dice_breakdown.md` (the die face distributions the manual omits).
> **Citations use `§x` for the manual, `B§x` for the bestiary and `D§` for the face table**,
> in this file and in every `data*.js` comment.
>
> This file is the project's living spec. Per §10, **every code change updates this file in
> the same change** — features, data model, file tables, roadmap checkboxes, ledger ticks,
> changelog.

**Status: 🏁 First Session Playable reached.** Phase 0 complete; Phase 1 complete; Phases 2
and 3 partially complete — create a character, run the live sheet, resolve checks by symbol
entry, and track wounds, strain, Story Points and Heat end to end. Verified headless: 181
checks, zero console errors. Remaining Phase 2/3 items and Phases 4–6 are unticked below.

---

## 1. What is being built

| | |
|---|---|
| **Game** | REICH '62 — Genesys narrative-dice system, alt-history 1962 occupied Europe |
| **Source** | `source/reich62_manual.md` (core rules + setting) · `source/reich62_bestiary.md` (adversary compendium) · `source/genesys_dice_breakdown.md` (die face distributions, D§) |
| **Audience** | Players; opt-in GM screen; official solo rules present → solo tab enabled |
| **Platforms** | Phone / browser / desktop — one installable PWA |
| **Core job** | Creation wizard + in-play tracker + native narrative-dice engine + Heat engine |
| **Multiplayer** | Local-first; Firebase party/combat sync architected day one, build gated behind First Session Playable |
| **Backend** | Firebase RTDB + Storage; local-only mode with zero config |
| **Theme** | See §1.2 |

**Scope boundary (§12):** rules mechanics only. The manual fuses rules and setting; the
following are **rules** and are in scope: Heat system, careers (skill lists + mechanical
notes), gear/weapons/armor/vehicles, solo oracle/tables, adversary framework, GM tables.
**Out of scope:** the setting preamble prose, §25 Sample Adventure Hook, §28 Tone Guidance
narrative essays, §20A Session Zero text (linked as a one-screen safety-tools note only,
paraphrased). All effect text is **paraphrased**, never copied.

### 1.1 Product Decisions

Recorded per template §4.2 and **confirmed 2026-08-04**. Template defaults were applied
where the user expressed no preference; all six are now settled and the roadmap in §11 is
instantiated to match.

| # | Decision | Value | State |
|---|---|---|---|
| 1 | Usage mode | Local-first, sync later (Phase 5 gated on First Session Playable) | confirmed |
| 2 | User's seat | Rotates — solo + GM + player all supported; solo loop is first-class because the manual publishes official solo rules (§18–§20, §23) | confirmed |
| 3 | Dice input | **Manual symbol entry, primary and built first** (R-B1) — it remains the default and always works. The face distributions arrived separately (D§), so the simulated roller behind `digitalRoller` is now unblocked and opt-in | confirmed; roller unblocked 2026-08-04 |
| 4 | Book commitment | **Both supplied books committed.** The bestiary is a companion volume filling the template's mandatory bestiary slot, not an optional expansion — its stat blocks populate `data-monsters.js` and ship **untoggled**. No `data-<expansion>.js`, no content toggles | confirmed |
| 5 | Table device | Mixed; phone-first baseline, 360px zero-overflow requirement holds | confirmed |
| 6 | Theme default | Follow system (`prefers-color-scheme`), in-app override | confirmed |

### 1.2 Visual theme proposal

Genre: occupation-era espionage / grim resistance drama. Trade dress is evoked, never
copied — **no Reich iconography, no historical insignia, no period propaganda imagery.**

- **Dark (default under most systems):** near-black paper (#12100E), oxidised-ink text
  (#E8E2D4), muted oxblood accent (#8C2F2A) for danger/Heat, brass-tarnish accent (#A98B4F)
  for Story Points.
- **Light:** dossier manila (#EDE5D2), carbon-black text, same two accents desaturated.
- **Typography:** condensed grotesque for headers (stencil/dossier feel), high-legibility
  sans for body, monospace for dice/log readouts.
- **Dice symbols:** custom inline SVG glyphs (success/advantage/triumph/failure/threat/
  despair) — original shapes, not the publisher's symbol set. Colour-coded **and**
  shape-coded (never colour alone — a11y).
- Heat track rendered as a 0–5 stepped bar that shifts oxblood as it climbs.

---

## 2. Extraction status

Two fully readable Markdown sources, both read cover-to-cover; every §3 slot below is
populated from them. **No value in this file comes from training-data memory of Genesys.**
Where both books are silent, the slot says so and the gap is logged in §4.

The bestiary is a **companion volume, not an errata or a rules revision**: it adds stat
blocks, NPC abilities, encounter templates, and one random table, and it cites the manual
for every mechanic it reuses. Where the two disagree on a *rule*, the manual wins; where the
bestiary prints a *stat*, the printed stat wins (R-15). One §3 slot moved as a result:
§3.18 went from "no stat blocks published" to a full compendium, so `data-monsters.js` is
reinstated.

---

## 3. System Profile (completed)

### 3.1 Core resolution mechanic — *narrative dice pool, symbol cancellation*

- Six die types (§1): Ability (green d8), Proficiency (yellow d12), Difficulty (purple d8),
  Challenge (red d12), Boost (blue d6), Setback (black d6).
- Symbols: Success 🌟 / Advantage 🔺 / Triumph ☀️ (positive); Failure 💥 / Threat 🔻 /
  Despair ⚡ (negative).
- **Pool build (§2):** higher of (skill rank, linked characteristic) = number of Ability
  dice; lower of the two = number of those upgraded to Proficiency. Unskilled = 0 upgrades.
  GM adds Difficulty dice per §3 ladder, may upgrade to Challenge. Boost/Setback added per
  situational advantage/impediment; they do **not** cancel pre-roll.
- **Modification order (§2.4), enforced by the engine:** assemble base → add → upgrade →
  downgrade → remove.
- **Resolution (§1):** cancel 🌟 vs 💥 1:1; cancel 🔺 vs 🔻 1:1; net 🌟 ≥ 1 = success,
  else failure. Leftover 🔺/🔻 narrated regardless of success. ☀️/⚡ are **never cancelled**
  and always true regardless of overall outcome.
- **Crit/fumble:** no natural-face crit. ☀️ and ⚡ are the dramatic swings; Critical Injury
  is a separate combat trigger (§3.10).
- **Push/re-roll economy:** none general. Re-roll exists only via the `Natural` talent
  (1/session, 2 chosen skills) and the NPC `Ruthless` ability (1/encounter). Story Points
  (§3.3) are the die-modification economy.
- **Die faces (R-B1, resolved):** face distributions are **not printed anywhere in the
  manual**, so for Phases 0–4 no simulated roller could be faithful and the app took
  **manual symbol entry** as its primary input. The distributions were then supplied as
  `source/genesys_dice_breakdown.md` (D§) and recorded in `data.js` as `DIE_FACES`, which
  unblocks `digitalRoller`. Manual entry stays the default and always works; the simulated
  roller is opt-in. Per-die faces: Boost and Setback d6 (two blanks each), Ability and
  Difficulty d8, Proficiency and Challenge d12 (one blank each). Triumph appears only on the
  Proficiency die and Despair only on the Challenge die, matching §1.

### 3.2 Opposed / contested procedure — *active roller only; opposition builds the difficulty side*

Exact sequence (§3A, confirmed against §11 social usage):
1. Active character builds their pool normally (§2).
2. The **difficulty side is built from the opposing character's** relevant skill/
   characteristic, using the ability-pool algorithm: higher value = number of Difficulty
   dice, lower value = number of those upgraded to Challenge.
3. **Only the active character rolls.** The opponent never rolls, banks nothing, and has no
   separate result.
4. Resolve per §1. Notation: "opposed Skill vs. Skill".
- **Competitive checks (§3A):** GM sets one Difficulty; all participants roll it; rank by
  total uncancelled 🌟. Ties are not specified in the manual → **R-3**: break by uncancelled
  🔺, then ☀️, then declare simultaneous.
- **Assisted checks (§3A/§5A):** the Assist maneuver grants an engaged ally 1 Boost on
  their next check; multiple assistants stack; unused dice expire after that next turn.
- **Initiative ties (§5):** broken by 🔺, then PC before NPC.

### 3.3 Meta-currencies & shared pools — *Story Points (two-pool), plus strain as a spendable*

**Story Points (§8):**
- Two visible pools: **Player pool** and **GM pool**. Starting Player pool = 1 per PC
  (some tables 2 — configurable, default 1). GM pool starting size is not stated → **R-4**:
  the GM pool starts at **0** and fills only from player spends.
- **Player spends:** upgrade *or* downgrade one die once on a check · add one Boost *or*
  Setback die · narrate a minor established detail · spend 1 to attempt an Impossible check
  (§3).
- **GM spends:** the same list, applied against the players.
- **Flow:** a spent point moves to the *other* pool once its effect resolves. Total points
  in circulation is therefore the effective cap.
- **Decay/reset:** none — unspent points carry over between sessions unless the GM rules
  otherwise.
- **Other movers:** Critical Injury 26–30 "Discouraging Wound" moves 1 point player→GM
  (reversed if the target is an NPC).
- **Talent spends:** Lucky Strike, Grenadier, Heroic Will, Indomitable each cost 1 SP.

**Strain** is the second spendable: 2 strain buys a 2nd maneuver (§5A), and 15 talents cost
strain to activate. Tracked as a vital (§3.10), not a pool.

**Heat** (§17) is a *negative* tracked resource, not a currency — see §3.9/§3.12.

### 3.4 Attributes & scales

Six characteristics: **Brawn, Agility, Intellect, Cunning, Willpower, Presence.**
Range 1–5; **max 5 at creation** and `Dedication` cannot exceed 5 either.
Generation: single method — **70 XP flat for every PC** (§13.2), characteristic increase
costs **10 × the new rating**, purchased sequentially, **creation only** (§7). No rolled
array, no point-buy variant, no species modifiers (all PCs human, §13).
The starting characteristic floor is not stated → **R-5**: all six start at **1** before XP,
which is what the sequential 10×N purchase model assumes.

### 3.5 Derived stats — *formulas exact; two base values missing*

| Stat | Formula | Note |
|---|---|---|
| Wound Threshold | `BASE_WOUND_THRESHOLD` (**8**) + Brawn | **fixed at creation**; raised later only by `Toughened` (+2/rank) |
| Strain Threshold | `BASE_STRAIN_THRESHOLD` (**10**) + Willpower | fixed at creation; raised by `Grit` (+1/rank) |
| Soak | Brawn + armour soak | **recalculates live** with Brawn, unlike thresholds |
| Melee Defense | 0 base; armour + cover + talents (`Defensive` +1/rank) | |
| Ranged Defense | 0 base; armour + cover (+1, more for prepared positions) + talents | |
| Encumbrance Threshold | 5 + Brawn | §5F |
| Incapacitated | wounds ≥ WT **or** strain ≥ ST | §6 |
| Hard points (items) | ceil(base encumbrance ÷ 2) | §14C, computed from *base* encum |
| Weapon damage | weapon base + 1 per uncancelled 🌟 | §5B |
| Unarmed damage | = Brawn; Crit 5, Engaged, Knockdown | §5H |
| Vehicle hull/system strain | per vehicle table, not derived | §12 |

**R-1 (confirmed):** the human **archetype base** is never printed (§6). Pregens (§16) imply
base WT 8 / ST 10 for Klaus and Elise, and WT 9 for Anna Voss. Resolution: base
**WT 8, ST 10**; Anna Voss's printed Wound 11 is an **erratum**, recomputed to 10
(`data-pregens.js` stores the recomputed value plus an `erratum` note, and the sheet shows
the correction inline). Both bases live in `data.js` as the two named constants above and
are referenced nowhere else, so a single edit corrects the whole app if the user later
supplies official values.

### 3.6 Skills — *26 skills, flat rank 0–5, career/non-career pricing*

- **General (16):** Athletics(Br), Computers(Int), Cool(Pr), Coordination(Ag),
  Discipline(Will), Driving(Ag), Mechanics(Int), Medicine(Int), Perception(Cun),
  Piloting(Ag), Resilience(Br), Skulduggery(Cun), Stealth(Ag), Streetwise(Cun),
  Survival(Cun), Vigilance(Will).
- **Social (5):** Charm(Pr), Coercion(Will), Deception(Cun), Leadership(Pr),
  Negotiation(Pr).
- **Knowledge (1):** Knowledge(Int), player-specified specialisation (free text).
- **Combat (4):** Brawl(Br), Melee(Br), Ranged(Ag), Gunnery(Ag).
- **Explicitly excluded (§4):** Alchemy, Astrocartography, Operating, Riding, Arcana,
  Divine, Primal.
- No trained/untrained gate — rank 0 is legal and simply yields 0 upgrades.
- No specialisation/focus mechanism beyond Knowledge free-text.
- **R-2:** talent `Basic Military Training` grants "Ranged (Heavy)", a split that does not
  exist in this manual's skill list → it grants **Athletics, Ranged, Resilience** instead.

### 3.7 Creation options — *career → 4 skills → 70 XP → derived → motivation → gear*

Rule-legal order (§13):
1. **Career** (11, §14) — each lists 8 career skills; player picks **4** and gains rank 1 in
   each before spending XP. All 8 remain career-priced for XP.
2. **70 XP** spent per §7 costs. **Skill ranks capped at 2 during creation** regardless of
   source. Characteristic raises are creation-only.
3. **Derived attributes** computed after XP spend.
4. **Motivation** — one each of Desire / Fear / Strength / Flaw (§12B, 10 entries each,
   rolled d100/d10 or chosen).
5. **Gear** — "standard starting budget or select from §15". The budget figure and the
   currency name are never stated (**R-8, confirmed**): the UI labels the unit **"credits"**
   (relabellable in Settings) and the starting budget is a Settings field defaulting to
   **500 credits**, rendered everywhere with a **"house aid — not a rule"** badge.

Careers (§14): Resistance Runner · SD/Gestapo Agent · Wehrmacht Veteran · Black-Market
Fixer · Party Bureaucrat · Displaced Survivor · Forger · Field Medic · Smuggler-Pilot ·
Foreign Intelligence Asset · Collaborator. Each carries a suggested Motivation pair
(advisory, not binding).

**Talent pyramid legality (§7/§12A):** before holding N talents in tier T, the character
must hold ≥ N talents in tier T−1. Ranked talents: each purchase beyond the first counts as
belonging to the next tier up for pyramid purposes (cost caps at tier 5). The wizard and the
advancement screen both enforce this.

### 3.8 Shared group entity — **PRESENT (lightweight): the Cell**

Not a statted entity with its own dice, but genuine campaign-level shared state (§17.2,
§16A, §24):
- **Cell Heat 0–5** (shared pool) with its own threshold effects.
- **Safehouse status** (clear / under watch / blown) driven by Cell Heat 3+.
- **Roster** of member characters and their Personal Heat (feeds the "any member at
  Personal Heat 3+ raises Cell Heat" rule).
- No creation wizard beyond name + starting Heat 0 (§21.3). Write access: GM, or any member
  in local/solo mode.

### 3.9 Conditions & statuses — *no unified list; assembled from six sources*

The manual has **no condition chapter**. The app's condition registry is assembled from:
1. **Critical Injury results (§9)** — 29 rows, most of which *are* conditions with exact
   mechanical effects and "until healed" durations. These auto-apply.
2. **Postures/states referenced in rules:** prone, staggered, disoriented, immobilised,
   incapacitated, blinded, encumbered, suffocating.
3. **Item-quality effects (§10):** Burn X, Concussive X (staggered X rounds), Disorient X
   (Setback for X rounds), Ensnare X (immobilised X rounds), Stun X.
4. **Heat thresholds (§17.3)** — Personal 1 (Setback on public checks) and Cell 2 (Setback
   on all members' public checks) are mechanical conditions.
5. **Encumbrance penalties (§5F)** — Setback per point over threshold; loss of free
   maneuver when over by ≥ Brawn.
6. **Environmental effects (§5E)** — concealment/cover/terrain dice.

**R-6/R-7 (confirmed):** "staggered" and "disoriented" are used (§9, §10, §12A, §12D) but
**never defined** in the manual. **Staggered = cannot perform actions** (maneuvers and
incidentals still allowed). **Disoriented = adds 1 Setback die to all checks.** Both carry
`inferred: true` in the condition registry and render an "inferred definition" badge in the
app. They drive 3 Critical Injury results (Stunned, Slightly Dazed, Knocked Senseless), the
Concussive X and Disorient X qualities, the `Counteroffer` talent, and the `Hardened`
adversary ability, and the §29 dread-check failure effect.
**Removal:** Critical Injuries persist until treated (§5G) and each untreated one adds **+10
to future Critical Injury rolls** — the app must track the cumulative modifier.

### 3.10 Health, damage & death

- **Two tracks:** wounds (vs Wound Threshold) and strain (vs Strain Threshold). Incapacitated
  when either is met or exceeded.
- **Damage:** weapon base + 1 per uncancelled 🌟, **reduced by Soak** → wounds. Some effects
  target strain instead (strain is not reduced by soak except for `Stun Damage` quality,
  which explicitly still is).
- **Critical Injury triggers (§5.7/§5B):** uncancelled 🔺 ≥ weapon Crit rating · spending
  🔺🔺 · an uncancelled ⚡. Roll d100 on §9 with modifiers: **+10 per existing untreated
  Critical Injury**, `Vicious X` **+10×X**, `Durable` **−10/rank (min 01)**, falling **+50 /
  +75** (§5I).
- **Death procedure — guided UI required:**
  - 151+ on the table = **Dead, cannot be revived.**
  - 141–150 "The End Is Nigh" = dies at end of the **next round** unless healed first
    (timed, must be surfaced as a countdown).
  - 131–140 "Bleeding Out" = 1 wound + 1 strain per turn until healed; **+5 wounds beyond
    threshold triggers an additional Critical Injury roll.**
  - Suffocation (§5I): 3 strain/round; once strain > ST, incapacitated, then **one extra
    Critical Injury roll every subsequent turn** until it stops or death.
  - **Escape hatch:** `Indomitable` (T5) — once/encounter, spend 1 SP to delay
    incapacitation until end of next turn; cancelled entirely if the character drops back
    below threshold in time.
  - **Rivals:** GM may rule killed outright when WT is exceeded (§12C). **Minions:** any
    Critical Injury result instantly kills one minion.

### 3.11 Rest & recovery — *limits are rules and are enforced*

| Method | Restores | Limit |
|---|---|---|
| End of encounter | Simple(–) Discipline or Cool; 1 strain per uncancelled 🌟 | once per encounter |
| Full night's rest | 1 wound; **all** strain | per night |
| Full week's rest | Resilience check vs the injury's severity → heal 1 Critical Injury | once per week |
| Medicine check | wounds = uncancelled 🌟, strain = uncancelled 🔺 | **once per encounter per target** |
| Medicine (Critical Injury) | difficulty = the injury's severity | **once per week per injury** |
| Painkillers | 5/4/3/2/1/0 wounds on the 1st…6th+ use; never heals Criticals | per-day counter, resets daily |
| Vehicle system strain | 1/day if undamaged, or Damage Control action | per day |

Medicine difficulty: Easy if wounds ≤ ½ WT · Average if > ½ · Hard if wounds > WT.
Modifiers: **self-treatment +2 difficulty**, **no medical equipment +1**.
Talent interactions: `Surgeon` (+1 wound/rank), `Painkiller Specialization` (+1 wound/rank,
6th+ still 0), `Desperate Recovery` (+2 strain if over half ST), `Second Wind`
(1/encounter, heal strain = ranks), `One With Nature` (Survival substitutes for the
end-of-encounter check in wilderness).

### 3.12 Scene / session / adventure lifecycle — *app owns the boundary events*

| Boundary | Bundle fired |
|---|---|
| **End Encounter** | strain-recovery check prompt · clear once-per-encounter flags (Second Wind, Berserk, Counteroffer-per-session excluded, Ruthless, Fan The Hammer, Eagle Eyes, Overcharge, Ruinous Repartee, Indomitable, Fear-X first-engagement flags) · clear Auto-fire "out of ammo for the encounter" states · expire round-duration effects |
| **End Scene** | expire scene-duration effects · Heat threshold re-check (§22.4) · clear per-scene dread-check flags (§29: one roll per circumstance per scene) |
| **End Session** | award XP: **20 base ±5 for length, +5 Motivation bonus** · **Personal Heat −1** if the session was low-risk downtime · Cell Heat decay check · clear once-per-session talents (Know Somebody, Natural, Counteroffer, How Convenient!, Mad Inventor) · Story Points **carry over** (no reset) |
| **End Day** | painkiller counter reset · vehicle system-strain recovery |
| **End Week** | Critical-Injury rest check availability · Medicine per-injury limit reset |
| **End Adventure** | resolve any PC at Personal Heat 5 → go underground (**Heat resets to 2**) or captured (Oracle/GM) |

Each boundary presents a **confirmation summary** listing every delta, and supports
**one-step undo**.

### 3.13 Extended / progress tasks — *one published extended check (bestiary), plus tracked ladders*

The manual defines **no** extended-test or progress-clock subsystem. The **bestiary supplies
the only published one**: the Manhunt/Dragnet encounter block (B§6).

- **Manhunt / Dragnet (B§6)** — a **multi-round extended opposed check**: the fugitive rolls
  Stealth or Streetwise each round against a Perception pool that **starts at 2 Ability dice
  and gains +1 per in-game hour the dragnet runs, capped at 4**. **Every failed round
  advances Personal *and* Cell Heat by 1.** It ends when the PC leaves the search zone. This
  is a real progress task with an escalating opposition track and a Heat coupling — the
  generic tracker component must support both.
- **Heat tracks** (Personal 0–5, Cell 0–5) — the campaign-level progress mechanic.
- **Item damage ladder** (undamaged → minor → moderate → major → destroyed, §10 Sunder /
  §14B) with per-level repair difficulty, time, and cost.
- **Repair jobs** (§14B): 1–2 hours per difficulty level, halved time = +1 difficulty,
  no tools = +1, cumulative.
- **Ad-hoc adventure clocks** (the sample adventure uses "3 in-game days"; §20B pacing) —
  provided as a **labelled house aid**, not presented as an official rule.
- **Reinforcements (B§2, Roadblock Soldiers)** — a round counter: at 3+ rounds the GM may add
  a minion to the group. Modelled as a round-triggered encounter flag, not a clock.

### 3.14 Powers / magic — **ABSENT**

No magic, no psionics, no super-science (setting is explicitly "realistic 1960s tech only";
§4 excludes Arcana/Divine/Primal). **No `power-automation.js`, no powers tab, no `powers`
schema branch.** Instead, **every talent with a dice or resource effect is automated in the
roller ("tap to use")** — 71 talents, of which ~40 have direct mechanical hooks.

### 3.15 Advancement

| Purchase | Cost |
|---|---|
| Characteristic → new rating N | 10 × N, sequential, **creation only** |
| Career skill → new rank N | 5 × N |
| Non-career skill → new rank N | (5 × N) + 5 |
| Talent (tier T) | 5 × T (5/10/15/20/25) |

Gates: talent pyramid (§3.7) · skill rank ≤ 2 during creation · characteristics locked after
creation (only `Dedication`, max 5, raises them later; **cannot raise the same
characteristic twice**).
Earning: **20 XP per 3–5 hour session** (25 fast / 15 slow; ±5 for length), **+5 for
meaningful Motivation play**. **No kill/combat XP.**
Identity mechanics feeding advancement: the four Motivation facets (§12B), which are also
social-encounter attack surfaces (§11).

### 3.16 Inventory, encumbrance & wealth

- **Encumbrance:** per-item value (small 1–2, medium 3–4, large 5–6). 10 loose incidentals =
  1 encum; 20 organised incidentals = 1 encum. Threshold **5 + Brawn**.
  Over threshold: **Setback per point over** on all Agility/Brawn checks. Over by
  **≥ Brawn**: lose the free maneuver (each maneuver costs 2 strain). Enforced, not warned.
- **Lifting over threshold:** Athletics, Easy at 1 over, +1 difficulty per additional point,
  capped Daunting at 4+. Helpers add their Brawn to the effective threshold.
- **Wealth:** concrete integer prices (§15, §15C–E). The currency is unnamed in the manual;
  R-8 labels it **credits** (relabellable) with a 500-credit starting budget as a house aid.
- **Rarity 0–10** (§14A) with a difficulty ladder and **location modifiers** (−1 major city /
  +0 mid-size / +1 rural / +2 frontier or restricted item / +3 crackdown / +4 lockdown).
  Acquisition = Negotiation (legal) or Streetwise (illegal) at the rarity difficulty.
  Rarity > 10 stays Formidable but upgrades the difficulty once per point over.
  `Know Somebody` reduces rarity by 1/rank, once/session, legal goods only.
- **Selling:** same check; **¼ price** on success, **½** with 🌟🌟, **¾** with 🌟🌟🌟+.
- **Quality/durability:** 4-step damage ladder with repair difficulty/penalty/cost (§14B);
  self-repair cost −10% per uncancelled 🔺.
- **Attachments (§14C):** hard points = ceil(base encum ÷ 2); install = ~1 hour + Average
  Mechanics; failure with 🔻🔻 destroys the attachment. Three documented attachments.

### 3.17 Combat structure

- **Initiative (§5, §5A'):** every participant rolls Simple(–) **Cool** (planned/anticipated)
  or **Vigilance** (surprise/ambush; default when unsure). Rank by uncancelled 🌟, tie → 🔺,
  tie → PC first. This produces an ordered list of **slots tagged PC or NPC**.
  **Slot filling:** order and ownership are fixed for the whole encounter; each round, at
  each slot, the owning side chooses which of its not-yet-acted members takes it. The app's
  combat tracker must model **slots, not a fixed character order** — this is the single most
  distinctive combat rule in the system.
- **Turn budget:** 1 action + 1 free maneuver; a **2nd maneuver costs 2 strain**; hard cap 2
  maneuvers per turn (out-of-turn GM-granted maneuvers don't count). Incidentals unlimited
  within reason. An action may be exchanged for a maneuver (still capped at 2).
- **Maneuvers (9, §5A):** Aim · Assist · Guarded Stance · Interact with Environment ·
  Manage Gear · Mount/Dismount · Move · Drop Prone / Stand · Preparation.
- **Actions (4 types, §5B):** exchange for maneuver · activate talent · skill check ·
  combat check.
- **Combat check:** melee always **Average**; ranged difficulty by range band
  (Engaged/Short Easy · Medium Average · Long Hard · Extreme Daunting).
- **Movement:** abstract **5 range bands** (Engaged ⊂ Short, Short, Medium, Long, Extreme).
  short↔medium = 1 maneuver; medium↔long and long↔extreme = 2 each. Difficult terrain
  doubles maneuvers; impassable requires an Athletics/Coordination **action**.
- **Reactions (out-of-turn incidentals):** Parry, Parry (Improved), Dodge, Side Step,
  Rapid Reaction, Clever Retort, Forgot To Count?, Barrel Roll, Heroic Will, Indomitable.
- **Silhouette (§5J):** 0–4 used. Target ≥2 silhouettes larger: **−1 difficulty**; ≥2
  smaller: **+1 difficulty**.
- **Multiple attackers (§5C''):** no fixed numeric bonus — GM-applied situational dice only,
  explicitly *not* automatic. Implemented as an optional GM toggle, labelled as discretionary.
- **Two-weapon combat (§5H):** lower of each skill/characteristic, higher of the two
  difficulties **+1**; primary hits on success, secondary requires 🔺🔺 or ☀️.
- **Second scale — vehicles (§12):** same engine, personal-scale damage, 5 range bands.
  Vehicle maneuvers (Accelerate, Decelerate, Evade, Reposition, Brace) and actions (combat
  check, Dangerous Driving, Gain the Advantage, Damage Control). Pilot acts on their own
  turn; passengers act independently on theirs. Crash = hull trauma equal to current speed.
- **Third scale — social (§11):** narrative by default, optional rounds; uses its own spend
  table and the Motivation-reveal ladder.
- **Four distinct spend tables** must be selectable by context: combat (§5C), generic
  non-combat (§5C'), social (§11), vehicle (§12).

### 3.18 Bestiary & NPCs — **PRESENT: 32 published entries + build recipes**

The **manual** publishes zero stat blocks; the **bestiary companion supplies all of them**,
built on the manual's own §12C/§12D framework. The app therefore ships **both** a bestiary
browser and an NPC builder.

**From the manual — the framework (`data-npcs.js`):**
- **Adversary tiers (§12C):** Minion (no strain track, group-shared WT, group skill ranks =
  members−1, any Critical kills one), Rival (no strain track, Criticals normal, may die at
  WT), Nemesis (full PC-equivalent, has a strain track).
- **Adversary talent** (ranked, passive): upgrade difficulty of all combat checks targeting
  them once per rank. Every published Rival has Adversary 1; every Nemesis has Adversary 2.
- **7 adversary special abilities (§12D)**, of which the bestiary uses 6 (Fear X,
  Interrogator's Eye, Chain of Command, Hardened, Web of Informants, Ruthless) and reflavours
  the 7th (Environmental Affinity — Urban → Wilderness, on the Hound Handler).
- **NPC quick-gen (§20)** and **encounter sizing (§20B)**.
- **Threat guidance:** 2–3 minions ≈ one starting PC; 3–4 ≈ a 100-XP PC; 1 rival ≈ one PC;
  soak 5+ / WT 14+ / 3+ skill ranks / 9+ damage pushes a rival to "very challenging". Four
  published Rivals cross that line — the browser flags them.

**From the bestiary — the compendium (`data-monsters.js`):**
- **10 minion groups** (B§2), each with characteristics, group skill list, **per-member Wound
  Threshold** (3–5), equipment, and one **unique ability**. One is abstract: the Informant
  Network has no combat stats and resolves as an Oracle roll.
- **12 rivals** (B§3) with characteristics, Soak, Defense (melee/ranged), Wound Threshold,
  skills at ranks 1–3, abilities, equipment.
- **4 nemeses** (B§4) with the above **plus Strain Thresholds**, 5–6 skills, 2–3 abilities,
  Adversary 2, and narrative-use notes.
- **2 animals** (B§5) — Guard Dog, Patrol Horse — with their own abilities and attack profiles.
- **4 abstract encounter blocks** (B§6): Checkpoint, Search Detail, Manhunt/Dragnet,
  Interrogation. These are **resolution templates, not creatures** — each names the opposed
  skills, the opposition pool size, and the Heat consequence, so the app deploys them as
  pre-built opposed checks rather than combatants.
- **Random encounter table** (B§7, d10, 10 rows) — feeds the GM screen and solo mode.
- **14 abilities defined only in the bestiary**, not in §12D: Papers-Check Reflex, Beat
  Familiarity, Disciplined, Manifest Cross-Check, Quota Pressure, Terrain-Wise, Everywhere,
  Shoot on Sight, Reinforcements, Passive Watch, Environmental Affinity — Wilderness, Keen
  Senses, Bite, Mount. These extend the §12D catalog and are stored alongside it.

**Printed NPC stats are authoritative and are never recomputed from PC formulas (R-15)** —
several published blocks (Nemesis thresholds, the Patrol Horse's Soak) do not match the PC
derivations, which is expected for NPCs built to a threat budget.

Six abilities carry direct **Heat hooks** (Papers-Check Reflex, Passive Watch, the Checkpoint
and Dragnet blocks, Hartmann Voss's Cell-Heat-4 escalation, the random table's Cell-Heat-4
row), so `heat.js` and the bestiary are wired together, not independent.

### 3.19 Pre-generated characters — **PRESENT (3, partial)**

Anna Voss (Resistance Runner) · Klaus Reiniger (SD Agent, defecting) · Elise Bauer
(Black-Market Fixer). Each has 6 characteristics, 4 skill ranks, WT/ST/Soak, and gear.
**Each has 70 XP explicitly unspent** and **no Motivation and no talents assigned** — so
one-tap instantiation must drop the player into the wizard's XP-spend and Motivation steps,
not a finished sheet. They run on **PC rules**. Their printed thresholds are the evidence
behind ruling R-1: Klaus and Elise match base WT 8 / ST 10 exactly, Anna Voss's Wound 11
does not and is stored as a corrected 10 with an `erratum` note.

### 3.20 Solo rules — **PRESENT, official → solo tab enabled**

- **Oracle (§18):** Likely 2🎲 vs 1💠 · 50-50 2🎲 vs 2💠 · Unlikely 1🎲 vs 2💠. Net success =
  Yes · net failure = No · uncancelled ☀️ = "Yes, and" · uncancelled ⚡ = "No, and" (feeds
  Heat if the question was in a surveilled context) · net 🔺/🔻 with no net success/failure =
  "Yes, but / No, but".
- **Random Event (§19):** triggered by any ☀️/⚡ oracle result — category (5 bands) + subject
  (5 bands), skewed favourable/escalating by which symbol fired.
- **Meaning tables (§15A):** Action d10 × Subject d10.
- **Element tables (§15B):** Location d10, Faction d10, Complication d10.
- **NPC quick-gen (§20)** and the **solo play loop (§23)**, including "at Personal Heat 4–5,
  the Oracle resolves raid timing instead of GM fiat".

### 3.21 GM tables (power the GM screen reference panel)

Critical Injury d100 (§9) · Random Event (§19) · NPC quick-gen (§20) · Meaning (§15A) ·
Element ×3 (§15B) · encounter sizing (§20B) · difficulty ladder + per-skill guidance (§3) ·
four spend tables (§5C, §5C', §11, §12) · Heat thresholds (§17.3) · dread-check severity
ladder (§29) · rarity ladder + modifiers (§14A) · item damage/repair (§14B) · falling (§5I) ·
silhouette (§5J) · GM one-page quick reference (§30) · **random encounter table (B§7, d10)** ·
**the 4 encounter blocks (B§6) as one-tap deployable opposed checks** · **the bestiary browser
itself** (filter by tier / Heat relevance / threat flag, drop straight into the combat
tracker).

---

## 4. Rulings — **ALL CONFIRMED 2026-08-04**

Every gap either source left is resolved. Nothing below is open; **no ruling may be silently
re-litigated during the build** — cite the ruling ID in a `// R-x` code comment wherever it
is implemented, and surface an in-app badge wherever it is a *substitution* for a printed
rule (R-B1, R-1, R-6, R-7, R-8, R-9 — see "Badge" column). R-15…R-19 arrived with the
bestiary and were confirmed 2026-08-04 alongside the rest.

Every ruling is also a **regression assertion** (§13.5): the harness pins the value so a
later edit cannot drift away from it.

| ID | Issue (manual §) | Confirmed ruling | Badge | Implemented in |
|---|---|---|---|---|
| **R-B1** | Die **face distributions** never printed (§1 lists only which symbols each die can show) | **Manual symbol entry is the primary and default dice input** — the app performs cancellation, spends, damage, Critical Injuries, Heat, and logging on entered symbols. The simulated roller stayed behind `digitalRoller`, force-disabled, until `DIE_FACES` was supplied. **Face data supplied 2026-08-04 as D§ → the toggle is unblocked and opt-in; manual entry remains the default** | yes — roller footer | `roller.js`, `settings.js`, `data.js` |
| **R-1** | Human **archetype base** WT/ST absent (§6); pregens imply WT 8/9, ST 10 (§16) | Base **WT 8** / **ST 10**, as the two named constants `BASE_WOUND_THRESHOLD` / `BASE_STRAIN_THRESHOLD`. **Anna Voss's printed Wound 11 is an erratum → 10** | yes — wizard derived step + Anna's sheet | `data.js`, `derived.js`, `data-pregens.js` |
| **R-2** | `Basic Military Training` grants "Ranged (Heavy)" (§12A T2); this manual has one undivided `Ranged` skill (§4) | The talent grants **Athletics, Ranged, Resilience** as career skills | no | `data.js` T33 |
| **R-3** | Competitive-check **ties** unspecified (§3A) | Rank by uncancelled 🌟; ties broken by uncancelled 🔺, then by ☀️, then declared **simultaneous** | no | `roller.js` comparator |
| **R-4** | **GM Story Point pool** starting size unstated (§8) | GM pool starts at **0**. Player pool starts at **1 per PC** (Settings allows 2 per §8's "some tables"). Points enter the GM pool only by player spends | no | `data.js` T25, `store.js` |
| **R-5** | Characteristic **starting floor** before XP unstated (§13) | All six characteristics start at **1**; the sequential 10×N cost then reproduces standard totals | no | `wizard.js` |
| **R-6** | "**Staggered**" used but never defined (§9, §10, §12A, §12D) | **Staggered = cannot perform actions**; maneuvers and incidentals are unaffected | yes — condition chip | `data.js` condition registry |
| **R-7** | "**Disoriented**" used but never defined (§9, §10, §29) | **Disoriented = adds 1 Setback die to all checks** | yes — condition chip | `data.js` condition registry |
| **R-8** | Starting **gear budget** and **currency name** absent (§13.5; §15 prices are bare integers) | Currency labelled **"credits"** (relabellable in Settings); starting budget a Settings field, default **500** | yes — wizard gear step | `settings.js`, `wizard.js` |
| **R-9** | Week-rest Critical healing says "on **⚡** an additional Critical Injury heals" (§5G) — a Despair granting a benefit contradicts §1 | Read as **☀️ Triumph**; the extra heal triggers on an uncancelled Triumph | yes — recovery screen | `data.js` T19 |
| **R-10** | Oracle/event/quick-gen tables say "roll 1🎲" and §15A calls it "an Ability die read 1–10", but §1 defines the Ability die as a **d8** (§15A, §19, §20) | Use a **d10** for every oracle, meaning, element, random-event, and NPC quick-gen table. (These are table lookups, not symbol rolls, so R-B1 does not apply — the app rolls them digitally) | no | `data-solo.js`, `data-npcs.js` |
| **R-11** | 12 talents reference content absent from this setting (hacking-rule page refs, bows, starfighters, cybernetics, animal companions) | Keep **all 71** for completeness; tag the 12 `settingApplicable: false`; hide them behind `showNonSettingTalents`, default **off**. Affected: Defensive Sysops, Defensive Sysops (Improved), Distinctive Style, Animal Companion, Rapid Archery, Barrel Roll, Full Throttle, Daring Aviator, Defensive Driving, Overcharge, Overcharge (Improved), Mad Inventor | no | `data.js` T33, `settings.js` |
| **R-12** | §5C lists "🔺🔺 **or** ☀️" rows — ambiguous whether one ☀️ substitutes for 2–3 🔺 | Plain reading: **one ☀️ purchases any listed effect at any cost tier**; 🔺 costs are literal. ☀️ is never consumed by cancellation and each ☀️ buys one effect | no | `roller.js` spend tables |
| **R-13** | TOC advertises "18 items" in §15; the section lists **17** | Ship **17**; the count is recorded as 17 in §5 and in the T40 ledger row | no | `data.js` T40 |
| **R-14** | Critical Injury table runs to **151+** but the stated roll is a d100 (§9) | Correct as written: the app sums **roll + modifiers** (+10 per untreated injury, Vicious 10×X, falls +50/+75, Durable −10/rank floored at 01) and indexes the summed value, which is how results past 100 are reached | no | `roller.js`, `derived.js` |
| **R-15** | Several published NPC stats do not match the PC derivations — nemesis Wound/Strain Thresholds far exceed base + characteristic, and the Patrol Horse's Soak 3 is below its Brawn 4 (B§3–B§5) | **Printed NPC/animal stats are authoritative as printed and are never recomputed.** `derived.js` computes for PCs only; bestiary entries load their stats verbatim. NPCs built in the NPC builder from §12C recipes *do* derive, and are stored with `derivedFrom: "recipe"` to keep the two paths distinguishable | no | `derived.js`, `data-monsters.js` |
| **R-16** | The Guard Dog is printed as "Wound Threshold 4 (Minion-equivalent single unit, or run as a lone Rival-lite …)" (B§5) — two tiers offered, none chosen | Default **minion tier, group size 1**; the combatant card offers a one-tap "promote to Rival" that grants Criticals-resolve-normally and keeps WT 4. Stored as `tier: "minion"`, `promotable: true` | no | `data-monsters.js`, `combat.js` |
| **R-17** | The bestiary writes Defense as `X/Y` (e.g. "Defense: 0/1") without naming the order (B§3–B§5) | Read as **melee/ranged**, matching the §16A character-sheet field order (Melee Defense then Ranged Defense) | no | `data-monsters.js` |
| **R-18** | Minion groups print a **per-member** Wound Threshold ("4 per member"), while §12C defines the group threshold as the sum of members' thresholds | Consistent, not contradictory: store the printed **per-member** value and let `combat.js` compute group WT = per-member × group size, so resizing a group recomputes correctly and the "one minion drops per member's share" rule stays exact | no | `data-monsters.js`, `combat.js` |
| **R-21** | §5's turn-budget summary reads "1 action + 2 maneuvers, or 2 maneuvers and strain for a third", while §5A gives one free maneuver, a second for 2 strain, and never more than two | **§5A's detailed rule governs**: one free maneuver, a second costing 2 strain, hard cap of two. Out-of-turn maneuvers granted by the GM do not count against the cap | no | `data.js` `MANEUVER_RULES`, `combat.js` |
| **R-20** | The supplied face table (D§) prints the Proficiency 12 face as **Triumph alone** and the Challenge 12 face as **Despair alone**; no supplied source says a Triumph also counts as a Success or a Despair as a Failure | Store both **exactly as printed** — Triumph and Despair are their own symbols, never cancelled (§1), and they do not add a Success or Failure to the tally. Nothing is inferred from outside the supplied sources | no | `data.js` `DIE_FACES` |
| **R-19** | The bestiary's minion abilities `Disciplined` (immune to Disorient) and §12D's `Hardened` (immune to Disorient **and** Stagger) overlap but differ (B§2 vs §12D) | Keep both as distinct entries; `Disciplined` is the narrower one. Neither is a rename of the other | no | `data-npcs.js` |

---

## 5. Content inventory (extraction scale)

| Category | Count | Manual § |
|---|---|---|
| Die types / symbols | 6 / 6 | §1 |
| **Die faces** | **56** (Boost 6 · Setback 6 · Ability 8 · Difficulty 8 · Proficiency 12 · Challenge 12) | D§ |
| Difficulty levels | 7 (+ per-skill guidance: 7 skills × 4 tiers) | §3 |
| Characteristics | 6 | §4 |
| Skills | 26 (16 general · 5 social · 1 knowledge · 4 combat) | §4 |
| Maneuvers | 9 | §5A |
| Action types | 4 | §5B |
| Advantage/Threat spend tables | 4 (combat, generic, social, vehicle) + initiative row | §5C, §5C', §11, §12 |
| Range bands | 5 | §5D |
| Environmental effect entries | 6 | §5E |
| Falling table rows | 4 | §5I |
| Silhouette rows | 6 | §5J |
| Derived-stat formulas | 12 | §6 |
| XP cost rules | 4 + gates | §7 |
| Story Point spends | 4 player / 4 GM | §8 |
| **Critical Injury results** | **29 rows** (01–151+; 8 Easy · 10 Average · 7 Hard · 3 Daunting · Dead). *Plan-stage estimate was 22; the real count is 29 (ledger rule: real counts win).* | §9 |
| **Item qualities** | **27** | §10 |
| **Talents** | **71** (T1 24 · T2 15 · T3 16 · T4 11 · T5 5) | §12A |
| Motivation entries | 40 (4 tables × 10) | §12B |
| Adversary tiers | 3 + Adversary talent | §12C |
| Adversary special abilities | 7 | §12D |
| **Careers** | **11** (8 listed skills each) | §14 |
| Rarity ladder / modifiers | 6 rows / 6 modifiers | §14A |
| Item damage levels | 3 (+ destroyed) | §14B |
| Attachment examples | 3 | §14C |
| **Gear items** | **17** (TOC says 18 — R-13) | §15 |
| **Weapons** | **10** | §15C |
| **Armour** | **6** | §15D |
| **Vehicles** | **17** | §15E |
| Solo tables | 8 (Action, Subject, Location, Faction, Complication, Event ×2, NPC ×2) | §15A, §15B, §19, §20 |
| Pregens | 3 (partial — 70 XP unspent) | §16 |
| Heat threshold rows | 5 × 2 tracks | §17.3 |
| Oracle likelihoods | 3 | §18 |
| Encounter sizing rows | 6 | §20B |
| Dread severity rows | 4 | §29 |
| Skill usage examples | 14 | §26 |
| **— bestiary companion —** | | |
| **Minion groups** | **10** (1 abstract, no combat stats) | B§2 |
| **Rivals** | **12** | B§3 |
| **Nemeses** | **4** | B§4 |
| **Animals** | **2** | B§5 |
| **Abstract encounter blocks** | **4** (Checkpoint, Search, Dragnet, Interrogation) | B§6 |
| Random encounter table | 1 (d10, 10 rows) | B§7 |
| **Bestiary-only NPC abilities** | **14** (extend the 7 in §12D) | B§2–B§5 |
| **Total published stat blocks** | **28** (+ 4 encounter templates) | B§2–B§6 |

---

## 6. Architecture — LOCKED

Carried from template §5, unchanged. No build step; vanilla ES modules; installable PWA
(`manifest.json`, versioned `service-worker.js`, SVG icon, update toast); `localStorage`
local-only mode with zero config; `firebase-config.js` placeholder + `FIREBASE_ENABLED`;
Firebase RTDB + Storage (portraits canvas-compressed to ~400px); anonymous auth with
optional Google linking; `members/{uid}.role` in schema **and** `database.rules.json` from
day one; fantasy-phrase join codes; themed `modal()`/`showToast`/`confirmModal`/
`promptModal` (no native dialogs); a11y (`aria-live` roll + vitals, labelled icon buttons,
`aria-current` nav); phone-first, **zero horizontal overflow at 360px**.

## 7. File structure — LOCKED (instantiated for this game)

| File | Purpose | Status |
|---|---|---|
| `index.html` | App shell: header, bottom nav, screen mount, module entry | **present** |
| `styles.css` | Theme (§1.2) light + dark + components | **present** |
| `data.js` | Core rules library — every §3 list/table/formula | **present** |
| `data-npcs.js` | Adversary recipes, the 7 §12D abilities + 14 bestiary abilities, quick-gen tables, encounter sizing | **present** |
| `data-monsters.js` | **Bestiary compendium** — 10 minion groups, 12 rivals, 4 nemeses, 2 animals, 4 encounter blocks, random encounter table | **present** |
| `data-pregens.js` | 3 published pregens | **present** |
| `data-solo.js` | Oracle, Random Event, Meaning, Element tables | **present** |
| ~~`data-<expansion>.js`~~ | **Omitted — no expansion books; the bestiary is committed core content, untoggled** | n/a |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` | **present** |
| `database.rules.json` | RTDB rules (player/GM roles; Cell write rules) | **present** |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA | **present** |
| `tests/`, `package.json` | Headless regression harness (`npm test`), dev-only `playwright-core` | **present** |
| `README.md` | Setup + Firebase steps + personal-use licensing note | **present** |
| `CLAUDE.md` | This file | **live** |
| `source/reich62_manual.md` | Source of record — core rules (`§x` citations) | present |
| `source/reich62_bestiary.md` | Source of record — adversary compendium (`B§x` citations) | present |
| `source/genesys_dice_breakdown.md` | Source of record — die face distributions (`D§` citations) | present |
| `source/BUILD_TEMPLATE_v2.md` | The build template this spec instantiates | present |

### 7.1 `src/` module map — LOCKED

| Module | Responsibility | Reich '62 specifics |
|---|---|---|
| `core.js` | Constants, DOM/util helpers, raw dice primitives. No imports | symbol enum, cancellation primitive |
| `ui.js` | Themed modals/toasts/confirm/prompt, plus the layout primitives: self-describing panels, accordions, sub-tabs, empty states, persistent outcome boxes, number steppers | dice-symbol glyph renderer |
| `rules.js` | Pure lookups over data files | talent lookup, pyramid legality, rarity resolution, difficulty ladder, bestiary lookup + threat-flag evaluation |
| `derived.js` | Derived calculations + data normalisation/migration | WT/ST/Soak/Defense/encumbrance, cumulative Critical-Injury modifier |
| `settings.js` | Feature toggles | solo · GM screen · digital roller (R-B1 gated) · non-setting talents (R-11) · currency label + starting budget (R-8) · GM discretionary dice (§5C'') |
| `store.js` | Local/cloud persistence, Cell entity, combat mirroring, JSON export/import | Cell + Heat persistence |
| `sync.js` | Firebase auth, campaigns, join codes, presence, theme | Phase 5 |
| `wizard.js` | Creation wizard + pregens | career → 4 skills → 70 XP → derived → Motivation → gear |
| `roller.js` | **Dice engine**: pool build, modification order, symbol entry, cancellation, opposed sequence (§3.2), Story Point spends, spend-table application, damage applier, Critical Injury roller, **roll-log writes** | four context-specific spend tables |
| `sheet.js` | Character sheet, in-play tracking, **persistent resource header** | header = wounds · strain · Story Points · **Personal Heat** · encumbrance |
| `combat.js` | Combat tracker: **initiative slots (§5A')**, turn/maneuver budget with strain cost, combatant cards, generic progress tracker (§3.13), lifecycle events (§3.12) | slot-filling model, vehicle scale, bestiary drop-in, minion-group WT from per-member value (R-18), Dragnet extended check |
| `heat.js` | **New module (game-specific):** Heat generation (§17.1), Personal/Cell thresholds and their auto-applied effects, decay, surveilled-context flag | — |
| `solo.js` | Oracle, Random Event, Meaning/Element tables, solo loop | enabled (official rules) |
| `gm.js` | GM dashboard + rollable §3.21 reference tables | bestiary browser, random encounter roll (B§7), one-tap encounter blocks (B§6) |
| `rules-index.js` | Builds the searchable rules library over every extracted table | flat cited entries, §/B§ searchable |
| `help.js` | Plain-language layer: term glosses, per-panel copy, seat definitions | leads with everyday wording, book term second |
| `screens.js` | Home/rules/about renderers, party banner, roll-log view | rules library with §-anchored search |
| `router.js` | Bottom-nav routing, conditional tab gating | — |
| `main.js` | Entry / boot | — |
| ~~`power-automation.js`~~ | **Omitted — no power subsystem (§3.14)** | n/a |

Adding/moving a `src/` file updates this table **and** the service-worker app-shell list,
and bumps `CACHE_VERSION`, in the same change.

## 8. Data model (Firebase) — LOCKED shape, game field names

```
campaigns/{campaignId}
  meta:    { name, joinCode, createdAt, ownerUid }
  members/{uid}: { displayName, characterId, role: "player" | "gm" }
  cell:    { name, cellHeat: 0-5, safehouseStatus: "clear"|"watched"|"blown" }   // §3.8
  pools:   { storyPointsPlayer: int, storyPointsGM: int }                        // §3.3
  combat:  { active, round,
             slots: [ { id, owner: "pc"|"npc", order, filledBy: charId|null } ], // §5A'
             combatants: { id: { name, wounds, woundThreshold, strain,
                                 strainThreshold, soak, meleeDef, rangedDef,
                                 silhouette, tier: "minion"|"rival"|"nemesis",
                                 minionCount, woundThresholdPerMember,      // R-18
                                 sourceId, sourceBook: "manual"|"bestiary", // provenance
                                 derivedFrom: "printed"|"recipe",           // R-15
                                 abilities[], actedThisRound, conditions{},
                                 maneuversUsed, actionUsed, criticalInjuries[] } },
             vehicles: { id: { speed, handling, hullTrauma, systemStrain, ... } } }
  tasks/{taskId}: { name, kind: "heat"|"repair"|"clock"|"dragnet",     // dragnet = B§6
                    progress, target, contributors[],
                    oppositionDice, elapsedHours }                     // dragnet only
  rollLog/{pushId}: { by, characterName, poolInputs{ability,proficiency,difficulty,
                      challenge,boost,setback}, symbols{}, net{}, outcome,
                      spends[], storyPointDeltas, heatDelta, ts }               // cap ~100
  broadcast/{pushId}: { text, ts, from }

characters/{characterId}
  owner, campaignId
  identity:  { name, career, careerSkills[4], motivation:{desire,fear,strength,flaw},
               knowledgeSpecialisation, appearance, portraitUrl }
  attributes:{ brawn, agility, intellect, cunning, willpower, presence }         // 1-5
  derived:   { woundThreshold, strainThreshold, soak, meleeDefense, rangedDefense,
               encumbranceThreshold }                                            // §3.5
  state:     { wounds, strain, criticalInjuries[ {roll,severity,name,healed} ],
               critModifier,                                                     // +10 each
               conditions{}, incapacitated, deathState:{ kind, roundsRemaining },
               personalHeat: 0-5, surveilledContext: bool,
               perEncounterFlags{}, perSessionFlags{}, perDayFlags{ painkillers },
               perWeekFlags{}, restLimits{} }
  skills:    { <skillName>: { rank: 0-5, career: bool } }                        // 26 keys
  talents:   [ { id, tier, ranks, pyramidSlot } ]                                // §12A
  inventory: { items[ { id, qty, encumbrance, equipped, damageLevel,
                        attachments[], hardPointsUsed } ],
               tiny[], money: { amount } }
  advancementLog: [ { ts, kind, detail, xpSpent } ]
  xp:        { total, available }
  notes:     ""
```

Every rules number the schema references lives in a `data*.js` file. Every schema addition
ships with a normalisation path back-filling defaults on old characters. Every field
addition is documented here in the same change.

## 9. Settings & toggles — LOCKED pattern

`Settings.<flag>() → !!get("<flag>")`, off by default, one toggle row with a one-line
description, every related UI checks the flag, router hides gated tabs.

| Flag | Default | Effect |
|---|---|---|
| `soloMode` | off | Solo tab (Oracle, events, tables) |
| `gmScreen` | off | GM tab + reference tables |
| `digitalRoller` | off (unblocked — R-B1) | Rolls the pool from the supplied face distributions (D§). Manual symbol entry is always available and remains the default |
| `showNonSettingTalents` | off | Reveals the 12 R-11 talents |
| `gmDiscretionaryDice` | off | Exposes §5C'' outnumbered/ganging-up dice controls |
| `advancedAutomation` | off | Auto-apply environmental dice, encumbrance penalties, Heat setbacks without prompting |
| `mode` | `player` | **Seat model.** Player, GM, Solo or Everything. The bottom nav shows only that seat's five tabs; every other screen stays reachable from the header menu |

## 10. Data Extraction Ledger (T-numbered) — **all boxes unticked**

**How to continue (for any AI resuming this project):** work **top to bottom within the
current phase**. For each row: read the cited section in `source/reich62_manual.md` (`§x`) or
`source/reich62_bestiary.md` (`B§x`), write the table into the target data file
**paraphrased with a `// §x` or `// B§x` citation comment**, tick the box **in the same
change**, and append a changelog row (§12). Estimated counts yield to real
counts — record the real number. **An unticked box = data not extracted; never build UI
against an unticked table.** If a row's source turns out to be silent or contradictory, do
not guess: add it to §4 as a new ruling and mark the row blocked.

### `data.js` — core (Phase 0)
- [x] **T1** Die types, symbols, cancellation rules — §1
- [x] **T2** Pool-build algorithm + modification order — §2
- [x] **T3** Difficulty ladder (7 levels) — §3
- [x] **T4** Per-skill difficulty guidance (7 skills × 4) — §3
- [x] **T5** Opposed / competitive / assisted procedures — §3A
- [x] **T6** Characteristics (6) — §4
- [x] **T7** Skills (26) with linked characteristics + category — §4
- [x] **T8** Excluded-skill list (7) — §4
- [x] **T9** Combat sequence + initiative slot-filling — §5, §5A'
- [x] **T10** Maneuvers (9) — §5A
- [x] **T11** Actions (4 types) + combat-check procedure — §5B
- [x] **T12** Ranged difficulty by range band — §5B Table 5B-1
- [x] **T13** Combat spend table (🔺/☀️ and 🔻/⚡) — §5C
- [x] **T14** Generic non-combat spend table — §5C'
- [x] **T15** Multiple attackers/defenders guidance — §5C''
- [x] **T16** Range bands (5) + movement costs — §5D
- [x] **T17** Environmental effects (6) incl. concealment dice ladder — §5E
- [x] **T18** Encumbrance rules + lifting ladder — §5F
- [x] **T19** Recovery & healing (all 7 methods + limits + modifiers) — §5G
- [x] **T20** Two-weapon, unarmed, improvised-weapon rules — §5H
- [x] **T21** Falling table + suffocation — §5I
- [x] **T22** Silhouette table + size difficulty rule — §5J
- [x] **T23** Derived-stat formulas (12) + `BASE_WOUND_THRESHOLD` 8 / `BASE_STRAIN_THRESHOLD` 10 — §6, R-1
- [x] **T24** XP costs + gates (pyramid, creation caps) — §7
- [x] **T25** Story Point economy (spends, flow, carry-over) — §8
- [x] **T26** **Critical Injury table (22 rows, severities, modifiers)** — §9
- [x] **T27** **Item qualities (27)** with active/passive + cost — §10
- [x] **T28** Called shots & disabling attacks — §10A
- [x] **T29** Social encounter rules + group-influence difficulty ladder — §11
- [x] **T30** Social spend table — §11
- [x] **T31** Vehicle characteristics, maneuvers, actions, crashes — §12
- [x] **T32** Vehicle spend table — §12
- [x] **T33** **Talents (71)** — id, tier, ranked, activation type, mechanical hook, `settingApplicable` (R-11) — §12A
- [x] **T34** Motivation tables (4 × 10) — §12B
- [x] **T35** Creation procedure (5 steps) — §13
- [x] **T36** **Careers (11 × 8 skills + suggested motivations)** — §14
- [x] **T37** Rarity ladder + location modifiers + buy/sell procedure — §14A
- [x] **T38** Item damage/repair ladder — §14B
- [x] **T39** Hard points + attachments (3 examples) — §14C
- [x] **T40** **Gear list (17)** — §15 *(R-13)*
- [x] **T41** **Weapons (10)** with qualities — §15C
- [x] **T42** **Armour (6)** — §15D
- [x] **T43** **Vehicles (17)** — §15E
- [x] **T44** Character-sheet field reference — §16A
- [x] **T45** **Heat system**: generation triggers, Personal/Cell thresholds (5×2), decay — §17
- [x] **T46** Encounter-sizing table + adventure-sizing guidance — §20B
- [x] **T47** Session/scene/adventure lifecycle bundles — §21–§24 *(synthesised, cited)*
- [x] **T48** XP award guidance — §27
- [x] **T49** Dread/fear check ladder + outcomes — §29
- [x] **T50** Rules-library quick-reference content — §30 + §26 skill usage examples (14)
- [x] **T68** **Die face distributions** (6 dice, 56 faces) — D§ *(R-B1 retired, R-20 records the as-printed Triumph and Despair faces)*

### `data-npcs.js` (Phase 0)
- [x] **T51** Minion / Rival / Nemesis build recipes + threat guidance — §12C
- [x] **T52** Adversary talent — §12C
- [x] **T53** Adversary special abilities (7) — §12D
- [x] **T54** NPC quick-gen archetype + disposition tables + tier mapping — §20
- [x] **T54a** **14 bestiary-only NPC abilities** (Papers-Check Reflex, Beat Familiarity, Disciplined, Manifest Cross-Check, Quota Pressure, Terrain-Wise, Everywhere, Shoot on Sight, Reinforcements, Passive Watch, Environmental Affinity — Wilderness, Keen Senses, Bite, Mount) — B§2–B§5 *(R-19: `Disciplined` ≠ `Hardened`)*

### `data-monsters.js` — bestiary compendium (Phase 0)
*(numbered T61+ because it was added after the original ledger; it is a **Phase 0** file and
is worked in this position, immediately after `data-npcs.js`.)*
- [x] **T61** **Minion groups (10)** — characteristics, group skills, **per-member Wound Threshold** (R-18), equipment, unique ability; Informant Network flagged `abstract: true` — B§2
- [x] **T62** **Rivals (12)** — characteristics, Soak, Defense melee/ranged (R-17), WT, skills, abilities, equipment, `veryChallenging` flag per §12C threat guidance — B§3
- [x] **T63** **Nemeses (4)** — as rivals plus Strain Threshold, Adversary 2, narrative-use note; Hartmann Voss's Cell-Heat-4 escalation hook — B§4
- [x] **T64** **Animals (2)** — Guard Dog (R-16 minion default, promotable), Patrol Horse; attack profiles — B§5
- [x] **T65** **Encounter blocks (4)** — opposed skills, opposition pool size, Heat consequence; Dragnet's escalating 2→4 dice + per-round Heat (§3.13) — B§6
- [x] **T66** **Random encounter table (d10, 10 rows)** incl. the Cell-Heat-4 escalation row — B§7
- [x] **T67** Bestiary usage conventions: stat-block field order, minion/rival/nemesis mapping, printed-stats-are-authoritative note (R-15) — B§1

### `data-pregens.js` (Phase 1)
- [x] **T55** 3 pregens (characteristics, skills, thresholds, gear; 70 XP unspent, no talents/motivation) — §16

### `data-solo.js` (Phase 6)
- [x] **T56** Oracle likelihoods + interpretation ladder — §18
- [x] **T57** Meaning tables: Action d10, Subject d10 — §15A
- [x] **T58** Element tables: Location, Faction, Complication (d10 each) — §15B
- [x] **T59** Random Event category + subject tables — §19
- [x] **T60** Solo play loop procedure — §23

## 11. Build roadmap

### Phase 0 — Foundations — **COMPLETE**
- [x] Scaffold every §7 file; `index.html` shell, router, bottom nav, local storage
- [x] Theme §1.2 (light + dark, system default, in-app toggle); dice-symbol glyph renderer in `ui.js`
- [x] PWA: manifest, service worker (network-first, `CACHE_VERSION = reich62-v1`), icon, update toast
- [x] **Ledger T1–T50 (`data.js`) — complete and verified**
- [x] **Ledger T51–T54a (`data-npcs.js`)**
- [x] **Ledger T61–T67 (`data-monsters.js`) — the full bestiary compendium**
- [x] Rules library screen with §/B§-anchored search over all extracted data
- [x] `npm test` harness: boot smoke, zero console errors, 360/390px overflow, a11y basics, every §4 ruling pinned

### Phase 1 — Creation Wizard — **COMPLETE**
- [x] Career step (11 careers, pick 4 of 8 → rank 1)
- [x] XP step: 70 XP, live cost engine (10×N characteristics · 5×N career · 5×N+5 non-career · 5×tier talents), **creation caps enforced** (skill ≤ 2, characteristic ≤ 5, characteristics creation-only)
- [x] Talent picker with **pyramid legality** enforced live (R-11 toggle respected)
- [x] Derived-stat computation (§3.5) from the R-1 constants, with the inferred-base badge
- [x] Motivation step (roll on d10 or choose, 4 × 10)
- [x] Gear step (R-8 currency label + 500-credit default, house-aid badge) — rarity-aware acquisition checks land with the advancement loop in Phase 4
- [x] Cell creation (name, Heat 0) — §3.8 *(the Cell is created on first use with Heat 0 and the R-4 pools; a naming screen ships with the GM tab)*
- [x] Pregens (T55) → instantiate into the XP/Motivation steps, not a finished sheet
- [x] Legality validation at every step; no illegal character can be saved

### Phase 2 — Core Tracker — **COMPLETE except the portrait**
- [x] Live sheet: characteristics, 26 skills with pool preview, talents, inventory
- [x] **Persistent resource header on every in-play screen:** wounds · strain · Story Points · Personal Heat · encumbrance
- [x] Vitals steppers clamped to true maxima; incapacitation state
- [x] Conditions registry (§3.9) — disoriented, encumbrance and Heat auto-apply their dice in the roller; the remaining condition effects are wired as the systems that consume them land
- [x] Inventory: encumbrance enforced (Setback per point over; free-maneuver loss at ≥ Brawn over), equipped state
- [x] Inventory: item damage ladder, attachments and hard points (§14B, §14C)
- [x] Critical Injury list with **cumulative +10 modifier** tracked
- [x] Notes, JSON **export/import** in Settings
- [ ] Portrait (canvas-compressed) — lands with Phase 5 storage
- [x] Persistence + normalisation/migration path

### Phase 3 — Dice Engine — **COMPLETE**
- [x] Pool builder from skill+characteristic with **modification order enforced**
- [x] **Manual symbol-entry roller (primary and default, per R-B1)** + cancellation + net outcome
- [x] Digital roller behind `digitalRoller` — unblocked once `DIE_FACES` was supplied (D§); rolls the assembled pool, reports each die and face, and fills the symbol entry (R-B1)
- [x] Difficulty picker (7 levels)
- [x] Upgrade/downgrade controls in the roller UI, including spending a Story Point to upgrade (§2.4, §8)
- [x] Auto-applied dice: conditions, encumbrance, Heat thresholds
- [x] Auto-applied dice: environment, silhouette, cover/concealment (§5E, §5J), plus the Adversary talent's upgrades (§12C)
- [x] **Opposed-check builder** (§3.2 exact sequence) and competitive-check comparator (R-3)
- [x] **Four context spend tables** (combat / generic / social / vehicle) surfaced by affordability (R-12)
- [x] One-tap application of a chosen spend to the character's state (§5C)
- [x] **Story Point spends** with two-pool flow enforced (`spendStoryPoint`) — pool UI lands with the GM tab
- [x] Damage applier: base + net 🌟 − Soak → wounds; strain path; Pierce handling
- [x] **Critical Injury roller** with all modifiers (+10/injury, Vicious, Durable, falls) and effect auto-application
- [x] **Talent "tap to use"** for the mechanically-hooked talents — strain and Story Point costs deducted, once-per-X flags set
- [x] **Roll log** (local; capped at 100; `aria-live`; enough detail to re-derive)
- [x] ~~**Rules citations:** automated surfaces link into the rules library on their cited section~~ — built, then **removed** on user instruction as visual noise; section numbers stay searchable in the library and cited in the data files
- [x] `heat.js`: Despair → Personal Heat +1 (+2 on evasion checks), Triumph → optional −1, surveilled-context flag, threshold effects auto-applied, Cell Heat escalation

### 🏁 Milestone — First Session Playable — **REACHED**
- [x] Create character → live sheet → resolve checks → track wounds/strain/Story Points/Heat, end to end, verified headless with zero console errors *(Phase 5 gated on this)*

### Phase 4 — In-Play Systems — **COMPLETE**
- [x] **Guided death procedure** (§3.10): The End Is Nigh countdown, Bleeding Out per-turn ticks + threshold-overflow extra roll, suffocation escalation, Indomitable escape hatch, 151+ terminal state
- [x] Rest & recovery with **all once-per-X limits enforced** (§3.11)
- [x] **Lifecycle engine** (§3.12): End Encounter / Scene / Session / Day / Week / Adventure with confirmation summary + one-step undo
- [x] **Generic progress tracker** (§3.13) reused by Heat, repairs, ad-hoc clocks and the Dragnet
- [x] Advancement loop (§3.15) with pyramid + creation-only gates, Dedication handling, advancement log
- [x] Local combat helper: **initiative slot model (§5A')**, turn/maneuver budget with strain cost, combatant cards, minion-group wound pooling from the per-member value (R-18)
- [x] Combat helper: vehicle scale (§12) — speed, hull trauma, system strain, Damage Control, and crashes inflicting hull trauma equal to speed
- [x] NPC builder surface: the §12C recipes, all 21 special abilities, and the quick-gen tables, rollable on the GM screen
- [x] NPC builder: builds from the §12C recipes and saves into the combat tracker as `derivedFrom: "recipe"` (R-15)
- [x] **Bestiary browser** (T61–T67): filter by tier / Heat relevance / `veryChallenging`, one-tap drop-in to the combat tracker, printed stats loaded verbatim (R-15), Guard Dog promote-to-Rival control (R-16)
- [x] **Encounter blocks (B§6)** deployable as pre-built opposed checks, incl. the **Manhunt/Dragnet extended check** on the generic progress tracker (escalating 2→4 opposition dice, +1 Personal *and* Cell Heat per failed round)
- [x] Bestiary Heat hooks wired to `heat.js`: the Dragnet block, the B§7 Cell-Heat-4 escalation row, and Passive Watch as a scene-start Oracle roll
- [x] Bestiary Heat hooks: Papers-Check Reflex on the GM screen and Hartmann Voss's Cell-Heat-4 escalation surfaced in the combat tracker

### Phase 5 — Multiplayer & Sync *(gated on the milestone)*
- [ ] Firebase init, anonymous auth, optional Google linking
- [ ] `database.rules.json`: player/GM roles, Cell write rules
- [ ] Campaigns + fantasy-phrase join codes; presence
- [ ] Party overview; shared Story Point pools; shared Cell Heat
- [ ] Shared combat with two-way sync (slots, combatants, vehicles)
- [ ] Shared tasks + synced roll log; portraits (canvas-compressed ~400px)
- [ ] PWA update toast

### Phase 6 — Conditional surfaces — *solo, automation and safety complete; GM party panel awaits Phase 5*
- [x] **Solo mode** (`data-solo.js` T56–T60): Oracle, Random Event chaining, Meaning/Element tables, solo loop, Heat-4/5 raid resolution via Oracle, random encounter table (B§7), Informant Network Passive Watch as a scene-start Oracle roll (B§2)
- [x] **GM screen**: Cell panel with Heat controls, bestiary browser with drop-in, encounter blocks, the NPC recipes and abilities, encounter sizing, and the §3.21 rollable tables incl. the **random encounter table (B§7)**
- [ ] GM screen: party panel with peek sheets, handing out damage/conditions/Heat, broadcast feed *(these need the Phase 5 sync layer to be useful beyond one device)*
- [x] Advanced automation toggle — off, the automatic condition, encumbrance and Heat dice are confirmable rows; on, they apply without prompting
- [x] Safety-tools note (§20A, paraphrased, one screen, linked from Settings)

### Hardening (always)
- [x] Regression harness per §13.5 assertions — 271 checks, every ruling pinned
- [ ] Accessibility pass (labels, `aria-live` and focus are in place; a full pass is outstanding)
- [x] **Usability pass 1** — seat model, self-describing panels, sub-tabs and accordions, plain-language first, guardrails on destructive actions, persistent outcomes
- [x] **Usability pass 2 (formatting)** — compact help bars, checklist line breaks, always-labelled dice symbols, the Outcome panel with a status chip and a plain-English explanation, and a rules library grouped into readable sections
- [x] **Rules-accuracy audit, pass 1** — findings below, each closed with a regression check
- [ ] Rules-accuracy audit, pass 2 (after Phase 5)

#### Audit pass 1 — findings (Rule · Target · Fix · Why)

| # | Rule | Target | Fix | Why |
|---|---|---|---|---|
| **A-1** | An uncancelled Triumph lets the player reduce Personal Heat by 1 (§17.1) | `roller.js` | The rule was implemented in `heat.js` but no control ever set `spendTriumphOnHeat`, so the reduction was unreachable. Added the toggle to the check setup | A printed player option was inert in the UI |
| **A-2** | The Adversary talent upgrades the difficulty of every combat check against that NPC, once per rank (§12C) | `roller.js` | The roller had no notion of the target, so Adversary was never applied. Added a target Adversary rank that upgrades the difficulty in the modification order | Every published Rival has Adversary 1 and every Nemesis Adversary 2, so this affected nearly every combat check against the bestiary |
| **A-3** | §5 and §5A disagree on the turn budget | `data.js`, `combat.js` | Recorded as **R-21**: §5A's detailed rule governs — one free maneuver, a second for 2 strain, cap of two | A contradiction inside the source needed a recorded ruling rather than a silent choice |
| **A-4** | Environmental and size modifiers are properties of the situation, not the character (§5E, §5J) | `roller.js` | They were nested inside the character branch, so they vanished with no sheet loaded. Moved out of that branch | GM-side and sheetless rolls silently lost cover, concealment and silhouette |

Verified clean in this pass, so later audits need not re-litigate them: symbol cancellation and
the uncancellable Triumph and Despair (§1); pool building and the modification order (§2, §2.4);
the opposed difficulty side and the competitive tie chain (§3A, R-3); Story Point two-pool flow
(§8); Critical Injury modifier stacking, the Durable floor and results past 100 (§9, §5G, R-14);
encumbrance thresholds and penalties (§5F); the talent pyramid including ranked purchases (§7);
XP costs (§7); rarity difficulty and location modifiers (§14A); minion group thresholds and skill
ranks (§12C, R-18); Heat generation, thresholds and decay (§17); the painkiller ladder and the
once-per-X recovery limits (§5G); the Dragnet's escalation and dual Heat cost (B§6).

**Per-feature spec format (mandatory):** Rule (cited) · Target (file · module · function) ·
Behavior/UI · Schema (name · type · default · location, §8 updated) · Acceptance (browser
verification).

## 12. Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
| 2026-08-05 | **Cancellation write-up removed from the Outcome panel.** The line reading "1 success cancelled against 1 failure; 1 failure left over, so the check fails; 1 advantage cancelled against 1 threat" restated what the status chip and the surviving-symbol row already say, in more words. `explainCancellation` goes with it. The neutral "tap in the symbols above" line stays, since with nothing entered there is otherwise nothing in the panel. | User: remove the cancellation explanation | `npm test`: 336 checks pass, **zero console errors**. The check that asserted the write-up now asserts its absence | `reich62-v18` |
| 2026-08-05 | **A skill on the sheet is now the way into its check.** Every name in the sheet's skill list is a link: tapping it selects that skill in the Roll screen's dropdown and navigates there, so the pool, the difficulty side and the dice counts are already built for it on arrival. Previously the sheet could only be read, and the skill had to be found again by hand in the roller. `sheet.js` imports the roller's check state directly rather than routing the selection through storage, so nothing is persisted for a choice that only lasts until the next check. | User: click a skill on the sheet to set it in the roller and jump there | `npm test`: 336 checks pass, **zero console errors**. New checks assert the jump lands on the Roll screen, the dropdown already holds the tapped skill, the pool renders for it, and a second tap replaces the first | `reich62-v17` |
| 2026-08-05 | **Characters can be deleted.** Every card in Home's character list gains a Delete control, which confirms by name first and says plainly that the sheet, gear, injuries and experience go with it and that a backup export is the way to keep them. `store.deleteCharacter` already cleared the active pointer, so deleting the active character drops the app back to the empty sheet. **Root cause found while testing:** `.resource-header` set `display: flex` on the class, which beats the browser's own `[hidden] { display: none }`, so the resource bar rendered as an empty strip whenever no character was loaded — including on a first run, before any character existed. Fixed with an explicit `[hidden]` rule. | User: ability to delete a character | `npm test`: 332 checks pass, **zero console errors**. New checks cover the confirm step, that cancelling keeps the character, that confirming removes it, that the roster falls back to its create-one empty state, that the resource bar is genuinely hidden afterwards, and that the sheet falls back to its own empty state | `reich62-v16` |
| 2026-08-05 | **The symbol pad is now conditional on who rolled the dice.** With the simulated roller on, the app rolled the pool, so there is nothing to key in: the six ± rows are replaced by a read-only list showing only the symbols that actually came up, with their counts — a symbol at zero is not listed at all. With the roller off (the default) the ± pad stays exactly as it was, because tapping in what your physical dice showed is then the only input the app has (R-B1). The roller's intro line no longer claims hand entry is available while the app is rolling. | User: remove the manual ± adjustment and show only the non-zero symbols | `npm test`: 325 checks pass, **zero console errors**. New checks assert a rolled pool carries no ± buttons, lists no zero-count symbol, drops fewer than six rows, and empties to a "nothing rolled yet" line — and that the pad returns when the simulated roller is switched off | `reich62-v15` |
| 2026-08-05 | **Per-die face readout removed from the roller.** After a simulated roll the entry panel printed every die and its face (`Ability 1: blank · Difficulty 3: failure + failure · …`) between the roll button and the symbol pad. It restated what the symbol counters already show and pushed the pad down the screen. `state.lastDice` is dropped with it; `rollPool` still returns `dice`, so nothing else loses data. The roll toast no longer cites the face table. | User: remove the per-die readout | `npm test`: 320 checks pass, **zero console errors**. The digital-roll check now asserts the readout is absent and the symbol entry is still filled | `reich62-v14` |
| 2026-08-04 | **The dice pool moved into the entry panel and reads as live per-type counts.** "What did you roll?" now opens with a **Dice to roll** grid — Ability, Proficiency, Difficulty, Challenge, Boost, Setback, each with its count and die size, colour-keyed down the left edge and dimmed at zero — followed by the total and a "Why these dice" expander holding the reasons. The numbers recompute on every input that feeds the pool: skill, difficulty, opposed ratings, concealment, cover, size, target Adversary rank, manual upgrades and downgrades, and the automatic condition, encumbrance and suspicion dice. The separate "Your dice" panel is gone, so the pool now sits directly above the symbols it produces rather than in a card of its own. | User: the dice numbers under "What did you roll?" should update as the setup changes | `npm test`: 320 checks pass, **zero console errors**. New checks read the counts out of the grid and assert they move live — Daunting takes Difficulty 2 → 4 and back, taking cover adds a Boost and removing it takes it away, and changing skill rebuilds the positive side | `reich62-v13` |
| 2026-08-04 | **Roll log is editable and shows the result only.** Each row now reads `Skill — Success/Failure` with the surviving symbols and any suspicion change, instead of the full derivation (`Pool 1 Ability, 1 Proficiency · 2 Difficulty · entered … · net …`). Every row carries a **Delete**, and the panel carries a **Clear all** that confirms first. Entries gained an `id`, and applying a spend now attaches to the check that produced it (`appendSpendToLastEntry`) rather than filling the log with its own rows — the earlier "Medicine — spend" lines were that. The full derivation is still stored and still travels with a JSON export, so §8's "enough detail to re-derive" holds; it is simply no longer rendered. | User: delete individual entries or clear all, and show only the result | `npm test`: 315 checks pass, **zero console errors**. New checks assert a row shows a verdict but no pool or entered breakdown, that deleting one entry leaves the rest, that clearing asks first, and that the emptied log explains itself | `reich62-v12` |
| 2026-08-04 | **Internal ruling codes removed from the interface, and the Roll screen no longer opens on a failure.** The `R-B1`, `R-1 inferred`, `R-3`, `R-10`, `R-11`, `R-14` badges were project bookkeeping shown to players; they now read as plain words where the badge still earns its place (`inferred`, `house aid`, `not in this setting`) and are dropped entirely where it did not. The last section markers went with them — the opposed-check steps in `data.js`, the solo loop in `data-solo.js`, the GM screen's per-entry cite tags, and the rules library's own help text. **The Outcome panel starts neutral**: with nothing entered it reads "Waiting for your dice" with logging disabled, rather than declaring a failure before the player has touched a die — a check with no symbols is not a failed check, it is an unrolled one. | User: stray `R-B1` label, and the roll result defaulting to failure | `npm test`: 309 checks pass, **zero console errors**. A new sweep walks all ten screens with every accordion forced open and asserts the rendered text contains no section marker and no ruling code; two more pin the neutral outcome state and the disabled log button | `reich62-v11` |
| 2026-08-04 | **Section numbers removed from interface copy.** Removing the citation *links* left the numbers themselves baked into labels — "Apply condition dice (§3.9)", "Concealment (§5E)", "Behind cover (§5E)", "Spend a Triumph to reduce Personal Heat by 1 (§17.1)" and roughly 170 more across eleven modules. All are stripped; the data files keep every `// §x` comment and the rules library still finds a typed section number. While in there, the roller's number fields moved to a label-above layout with a plain-language name and a hint underneath ("How thick is it?" with the concealment ladder; "Size difference"; "How hard is the target to hit?"), because long labels were squeezing the inputs into a narrow column on a phone. | User: the Roll screen still showed section numbers | `npm test`: 299 checks pass, **zero console errors**. A new check walks Roll, Sheet, Combat and Home and asserts the rendered text contains no `§` marker at all | `reich62-v10` |
| 2026-08-04 | **Section-number links removed from the screens.** The `§x ↗` links repeated under every rules entry and beside every roller panel were noise: in the library the section grouping already says where an entry comes from, and on the Roll screen they sat between the player and the thing they were doing. `roller.js` loses its `citation()` helper and all five call sites; rules entries lose their per-entry link. Section numbers remain searchable in the library, and the data files keep every `// §x` citation comment, so provenance is unchanged where it matters. | User: "Why have this link everywhere? Remove it." | `npm test`: 295 checks pass, **zero console errors**. New checks assert no `a.cite` remains on the Roll screen or in the rules list, and that typing a section number into the search still finds its rules | `reich62-v9` |
| 2026-08-04 | **Formatting pass on the usability work.** Fixed three layout faults reported from a device: the "How this works" bar used `space-between` on a single child, so its label sat hard right behind a dead gap — it is now a compact left-aligned row, borderless until opened; checklist links ran straight into their hints (`Pick the seat you play inCurrently: Player`) because `.toggle-desc` was only ever styled inside `.toggle-row`; and a completed checklist item struck through its hint as well as its label. **Symbols are never bare** — `symbolGlyph` now always renders glyph, count and name together, so the entry pad doubles as the legend and no separate key is needed. The roll result panel is headed **Outcome** with a Success or Failure **status chip** instead of shouting "IT FAILED", and states in one line why the check landed where it did (what cancelled against what, what survived). **Rules library rewritten**: entries read as full sentences rather than machine fragments, and are grouped into thirteen collapsible sections (`rules-index.js` gains `SECTIONS` and a `section` key per entry) with the first group open. | User-reported formatting faults, with screenshots | `npm test`: 294 checks pass, **zero console errors**. New checks pin the compact help bar's height and label offset, checklist hints on their own line, the Outcome heading and chip, the cancellation explanation, and that every rendered symbol carries its name | `reich62-v8` |
| 2026-08-04 | **Usability pass.** New `src/help.js` carries the plain-language layer: a gloss per rules term and a lede plus "how this works" for every panel, with the everyday word first and the book's term second. New `ui.js` primitives — self-describing `panel`, `accordion`, `subTabs`, `emptyState`, `outcomeBox`, `numberStepper`. **Seat model** (`mode`: player / GM / solo / everything) caps the bottom nav at five tabs, with a header menu listing every screen. Sheet split into six sub-tabs, GM into five, Rules gains category filters and pagination, Roll and Combat gain accordions, and the wizard's XP step becomes three filterable sub-steps with a one-tap suggested spread for the chosen career. Home leads with a start-here checklist. Destructive actions (remove combatant, remove vehicle, close task) now confirm; lifecycle and check results persist in an outcome box instead of only flashing a toast; vitals take direct numeric entry with ±1/±5. | User-reported UX audit: menus too long, nothing explained, not idiot-proof | `npm test`: 285 checks pass, **zero console errors**. Measured at 360px: GM 13,492px → 6,500px, nav 9 slivers → 5 legible tabs. New checks cover seat switching, the checklist, panel help, the header menu, confirm-before-destroy, the persistent outcome box, wizard talent filtering and the locked-talent reason | `reich62-v7` |
| 2026-08-04 | **Remaining Phase 2/3/4/6 items closed, plus the first rules-accuracy audit.** Sheet gains the item damage ladder and attachments against hard points (§14B, §14C). Roller gains concealment, cover and silhouette dice (§5E, §5J), the Adversary upgrade (§12C), manual upgrade and downgrade controls with a Story-Point-funded upgrade (§2.4, §8), one-tap spend application (§5C), and citation links that open the rules library on the cited section. Combat gains vehicle scale (§12: speed, hull, system strain, Damage Control, crash trauma equal to speed) and recipe-built NPCs stored as `derivedFrom: "recipe"` (R-15). GM screen gains the NPC builder and Papers-Check Reflex; the combat tracker surfaces Hartmann Voss's Cell-Heat-4 escalation. `advancedAutomation` now governs whether automatic dice are confirmed or applied silently. Safety-tools note added (§20A). Audit findings A-1…A-4 fixed, new ruling **R-21** for the §5 vs §5A turn-budget contradiction. | Closing the roadmap's remaining local items before Phase 5 | `npm test`: 271 checks pass, **zero console errors** — situational dice with and without a loaded sheet, Adversary upgrades consuming Difficulty dice, Triumph-to-Heat, crash trauma equal to speed, recipe NPCs deriving, item damage and attachment hard points, citation links landing on the cited section, and the safety-tools note | `reich62-v6` |
| 2026-08-04 | **Die face distributions supplied → R-B1 retired.** `source/genesys_dice_breakdown.md` added as a third source of record, cited `D§`. `data.js` gains `DIE_FACES` (ledger T68: 56 faces across the six dice, stored exactly as printed) and `DIE_FACES_SOURCE`. `core.js` gains `rollFace`; `roller.js` gains `rollPool`, which rolls the assembled pool, fills the symbol entry and reports each die and face. `settings.js` no longer force-disables `digitalRoller`, which is now opt-in and off by default — manual symbol entry stays the default input everywhere. New ruling **R-20**: the Proficiency 12 and Challenge 12 faces are stored as Triumph and Despair alone, since no supplied source says either also counts as a Success or Failure. | The user supplied the face data R-B1 was waiting on | `npm test`: 248 checks pass, **zero console errors** — face-table shape and symbol polarity pinned per die, Triumph confined to Proficiency and Despair to Challenge, 200-die rolls of each producing no opposite-polarity symbols, every rolled face traced back to the table, and the toggle verified unblocked, off by default, and reverting cleanly to manual entry | `reich62-v5` |
| 2026-08-04 | **Phase 4 in-play systems, plus solo mode.** `combat.js` (initiative slots with fixed ownership and per-round slot filling, turn budget with the 2-strain second maneuver and the minion no-strain rule, bestiary drop-in loading printed stats verbatim, minion-group wound pooling and live resizing, Guard Dog promotion, the generic progress tracker with the Dragnet's escalating 2→4 opposition and dual Heat cost, and the six lifecycle boundaries with a delta preview and one-step undo). `sheet.js` gains the guided death procedure (Bleeding Out, The End Is Nigh countdown, suffocation escalation, Indomitable), rest and recovery with every once-per-X limit enforced, the advancement loop with Dedication, and talent tap-to-use. `gm.js` (Cell panel, bestiary browser with tier/Heat/threat filters, encounter blocks, NPC recipes and all 21 abilities, rollable §3.21 tables). `data-solo.js` T56–T60 and `solo.js` (Oracle with Random Event chaining, meaning and element tables, Passive Watch, Heat-4 raid timing). `store.js` gains combat, task and undo-snapshot persistence. | Phase 4 and the solo half of Phase 6 | `npm test`: 224 checks pass — the Phase 4 flow driven headless (bestiary drop-in, R-18 group thresholds recomputing on resize, R-16 promotion, initiative slots, a failed dragnet round advancing both Heat tracks, End Session awarding XP and decaying Heat, one-step undo restoring state, Bleeding Out ticking, the night-rest limit locking out, the Oracle chaining a Random Event and feeding Heat) at 360px and 390px, Firebase aborted, **zero console errors** | `reich62-v4` |
| 2026-08-04 | **Phases 1–3 to the First Session Playable milestone.** `wizard.js` (career → four career skills → 70 XP with the live cost engine and pyramid gate → derived → Motivation → gear → review, every step validated), `data-pregens.js` (T55, with Anna Voss's R-1 erratum stored and surfaced), `sheet.js` (live sheet, vitals steppers clamped to true maxima, conditions, Critical Injury list with the cumulative +10, inventory with enforced encumbrance, and the persistent resource header), `roller.js` (pool build in the §2.4 modification order, manual symbol entry, cancellation, opposed difficulty side, the four spend tables by affordability, damage applier, Critical Injury roller, Story Point two-pool flow, roll log capped at 100), `heat.js` (Despair → +1 or +2 on evasion, Triumph → −1, threshold effects, Cell escalation at Personal 3+, safehouse status). Router gains Sheet, Roll and Create tabs. | Phases 1–3 of the §11 roadmap | `npm test`: 181 checks pass — the full create → sheet → roll → track flow driven headless at 360px and 390px, Firebase aborted, **zero console errors**; wizard legality gates, the pyramid gate, R-1 derived values, the R-8 badge and Heat generation all asserted through the real UI | `reich62-v2` |
| 2026-08-04 | **Phase 0 built.** App shell (`index.html`, `styles.css`, `src/` core · ui · settings · rules · rules-index · derived · store · screens · router · main), theme with system default, PWA (manifest, versioned service worker, icon, update toast), local-only persistence with export/import, and the rules library with §/B§ search. **Data extraction complete for Phase 0:** `data.js` T1–T50, `data-npcs.js` T51–T54a, `data-monsters.js` T61–T67. Added `src/rules-index.js` to the module map and the service-worker shell. Corrected the Critical Injury row count from the plan-stage estimate of 22 to the real 29. | Phase 0 of the §11 roadmap | `npm test`: 150 checks pass — headless Chromium at 360px and 390px, Firebase routes aborted, **zero console errors**; every ruling R-B1 and R-1…R-19 pinned; engine invariants (cancellation, pool build, opposed difficulty side, modification order, pyramid, encumbrance, Critical Injury stacking) asserted against the data layer | `reich62-v1` |
| 2026-08-04 | **Bestiary companion added as a second source of record.** §3.18 rewritten: `data-monsters.js` is reinstated (28 stat blocks + 4 encounter templates) and the app now ships a bestiary browser alongside the NPC builder. §3.13 gains its first published extended task (the Manhunt/Dragnet escalating opposed check). New rulings R-15…R-19 (printed NPC stats authoritative; Guard Dog tier; Defense notation; minion per-member WT; Disciplined ≠ Hardened). Ledger gains T54a + T61–T67; §5 gains 8 bestiary rows; data model gains combatant provenance and the dragnet task kind; book commitment decision updated. | Second book supplied by the user | Bestiary read in full (303 lines); all 28 blocks and 14 new abilities tallied against their sections; every mechanic it reuses traced back to the manual § it cites | n/a |
| 2026-08-04 | **All 15 rulings confirmed (§4 rewritten as a closed ruling table).** Blockers B-1…B-4 retired: R-B1 makes manual symbol entry the primary dice input with the digital roller force-disabled until `DIE_FACES` exists; R-1 fixes base WT 8 / ST 10 as named constants and records Anna Voss's Wound 11 as an erratum; R-8 sets the "credits" label and a 500-credit house-aid budget; R-6/R-7 define staggered and disoriented. Product decisions marked confirmed; dependent §3/§7/§9/§10/§11 references updated; every ruling added to the §13.5 harness as a pinned assertion. | Stage B sign-off — unblocks Phase 0 | Every ruling traced to its manual § and to the file/module that implements it; substitutions carry an in-app badge so no inferred value can pass as printed | n/a |
| 2026-08-04 | Instantiated project spec from template v2: completed System Profile (§3), blockers/rulings (§4), content inventory (§5), file + module tables (§7), data model (§8), toggles (§9), 60-row Data Extraction Ledger (§10), 7-phase roadmap (§11). Source manual and template committed under `source/`. | Stage B deliverable — plan before any code | Manual read in full (1116 lines); all §3 slots populated from source only; talent count 71 verified by tier tally (24+15+16+11+5) | n/a |

## 13. Process rules — LOCKED

1. **Living spec.** This file is canonical; every code change updates it in the same change.
2. **Single source of truth.** All rules numbers live in `data*.js`. Never hardcode a rules
   value in a `src/` module.
3. **Changelog.** Every change appends a dated row (what · why · root cause for fixes ·
   verification · cache version).
4. **Verify in a real browser.** Headless Playwright, Firebase aborted, **zero console
   errors**, before marking anything complete. "Syntax is valid" is not verification.
5. **Regression harness** (`npm test`) asserts at minimum: boot/wiring smoke across every
   tab · derived-stat invariants across generated + pregen characters · dice-engine
   invariants (cancellation, modification order, opposed sequence, Story Point two-pool
   flow) · Heat generation and threshold effects · every automated talent opens a non-empty
   resolution · encumbrance math · lifecycle bundles fire completely and undo cleanly ·
   Critical Injury modifier stacking · zero horizontal overflow at 360/390px · a11y basics ·
   every closed audit finding. Every bug fix adds a check that would catch its return.
   **Ruling pins (§4):** the harness asserts each confirmed ruling so no later edit can
   drift off it — `BASE_WOUND_THRESHOLD === 8` and `BASE_STRAIN_THRESHOLD === 10` (R-1);
   Anna Voss's stored Wound Threshold is 10 with an `erratum` note (R-1); `digitalRoller`
   cannot be enabled while `DIE_FACES` is absent (R-B1); `Basic Military Training` grants
   exactly Athletics/Ranged/Resilience (R-2); the competitive comparator's tie chain is
   🌟 → 🔺 → ☀️ → simultaneous (R-3); a new campaign has `storyPointsGM === 0` (R-4); a fresh
   wizard character has all six characteristics at 1 (R-5); staggered blocks actions but not
   maneuvers and disoriented adds exactly 1 Setback (R-6/R-7); the gear step defaults to 500
   credits and renders the house-aid badge (R-8); week-rest extra Critical healing fires on
   Triumph and never on Despair (R-9); every solo/quick-gen table is a d10 with 10 entries
   (R-10); exactly 12 talents carry `settingApplicable: false` and are hidden by default out
   of 71 total (R-11); one ☀️ satisfies any spend-table row (R-12); the gear list has 17
   entries (R-13); Critical Injury lookup indexes roll + modifiers and resolves past 100
   (R-14); bestiary stat blocks load their printed values unchanged and are never passed
   through `derived.js` (R-15); the Guard Dog defaults to minion tier and is promotable
   (R-16); Defense parses as melee/ranged (R-17); a resized minion group recomputes group
   WT as per-member × count (R-18); `Disciplined` and `Hardened` remain distinct abilities
   (R-19); the compendium holds exactly 10 minion groups, 12 rivals, 4 nemeses, 2 animals,
   4 encounter blocks and a 10-row random encounter table.
6. **Cache discipline.** Any shipped-file change bumps `CACHE_VERSION`.
7. **Root-cause fixes.** No symptom-patching; record cause + fix.
8. **Scope guard.** Rules only (§1), across both supplied books. Nothing invented is presented as official; house aids
   (starting budget, currency label, adventure clocks) are explicitly labelled as such.
9. **Module discipline.** Respect §7.1 responsibilities; explicit imports/exports.
10. **Rules-accuracy audit before "done"** (template §11): spot-check every data category,
    fully check every formula and creation table, and **audit hardest on engine behaviour** —
    modification order, opposed sequence, Story Point flow, Heat triggers, once-per-X limits,
    pyramid gates, lifecycle bundles, Critical Injury modifier stacking. Findings become a
    numbered Rule/Target/Fix/Why work-list, each closed with a regression check.

## 14. Content & IP

Numbers and mechanics extracted; all effect and flavour text **paraphrased**, never copied.
No setting prose, adventure content, art, logos, or historical insignia. The app is a
**personal play aid** built from the user's own material; the README states that publishing
or distributing it makes licensing the user's responsibility.
