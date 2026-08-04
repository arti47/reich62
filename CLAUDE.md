# REICH '62 Player — Project Spec (canonical)

> Instantiated from `source/BUILD_TEMPLATE_v2.md` (RPG Player-Character App — Autonomous
> Build Instructions v2). Source of record for all rules data:
> `source/reich62_manual.md` (1116 lines, self-contained Genesys-derivative manual).
> **Citations in this file and in all `data*.js` comments use the manual's § numbers.**
>
> This file is the project's living spec. Per §10, **every code change updates this file in
> the same change** — features, data model, file tables, roadmap checkboxes, ledger ticks,
> changelog.

**Status: Stage B deliverable produced (plan only). No application code written yet.**

---

## 1. What is being built

| | |
|---|---|
| **Game** | REICH '62 — Genesys narrative-dice system, alt-history 1962 occupied Europe |
| **Source** | `source/reich62_manual.md` — single supplied book, core rules + setting |
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

Recorded per template §4.2. Defaults applied where the user has not yet specified;
**PENDING** items may be changed before Phase 0 without rework.

| # | Decision | Value | State |
|---|---|---|---|
| 1 | Usage mode | Local-first, sync later (Phase 5 gated on First Session Playable) | default |
| 2 | User's seat | Rotates — solo + GM + player all supported; solo loop is first-class because the manual publishes official solo rules (§18–§20, §23) | default |
| 3 | Dice input | **Digital + manual symbol entry.** Manual entry is *mandatory and built first* — see BLOCKER B-1: the manual never prints die face distributions, so a faithful digital roller cannot be built from the source alone | forced by B-1 |
| 4 | Expansion commitment | None — one book supplied. No `data-<expansion>.js`, no expansion toggles | fixed |
| 5 | Table device | Mixed; phone-first baseline, 360px zero-overflow requirement holds | default |
| 6 | Theme default | Follow system (`prefers-color-scheme`), in-app override | default |

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

Single-source, fully readable Markdown. Read cover-to-cover; every §3 slot below is
populated from it. **No value in this file comes from training-data memory of Genesys.**
Where the manual is silent, the slot says so and the gap is logged in §4.

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
- **BLOCKER B-1:** die **face distributions are not printed anywhere in the manual.** A
  native digital roller is not buildable from the source. See §4.

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
  total uncancelled 🌟. Ties: **not specified** → ruling R-3.
- **Assisted checks (§3A/§5A):** the Assist maneuver grants an engaged ally 1 Boost on
  their next check; multiple assistants stack; unused dice expire after that next turn.
- **Initiative ties (§5):** broken by 🔺, then PC before NPC.

### 3.3 Meta-currencies & shared pools — *Story Points (two-pool), plus strain as a spendable*

**Story Points (§8):**
- Two visible pools: **Player pool** and **GM pool**. Starting Player pool = 1 per PC
  (some tables 2 — configurable, default 1). GM pool starting size not stated → ruling R-4.
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
Starting characteristic floor is not stated → ruling R-5 (assume all start at 1 before XP,
matching the sequential-purchase cost model).

### 3.5 Derived stats — *formulas exact; two base values missing*

| Stat | Formula | Note |
|---|---|---|
| Wound Threshold | archetype base + Brawn | **fixed at creation**; raised later only by `Toughened` (+2/rank) |
| Strain Threshold | archetype base + Willpower | fixed at creation; raised by `Grit` (+1/rank) |
| Soak | Brawn + armour soak | **recalculates live** with Brawn, unlike thresholds |
| Melee Defense | 0 base; armour + cover + talents (`Defensive` +1/rank) | |
| Ranged Defense | 0 base; armour + cover (+1, more for prepared positions) + talents | |
| Encumbrance Threshold | 5 + Brawn | §5F |
| Incapacitated | wounds ≥ WT **or** strain ≥ ST | §6 |
| Hard points (items) | ceil(base encumbrance ÷ 2) | §14C, computed from *base* encum |
| Weapon damage | weapon base + 1 per uncancelled 🌟 | §5B |
| Unarmed damage | = Brawn; Crit 5, Engaged, Knockdown | §5H |
| Vehicle hull/system strain | per vehicle table, not derived | §12 |

**BLOCKER B-2:** the human **archetype base** for Wound and Strain Threshold is never
printed. Pregens (§16) imply base WT 8 and base ST 10 for two of three, and WT 9 for Anna
Voss — internally inconsistent. Proposed ruling R-1.

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
- **Ambiguity R-2:** talent `Basic Military Training` grants "Ranged (Heavy)", a split that
  does not exist in this manual's skill list.

### 3.7 Creation options — *career → 4 skills → 70 XP → derived → motivation → gear*

Rule-legal order (§13):
1. **Career** (11, §14) — each lists 8 career skills; player picks **4** and gains rank 1 in
   each before spending XP. All 8 remain career-priced for XP.
