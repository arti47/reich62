# REICH '62 Player — Project Spec (canonical)

> Instantiated from `source/BUILD_TEMPLATE_v2.md` (RPG Player-Character App — Autonomous
> Build Instructions v2). Two sources of record, both self-contained:
> `source/reich62_manual.md` (1116 lines — core rules) and
> `source/reich62_bestiary.md` (303 lines — Bestiary & Adversary Compendium).
> **Citations use `§x` for the manual and `B§x` for the bestiary**, in this file and in every
> `data*.js` comment.
>
> This file is the project's living spec. Per §10, **every code change updates this file in
> the same change** — features, data model, file tables, roadmap checkboxes, ledger ticks,
> changelog.

**Status: Stage B signed off — all blockers and ambiguities resolved (§4, confirmed
2026-08-04). Ready for Phase 0. No application code written yet.**

---

## 1. What is being built

| | |
|---|---|
| **Game** | REICH '62 — Genesys narrative-dice system, alt-history 1962 occupied Europe |
| **Source** | `source/reich62_manual.md` (core rules + setting) · `source/reich62_bestiary.md` (adversary compendium — companion volume, same framework) |
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
| 3 | Dice input | **Manual symbol entry, primary and built first** (R-B1). The manual never prints die face distributions, so a faithful digital roller is not buildable from the source; the digital roller ships behind `digitalRoller`, blocked until face data is supplied | confirmed |
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
- **Die faces (R-B1, confirmed):** face distributions are **not printed anywhere in the
  manual**, so no simulated roller can be faithful to this source. The engine therefore
  takes **manual symbol entry** as its primary input — the player rolls physical dice and
  taps symbols; the app performs cancellation, spends, damage, Critical Injuries, Heat, and
  logging. A simulated roller exists only behind the `digitalRoller` flag and stays hard-
  blocked (flag forced off, with an in-app explanation) until face data is supplied and
  recorded in `data.js` as `DIE_FACES`.

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
1. **Critical Injury results (§9)** — 22 entries, most of which *are* conditions with exact
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
| **R-B1** | Die **face distributions** never printed (§1 lists only which symbols each die can show) | **Manual symbol entry is the primary and default dice input** — the app performs cancellation, spends, damage, Critical Injuries, Heat, and logging on entered symbols. The simulated roller stays behind `digitalRoller`, force-disabled with an in-app explanation, until `DIE_FACES` is supplied in `data.js` | yes — roller footer | `roller.js`, `settings.js`, `data.js` |
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
| **R-19** | The bestiary's minion abilities `Disciplined` (immune to Disorient) and §12D's `Hardened` (immune to Disorient **and** Stagger) overlap but differ (B§2 vs §12D) | Keep both as distinct entries; `Disciplined` is the narrower one. Neither is a rename of the other | no | `data-npcs.js` |

---

## 5. Content inventory (extraction scale)

