# REICH '62 Player 

An installable PWA player-character companion for **REICH '62**, a Genesys narrative-dice
system: character creation wizard, in-play tracker, dice engine, Heat system, solo oracle,
bestiary, and an opt-in GM screen.

**Status: everything except multiplayer is built, and the interface has had a usability pass.** Character creation, the live sheet, the
symbol-entry dice engine, Heat, the combat tracker with initiative slots, the guided death
procedure, enforced rest limits, the lifecycle engine with one-step undo, the progress
tracker, advancement, the bestiary browser and the solo Oracle loop all work — verified
headless (569 checks, zero console errors), alongside vehicle scale, the item damage ladder,
situational dice, the GM screen, solo mode and the simulated roller. Pick your seat — player,
GM or solo — and the app shows only the screens that seat needs. Four audits and an automated accessibility
sweep have been through it: two on rules accuracy and two on the whole app and its gameplay
flows. Multiplayer sync and the rest of the GM screen
are still to come; see the roadmap in `CLAUDE.md` §11.

## Running it

No build step. Serve the folder and open it:

```
npm install          # dev-only: playwright-core for the test harness
npm run serve        # http://127.0.0.1:8080
npm test             # headless regression harness
```

Opening `index.html` over `file://` will not work — ES modules need a real origin. Everything
is stored in `localStorage`; there is nothing to configure.

### Firebase (Phase 5, optional)

Multiplayer is architected but not yet built. When it lands: create a Firebase project, enable
Realtime Database and Storage, turn on anonymous auth, paste the config into
`firebase-config.js` and set `FIREBASE_ENABLED = true`, then deploy `database.rules.json`.
Never commit real keys.

| File | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The canonical project spec — completed System Profile, the 20 confirmed rulings, content inventory, data model, 68-row Data Extraction Ledger, and the 7-phase build roadmap |
| `source/reich62_manual.md` | The core rulebook — source of record for every rules value (cited `§x`) |
| `source/reich62_bestiary.md` | The Bestiary & Adversary Compendium — 28 stat blocks, 4 encounter templates, 14 NPC abilities (cited `B§x`) |
| `source/genesys_dice_breakdown.md` | The die face distributions the manual omits — 56 faces across the six dice (cited `D§`) |
| `source/reich62_errata.md` | The table owner's binding errata, confirming all 22 rulings |
| `source/BUILD_TEMPLATE_v2.md` | The build template `CLAUDE.md` instantiates |

## Where the books are silent

The sources leave 22 gaps between them. All are resolved — the confirmed rulings are in `CLAUDE.md` §4,
each one cited in code, pinned by a regression assertion, and (where it substitutes for a
printed rule) badged in the app so an inferred value never passes as printed. The four that
change how the app behaves:

- **R-B1** *(resolved)* — the manual never prints die face distributions, so **manual symbol
  entry is the primary dice input** and always works. The distributions were supplied
  separately (D§), so the simulated roller is now unblocked and opt-in in Settings.
- **R-1** — the human base Wound/Strain Threshold is not printed. Base **WT 8 / ST 10**;
  Anna Voss's printed Wound 11 is recorded as an erratum and corrected to 10.
- **R-8** — no gear budget or currency name. Unit labelled **Reichsmark (RM)**, starting budget
  **500**, both relabellable and both badged as house aids. Unspent budget is kept as cash, plus a
  d100 of pocket money that can never buy more starting gear.
- **R-6 / R-7** — "staggered" and "disoriented" are used but never defined. **Staggered =
  no actions** (maneuvers and incidentals still allowed); **disoriented = +1 Setback die on
  all checks.**

The remaining eighteen (R-2 … R-21) settle smaller conflicts: a talent naming a skill split
this manual doesn't have, competitive-check ties, the GM Story Point starting pool, the
characteristic floor, a Despair that should read Triumph, the d8-vs-d10 oracle die, twelve
talents referencing content absent from this setting, Triumph's cost in the spend tables, a
table-of-contents miscount, Critical Injury rolls that exceed 100, and five bestiary
conventions (printed NPC stats are authoritative and never recomputed, the Guard Dog's tier,
the melee/ranged Defense notation, per-member minion Wound Thresholds, and two
similar-but-distinct NPC abilities).

## Licensing

This is a **personal play aid** built from the owner's own material. Rules mechanics and
numbers are extracted; all effect text is paraphrased, and no setting prose, art, or logo
content is included. If you publish or distribute this app, licensing is your
responsibility — openly licensed material (an SRD, ORC/CC content) is the safe basis for
anything public.