2. **70 XP** spent per §7 costs. **Skill ranks capped at 2 during creation** regardless of
   source. Characteristic raises are creation-only.
3. **Derived attributes** computed after XP spend.
4. **Motivation** — one each of Desire / Fear / Strength / Flaw (§12B, 10 entries each,
   rolled d100/d10 or chosen).
5. **Gear** — "standard starting budget or select from §15". **BLOCKER B-3:** the budget
   figure and the currency name are never stated.

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

**BLOCKER B-4:** "staggered" and "disoriented" are used but **never defined** in the manual.
Proposed rulings R-6/R-7.
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

### 3.13 Extended / progress tasks — *near-empty slot; recorded as a finding*

The manual defines **no extended-test or progress-clock subsystem**. Multi-roll structures
that exist and reuse one generic tracker component:
- **Heat tracks** (Personal 0–5, Cell 0–5) — the primary progress mechanic.
- **Item damage ladder** (undamaged → minor → moderate → major → destroyed, §10 Sunder /
  §14B) with per-level repair difficulty, time, and cost.
- **Ad-hoc adventure clocks** (the sample adventure uses "3 in-game days"; §20B pacing) —
  provided as a **labelled house aid**, not presented as an official rule.
- **Repair jobs** (§14B): 1–2 hours per difficulty level, halved time = +1 difficulty,
  no tools = +1, cumulative.

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
- **Wealth:** concrete integer prices (§15, §15C–E). **Currency is unnamed** → ruling R-8.
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

### 3.18 Bestiary & NPCs — *no stat blocks published; recipes only*

**Finding: the manual contains zero monster/NPC stat blocks.** `data-monsters.js` is
therefore **omitted by design** (recorded here per template §6). What exists:
- **Adversary tiers (§12C):** Minion (no strain track, group-shared WT, group skill ranks =
  members−1, any Critical kills one), Rival (no strain track, Criticals normal, may die at
  WT), Nemesis (full PC-equivalent, has a strain track).
- **Adversary talent** (ranked, passive): upgrade difficulty of all combat checks targeting
  them once per rank.
- **7 Reich '62 adversary special abilities (§12D).**
- **NPC quick-gen (§20):** archetype table (5 bands), disposition table (4 bands), tier
  mapping, motivation assignment.
- **Encounter sizing table (§20B)** for a 4-PC party (6 rows).
- **Threat guidance:** 2–3 minions ≈ one starting PC; 3–4 ≈ a 100-XP PC; 1 rival ≈ one PC;
  soak 5+ / WT 14+ / 3+ skill ranks / 9+ damage pushes a rival to "very challenging".

`data-npcs.js` therefore holds **build recipes + the special-ability catalog + quick-gen
tables**, and the app ships an **NPC builder**, not a bestiary browser.

### 3.19 Pre-generated characters — **PRESENT (3, partial)**

Anna Voss (Resistance Runner) · Klaus Reiniger (SD Agent, defecting) · Elise Bauer
(Black-Market Fixer). Each has 6 characteristics, 4 skill ranks, WT/ST/Soak, and gear.
**Each has 70 XP explicitly unspent** and **no Motivation and no talents assigned** — so
one-tap instantiation must drop the player into the wizard's XP-spend and Motivation steps,
not a finished sheet. They run on **PC rules**. Note their thresholds feed BLOCKER B-2.

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
silhouette (§5J) · GM one-page quick reference (§30).

---

## 4. Blockers, ambiguities & proposed rulings

**Blockers** stop a feature from being built faithfully. **Rulings** are proposals the user
confirms or corrects; confirmed rulings are recorded here and cited in code comments.

