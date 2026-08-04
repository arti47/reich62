# REICH '62 Player

An installable PWA player-character companion for **REICH '62**, a Genesys narrative-dice
system: character creation wizard, in-play tracker, dice engine, Heat system, solo oracle,
and an opt-in GM screen.

**Status: planning complete and signed off — all rulings confirmed. No application code yet.**

| File | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The canonical project spec — completed System Profile, the 15 confirmed rulings, content inventory, data model, 60-row Data Extraction Ledger, and the 7-phase build roadmap |
| `source/reich62_manual.md` | The rulebook — sole source of record for every rules value |
| `source/BUILD_TEMPLATE_v2.md` | The build template `CLAUDE.md` instantiates |

## Where the manual is silent

The manual leaves 15 gaps. All are resolved — the confirmed rulings are in `CLAUDE.md` §4,
each one cited in code, pinned by a regression assertion, and (where it substitutes for a
printed rule) badged in the app so an inferred value never passes as printed. The four that
change how the app behaves:

- **R-B1** — die face distributions are not printed, so no simulated roller can be faithful
  to this source. **Manual symbol entry is the primary dice input**; the app does all
  cancellation, spends, damage, Critical Injuries, Heat, and logging. The digital roller is
  force-disabled until face data is supplied.
- **R-1** — the human base Wound/Strain Threshold is not printed. Base **WT 8 / ST 10**;
  Anna Voss's printed Wound 11 is recorded as an erratum and corrected to 10.
- **R-8** — no gear budget or currency name. Unit labelled **"credits"**, starting budget
  **500**, both relabellable and both badged as house aids.
- **R-6 / R-7** — "staggered" and "disoriented" are used but never defined. **Staggered =
  no actions** (maneuvers and incidentals still allowed); **disoriented = +1 Setback die on
  all checks.**

The remaining eleven (R-2 … R-14) settle smaller conflicts: a talent naming a skill split
this manual doesn't have, competitive-check ties, the GM Story Point starting pool, the
characteristic floor, a Despair that should read Triumph, the d8-vs-d10 oracle die, twelve
talents referencing content absent from this setting, Triumph's cost in the spend tables, a
table-of-contents miscount, and Critical Injury rolls that exceed 100.

## Licensing

This is a **personal play aid** built from the owner's own material. Rules mechanics and
numbers are extracted; all effect text is paraphrased, and no setting prose, art, or logo
content is included. If you publish or distribute this app, licensing is your
responsibility — openly licensed material (an SRD, ORC/CC content) is the safe basis for
anything public.