| Category | Count | Manual § |
|---|---|---|
| Die types / symbols | 6 / 6 | §1 |
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
| **Critical Injury results** | **22 rows** (01–150+, 4 severities) | §9 |
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
| `index.html` | App shell: header, bottom nav, screen mount, module entry | planned |
| `styles.css` | Theme (§1.2) light + dark + components | planned |
| `data.js` | Core rules library — every §3 list/table/formula | planned |
| `data-npcs.js` | Adversary recipes, the 7 §12D abilities + 14 bestiary abilities, quick-gen tables, encounter sizing | planned |
| `data-monsters.js` | **Bestiary compendium** — 10 minion groups, 12 rivals, 4 nemeses, 2 animals, 4 encounter blocks, random encounter table | planned |
| `data-pregens.js` | 3 published pregens | planned |
| `data-solo.js` | Oracle, Random Event, Meaning, Element tables | planned |
| ~~`data-<expansion>.js`~~ | **Omitted — no expansion books; the bestiary is committed core content, untoggled** | n/a |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` | planned |
| `database.rules.json` | RTDB rules (player/GM roles; Cell write rules) | planned |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA | planned |
| `tests/`, `package.json` | Headless regression harness (`npm test`), dev-only `playwright-core` | planned |
| `README.md` | Setup + Firebase steps + personal-use licensing note | planned |
| `CLAUDE.md` | This file | **live** |
| `source/reich62_manual.md` | Source of record — core rules (`§x` citations) | present |
| `source/reich62_bestiary.md` | Source of record — adversary compendium (`B§x` citations) | present |
| `source/BUILD_TEMPLATE_v2.md` | The build template this spec instantiates | present |

### 7.1 `src/` module map — LOCKED

| Module | Responsibility | Reich '62 specifics |
|---|---|---|
| `core.js` | Constants, DOM/util helpers, raw dice primitives. No imports | symbol enum, cancellation primitive |
| `ui.js` | Themed modals/toasts/confirm/prompt | dice-symbol glyph renderer |
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
| `digitalRoller` | **off, force-disabled (R-B1)** | Unlocks simulated rolling once `DIE_FACES` is supplied in `data.js`; manual symbol entry is always available and always the default |
| `showNonSettingTalents` | off | Reveals the 12 R-11 talents |
| `gmDiscretionaryDice` | off | Exposes §5C'' outnumbered/ganging-up dice controls |
| `advancedAutomation` | off | Auto-apply environmental dice, encumbrance penalties, Heat setbacks without prompting |

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
- [ ] **T1** Die types, symbols, cancellation rules — §1
- [ ] **T2** Pool-build algorithm + modification order — §2
- [ ] **T3** Difficulty ladder (7 levels) — §3
- [ ] **T4** Per-skill difficulty guidance (7 skills × 4) — §3
- [ ] **T5** Opposed / competitive / assisted procedures — §3A
- [ ] **T6** Characteristics (6) — §4
- [ ] **T7** Skills (26) with linked characteristics + category — §4
- [ ] **T8** Excluded-skill list (7) — §4
- [ ] **T9** Combat sequence + initiative slot-filling — §5, §5A'
- [ ] **T10** Maneuvers (9) — §5A
- [ ] **T11** Actions (4 types) + combat-check procedure — §5B
- [ ] **T12** Ranged difficulty by range band — §5B Table 5B-1
- [ ] **T13** Combat spend table (🔺/☀️ and 🔻/⚡) — §5C
- [ ] **T14** Generic non-combat spend table — §5C'
- [ ] **T15** Multiple attackers/defenders guidance — §5C''
- [ ] **T16** Range bands (5) + movement costs — §5D
- [ ] **T17** Environmental effects (6) incl. concealment dice ladder — §5E
- [ ] **T18** Encumbrance rules + lifting ladder — §5F
- [ ] **T19** Recovery & healing (all 7 methods + limits + modifiers) — §5G
- [ ] **T20** Two-weapon, unarmed, improvised-weapon rules — §5H
- [ ] **T21** Falling table + suffocation — §5I
- [ ] **T22** Silhouette table + size difficulty rule — §5J
- [ ] **T23** Derived-stat formulas (12) + `BASE_WOUND_THRESHOLD` 8 / `BASE_STRAIN_THRESHOLD` 10 — §6, R-1
- [ ] **T24** XP costs + gates (pyramid, creation caps) — §7
- [ ] **T25** Story Point economy (spends, flow, carry-over) — §8
- [ ] **T26** **Critical Injury table (22 rows, severities, modifiers)** — §9
- [ ] **T27** **Item qualities (27)** with active/passive + cost — §10
- [ ] **T28** Called shots & disabling attacks — §10A
- [ ] **T29** Social encounter rules + group-influence difficulty ladder — §11
- [ ] **T30** Social spend table — §11
- [ ] **T31** Vehicle characteristics, maneuvers, actions, crashes — §12
- [ ] **T32** Vehicle spend table — §12
- [ ] **T33** **Talents (71)** — id, tier, ranked, activation type, mechanical hook, `settingApplicable` (R-11) — §12A
- [ ] **T34** Motivation tables (4 × 10) — §12B
- [ ] **T35** Creation procedure (5 steps) — §13
- [ ] **T36** **Careers (11 × 8 skills + suggested motivations)** — §14
- [ ] **T37** Rarity ladder + location modifiers + buy/sell procedure — §14A
- [ ] **T38** Item damage/repair ladder — §14B
- [ ] **T39** Hard points + attachments (3 examples) — §14C
- [ ] **T40** **Gear list (17)** — §15 *(R-13)*
- [ ] **T41** **Weapons (10)** with qualities — §15C
- [ ] **T42** **Armour (6)** — §15D
- [ ] **T43** **Vehicles (17)** — §15E
- [ ] **T44** Character-sheet field reference — §16A
- [ ] **T45** **Heat system**: generation triggers, Personal/Cell thresholds (5×2), decay — §17
- [ ] **T46** Encounter-sizing table + adventure-sizing guidance — §20B
- [ ] **T47** Session/scene/adventure lifecycle bundles — §21–§24 *(synthesised, cited)*
- [ ] **T48** XP award guidance — §27
- [ ] **T49** Dread/fear check ladder + outcomes — §29
- [ ] **T50** Rules-library quick-reference content — §30 + §26 skill usage examples (14)

### `data-npcs.js` (Phase 0)
- [ ] **T51** Minion / Rival / Nemesis build recipes + threat guidance — §12C
- [ ] **T52** Adversary talent — §12C
- [ ] **T53** Adversary special abilities (7) — §12D
- [ ] **T54** NPC quick-gen archetype + disposition tables + tier mapping — §20
- [ ] **T54a** **14 bestiary-only NPC abilities** (Papers-Check Reflex, Beat Familiarity, Disciplined, Manifest Cross-Check, Quota Pressure, Terrain-Wise, Everywhere, Shoot on Sight, Reinforcements, Passive Watch, Environmental Affinity — Wilderness, Keen Senses, Bite, Mount) — B§2–B§5 *(R-19: `Disciplined` ≠ `Hardened`)*

### `data-monsters.js` — bestiary compendium (Phase 0)
*(numbered T61+ because it was added after the original ledger; it is a **Phase 0** file and
is worked in this position, immediately after `data-npcs.js`.)*
- [ ] **T61** **Minion groups (10)** — characteristics, group skills, **per-member Wound Threshold** (R-18), equipment, unique ability; Informant Network flagged `abstract: true` — B§2
- [ ] **T62** **Rivals (12)** — characteristics, Soak, Defense melee/ranged (R-17), WT, skills, abilities, equipment, `veryChallenging` flag per §12C threat guidance — B§3
- [ ] **T63** **Nemeses (4)** — as rivals plus Strain Threshold, Adversary 2, narrative-use note; Hartmann Voss's Cell-Heat-4 escalation hook — B§4
- [ ] **T64** **Animals (2)** — Guard Dog (R-16 minion default, promotable), Patrol Horse; attack profiles — B§5
- [ ] **T65** **Encounter blocks (4)** — opposed skills, opposition pool size, Heat consequence; Dragnet's escalating 2→4 dice + per-round Heat (§3.13) — B§6
- [ ] **T66** **Random encounter table (d10, 10 rows)** incl. the Cell-Heat-4 escalation row — B§7
- [ ] **T67** Bestiary usage conventions: stat-block field order, minion/rival/nemesis mapping, printed-stats-are-authoritative note (R-15) — B§1

### `data-pregens.js` (Phase 1)
- [ ] **T55** 3 pregens (characteristics, skills, thresholds, gear; 70 XP unspent, no talents/motivation) — §16

### `data-solo.js` (Phase 6)
- [ ] **T56** Oracle likelihoods + interpretation ladder — §18
- [ ] **T57** Meaning tables: Action d10, Subject d10 — §15A
- [ ] **T58** Element tables: Location, Faction, Complication (d10 each) — §15B
- [ ] **T59** Random Event category + subject tables — §19
- [ ] **T60** Solo play loop procedure — §23

## 11. Build roadmap

### Phase 0 — Foundations
- [ ] Scaffold every §7 file; `index.html` shell, router, bottom nav, local storage
- [ ] Theme §1.2 (light + dark, system default, in-app toggle); dice-symbol SVG set
- [ ] PWA: manifest, service worker (network-first, versioned `CACHE_VERSION`), icon, update toast
- [ ] **Ledger T1–T50 (`data.js`) — complete and verified**
- [ ] **Ledger T51–T54a (`data-npcs.js`)**
- [ ] **Ledger T61–T67 (`data-monsters.js`) — the full bestiary compendium**
- [ ] Rules library screen with §/B§-anchored search over all extracted data
- [ ] `npm test` harness scaffold: boot smoke, zero console errors, 360px overflow check

### Phase 1 — Creation Wizard
- [ ] Career step (11 careers, pick 4 of 8 → rank 1)
- [ ] XP step: 70 XP, live cost engine (10×N characteristics · 5×N career · 5×N+5 non-career · 5×tier talents), **creation caps enforced** (skill ≤ 2, characteristic ≤ 5, characteristics creation-only)
- [ ] Talent picker with **pyramid legality** enforced live (R-11 toggle respected)
- [ ] Derived-stat computation (§3.5) from the R-1 constants, with the inferred-base badge
- [ ] Motivation step (roll or choose, 4 × 10)
- [ ] Gear step (rarity-aware; R-8 currency label + 500-credit default, house-aid badge)
- [ ] Cell creation (name, Heat 0) — §3.8
- [ ] Pregens (T55) → instantiate into the XP/Motivation steps, not a finished sheet
- [ ] Legality validation at every step; no illegal character can be saved

### Phase 2 — Core Tracker
- [ ] Live sheet: characteristics, 26 skills with pool preview, talents, inventory
- [ ] **Persistent resource header on every in-play screen:** wounds · strain · Story Points · Personal Heat · encumbrance
- [ ] Vitals steppers clamped to true maxima; incapacitation state
- [ ] Conditions registry (§3.9) — every condition auto-applies its dice/effect
- [ ] Inventory: encumbrance enforced (Setback per point over; free-maneuver loss at ≥ Brawn over), equipped state, item damage ladder, attachments/hard points
- [ ] Critical Injury list with **cumulative +10 modifier** tracked
- [ ] Portrait, notes, JSON **export/import** in Settings
- [ ] Persistence + normalisation/migration path

### Phase 3 — Dice Engine
- [ ] Pool builder from skill+characteristic with **modification order enforced**
- [ ] **Manual symbol-entry roller (primary and default, per R-B1)** + cancellation + net outcome
- [ ] Digital roller behind `digitalRoller`, force-disabled until `DIE_FACES` exists (R-B1)
- [ ] Difficulty picker (7 levels) + upgrade/downgrade controls
- [ ] Auto-applied dice: conditions, encumbrance, Heat thresholds, environment, silhouette, cover/concealment
- [ ] **Opposed-check builder** (§3.2 exact sequence) and competitive-check comparator (R-3)
- [ ] **Four context spend tables** (combat / generic / social / vehicle) with one-tap application
- [ ] **Story Point spends** with two-pool flow enforced
- [ ] Damage applier: base + net 🌟 − Soak → wounds; strain path; Pierce/Breach/Stun handling
- [ ] **Critical Injury roller** with all modifiers (+10/injury, Vicious, Durable, falls) and effect auto-application
- [ ] **Talent "tap to use"** for all ~40 mechanically-hooked talents (strain/SP costs deducted, dice applied, once-per-X flags set)
- [ ] **Roll log** (local always; capped ~100; `aria-live`; enough detail to re-derive)
- [ ] **Rules citations:** every automated surface links to its rules-library entry
- [ ] `heat.js`: Despair → Personal Heat +1 (+2 on evasion checks), Triumph → optional −1, surveilled-context flag, threshold effects auto-applied, Cell Heat escalation

### 🏁 Milestone — First Session Playable
- [ ] Create character → live sheet → resolve checks → track wounds/strain/Story Points/Heat, end to end, verified headless with zero console errors *(Phase 5 gated on this)*

### Phase 4 — In-Play Systems
- [ ] **Guided death procedure** (§3.10): The End Is Nigh countdown, Bleeding Out per-turn ticks + threshold-overflow extra roll, suffocation escalation, Indomitable escape hatch, 151+ terminal state
- [ ] Rest & recovery with **all once-per-X limits enforced** (§3.11)
- [ ] **Lifecycle engine** (§3.12): End Encounter / Scene / Session / Day / Week / Adventure with confirmation summary + one-step undo
- [ ] **Generic progress tracker** (§3.13) reused by Heat, repairs, ad-hoc clocks
- [ ] Advancement loop (§3.15) with pyramid + creation-only gates, advancement log
- [ ] Local combat helper: **initiative slot model (§5A')**, turn/maneuver budget with strain cost, combatant cards, minion-group wound pooling from the per-member value (R-18), vehicle scale
- [ ] NPC builder from the §12C recipes + 7 special abilities + quick-gen tables
- [ ] **Bestiary browser** (T61–T67): filter by tier / Heat relevance / `veryChallenging`, one-tap drop-in to the combat tracker, printed stats loaded verbatim (R-15), Guard Dog promote-to-Rival control (R-16)
- [ ] **Encounter blocks (B§6)** deployable as pre-built opposed checks, incl. the **Manhunt/Dragnet extended check** on the generic progress tracker (escalating 2→4 opposition dice, +1 Personal *and* Cell Heat per failed round)
- [ ] Bestiary Heat hooks wired to `heat.js`: Papers-Check Reflex, Passive Watch, Checkpoint/Dragnet blocks, Hartmann Voss Cell-Heat-4 escalation

### Phase 5 — Multiplayer & Sync *(gated on the milestone)*
- [ ] Firebase init, anonymous auth, optional Google linking
- [ ] `database.rules.json`: player/GM roles, Cell write rules
- [ ] Campaigns + fantasy-phrase join codes; presence
- [ ] Party overview; shared Story Point pools; shared Cell Heat
- [ ] Shared combat with two-way sync (slots, combatants, vehicles)
- [ ] Shared tasks + synced roll log; portraits (canvas-compressed ~400px)
- [ ] PWA update toast

### Phase 6 — Conditional surfaces
- [ ] **Solo mode** (`data-solo.js` T56–T60): Oracle, Random Event chaining, Meaning/Element tables, solo loop, Heat-4/5 raid resolution via Oracle, random encounter table (B§7), Informant Network Passive Watch as a scene-start Oracle roll (B§2)
- [ ] **GM screen**: party panel, peek sheets, drop-in combatants from the bestiary, hand out damage/conditions/Heat, all §3.21 rollable reference tables incl. the **random encounter table (B§7)**, broadcast feed
- [ ] Advanced automation toggle
- [ ] Safety-tools note (§20A, paraphrased, one screen)

### Hardening (always)
- [ ] Regression harness per §13.5 assertions
- [ ] Accessibility pass
- [ ] **Rules-accuracy audit (§13.6)** with every finding closed

**Per-feature spec format (mandatory):** Rule (cited) · Target (file · module · function) ·
Behavior/UI · Schema (name · type · default · location, §8 updated) · Acceptance (browser
verification).

## 12. Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
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