| ID | Type | Issue (manual §) | Proposed resolution | Impact if unresolved |
|---|---|---|---|---|
| **B-1** | **Blocker** | Die **face distributions** never printed (§1 lists symbols per die type only) | Ship **manual symbol entry as the primary input** (user rolls physical dice, taps symbols; app does all cancellation, spends, damage, Heat, logging). Add a digital roller **only** once the user supplies face data; keep it behind a settings toggle | Native digital roller cannot be built. **Everything else in the app still works.** |
| **B-2** | **Blocker** | Human **archetype base** WT/ST absent (§6); pregens imply WT 8/9 and ST 10 inconsistently (§16) | **R-1:** base **WT 8, ST 10**; treat Anna Voss's printed WT 11 as an erratum (recompute to 10). Store bases as single named constants in `data.js` so one edit corrects the whole app | Wizard cannot compute thresholds |
| **B-3** | **Blocker** | Starting **gear budget** and **currency name** absent (§13.5, prices are bare integers) | **R-8:** label the unit "credits" generically in UI, configurable; expose starting budget as a settings field with a **house-aid default of 500** (explicitly labelled a house aid, not a rule) | Wizard gear step cannot validate |
| **B-4** | **Blocker** | "**Staggered**" and "**disoriented**" used (§9, §10, §12A) but never defined | **R-6:** staggered = cannot perform actions. **R-7:** disoriented = adds Setback to all checks. Both flagged in-app as inferred definitions pending confirmation | 6 Critical Injury results and 4 item qualities have no mechanical effect |
| R-2 | Ambiguity | `Basic Military Training` grants "Ranged (Heavy)" (§12A T2); this manual has one undivided `Ranged` skill (§4) | Grant **Athletics, Ranged, Resilience** as career skills | — |
| R-3 | Ambiguity | Competitive-check **ties** unspecified (§3A) | Tie broken by uncancelled 🔺, then by ☀️, then simultaneous | — |
| R-4 | Ambiguity | **GM Story Point pool** starting size unstated (§8) | GM pool starts at **0**; points arrive only by player spends (players start at 1/PC) | — |
| R-5 | Ambiguity | Characteristic **starting floor** before XP unstated (§13) | All six start at **1**; the 10×N sequential cost then reproduces standard totals | — |
| R-9 | Ambiguity | Week-rest Critical healing says "**on ⚡** an additional Critical Injury heals" (§5G) — a Despair granting a benefit contradicts §1 | Read as **☀️ (Triumph)**; implement as Triumph, flagged in-app | — |
| R-10 | Ambiguity | Oracle/event/quick-gen tables say "roll 1🎲" and §15A says "Ability die read 1–10", but §1 defines the Ability die as **d8** (§15A, §19, §20) | Use a **d10** for all oracle/meaning/element/event/NPC tables | — |
| R-11 | Ambiguity | 12 talents reference content absent from this setting (Computers hacking pages, bows, starfighters, cybernetics, animal companions, cross-book page refs) | Keep all 71 (completeness), tag `settingApplicable: false` on the 12, hide behind a "show non-setting talents" toggle, default **off** | — |
| R-12 | Ambiguity | §5C lists "🔺🔺 **or** ☀️" style rows — whether one ☀️ substitutes for 2/3 🔺 or is an independent option | Treat ☀️ as able to purchase any listed effect at any listed cost tier (the plain reading), and 🔺 costs as literal | — |
| R-13 | Ambiguity | TOC advertises "**18 items**" in §15; the section lists **17** | Ship 17, note the discrepancy in the ledger | — |
| R-14 | Ambiguity | Critical Injury table rolls to **150+** but a d100 with modifiers is the stated roll (§9) | Correct as written — modifiers (+10/injury, Vicious, falls) carry rolls past 100; the app sums roll + modifiers | — |

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
| **Monster stat blocks** | **0 — none published (§3.18 finding)** | — |

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
| `data-npcs.js` | Adversary recipes, 7 special abilities, quick-gen tables, encounter sizing | planned |
| `data-pregens.js` | 3 published pregens | planned |
| `data-solo.js` | Oracle, Random Event, Meaning, Element tables | planned |
| ~~`data-monsters.js`~~ | **Omitted — the manual publishes no stat blocks (§3.18)** | n/a |
| ~~`data-<expansion>.js`~~ | **Omitted — single book supplied** | n/a |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` | planned |
| `database.rules.json` | RTDB rules (player/GM roles; Cell write rules) | planned |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA | planned |
| `tests/`, `package.json` | Headless regression harness (`npm test`), dev-only `playwright-core` | planned |
| `README.md` | Setup + Firebase steps + personal-use licensing note | planned |
| `CLAUDE.md` | This file | **live** |
| `source/reich62_manual.md` | Source of record | present |
| `source/BUILD_TEMPLATE_v2.md` | The build template this spec instantiates | present |

### 7.1 `src/` module map — LOCKED

| Module | Responsibility | Reich '62 specifics |
|---|---|---|
| `core.js` | Constants, DOM/util helpers, raw dice primitives. No imports | symbol enum, cancellation primitive |
| `ui.js` | Themed modals/toasts/confirm/prompt | dice-symbol glyph renderer |
| `rules.js` | Pure lookups over data files | talent lookup, pyramid legality, rarity resolution, difficulty ladder |
| `derived.js` | Derived calculations + data normalisation/migration | WT/ST/Soak/Defense/encumbrance, cumulative Critical-Injury modifier |
| `settings.js` | Feature toggles | solo · GM screen · digital roller (B-1 gated) · non-setting talents (R-11) · GM discretionary dice (§5C'') |
| `store.js` | Local/cloud persistence, Cell entity, combat mirroring, JSON export/import | Cell + Heat persistence |
| `sync.js` | Firebase auth, campaigns, join codes, presence, theme | Phase 5 |
| `wizard.js` | Creation wizard + pregens | career → 4 skills → 70 XP → derived → Motivation → gear |
| `roller.js` | **Dice engine**: pool build, modification order, symbol entry, cancellation, opposed sequence (§3.2), Story Point spends, spend-table application, damage applier, Critical Injury roller, **roll-log writes** | four context-specific spend tables |
| `sheet.js` | Character sheet, in-play tracking, **persistent resource header** | header = wounds · strain · Story Points · **Personal Heat** · encumbrance |
| `combat.js` | Combat tracker: **initiative slots (§5A')**, turn/maneuver budget with strain cost, combatant cards, generic progress tracker (§3.13), lifecycle events (§3.12) | slot-filling model, vehicle scale |
| `heat.js` | **New module (game-specific):** Heat generation (§17.1), Personal/Cell thresholds and their auto-applied effects, decay, surveilled-context flag | — |
| `solo.js` | Oracle, Random Event, Meaning/Element tables, solo loop | enabled (official rules) |
| `gm.js` | GM dashboard + rollable §3.21 reference tables | — |
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
                                 minionCount, actedThisRound, conditions{},
                                 maneuversUsed, actionUsed, criticalInjuries[] } },
             vehicles: { id: { speed, handling, hullTrauma, systemStrain, ... } } }
  tasks/{taskId}: { name, kind: "heat"|"repair"|"clock", progress, target, contributors[] }
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
| `digitalRoller` | **off (B-1)** | Enables simulated rolling once face data is supplied; manual symbol entry always available |
| `showNonSettingTalents` | off | Reveals the 12 R-11 talents |
| `gmDiscretionaryDice` | off | Exposes §5C'' outnumbered/ganging-up dice controls |
| `advancedAutomation` | off | Auto-apply environmental dice, encumbrance penalties, Heat setbacks without prompting |

## 10. Data Extraction Ledger (T-numbered) — **all boxes unticked**

**How to continue (for any AI resuming this project):** work **top to bottom within the
current phase**. For each row: read the cited manual § in `source/reich62_manual.md`, write
the table into the target data file **paraphrased with a `// §x` citation comment**, tick the
box **in the same change**, and append a changelog row (§12). Estimated counts yield to real
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
- [ ] **T23** Derived-stat formulas (12) — §6 *(depends on ruling R-1 / blocker B-2)*
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
- [ ] **Ledger T51–T54 (`data-npcs.js`)**
- [ ] Rules library screen with §-anchored search over all extracted data
- [ ] `npm test` harness scaffold: boot smoke, zero console errors, 360px overflow check

### Phase 1 — Creation Wizard
- [ ] Career step (11 careers, pick 4 of 8 → rank 1)
- [ ] XP step: 70 XP, live cost engine (10×N characteristics · 5×N career · 5×N+5 non-career · 5×tier talents), **creation caps enforced** (skill ≤ 2, characteristic ≤ 5, characteristics creation-only)
- [ ] Talent picker with **pyramid legality** enforced live (R-11 toggle respected)
- [ ] Derived-stat computation (§3.5) — gated on B-2/R-1
- [ ] Motivation step (roll or choose, 4 × 10)
- [ ] Gear step (rarity-aware, budget per B-3/R-8)
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
- [ ] **Manual symbol-entry roller (primary, per B-1)** + cancellation + net outcome
- [ ] Digital roller behind `digitalRoller` flag, blocked until face data supplied
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
- [ ] Local combat helper: **initiative slot model (§5A')**, turn/maneuver budget with strain cost, combatant cards, minion-group wound pooling, vehicle scale
- [ ] NPC builder from the §12C recipes + 7 special abilities + quick-gen tables

### Phase 5 — Multiplayer & Sync *(gated on the milestone)*
- [ ] Firebase init, anonymous auth, optional Google linking
- [ ] `database.rules.json`: player/GM roles, Cell write rules
- [ ] Campaigns + fantasy-phrase join codes; presence
- [ ] Party overview; shared Story Point pools; shared Cell Heat
- [ ] Shared combat with two-way sync (slots, combatants, vehicles)
- [ ] Shared tasks + synced roll log; portraits (canvas-compressed ~400px)
- [ ] PWA update toast

### Phase 6 — Conditional surfaces
- [ ] **Solo mode** (`data-solo.js` T56–T60): Oracle, Random Event chaining, Meaning/Element tables, solo loop, Heat-4/5 raid resolution via Oracle
- [ ] **GM screen**: party panel, peek sheets, drop-in combatants, hand out damage/conditions/Heat, all §3.21 rollable reference tables, broadcast feed
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
6. **Cache discipline.** Any shipped-file change bumps `CACHE_VERSION`.
7. **Root-cause fixes.** No symptom-patching; record cause + fix.
8. **Scope guard.** Rules only (§1). Nothing invented is presented as official; house aids
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
