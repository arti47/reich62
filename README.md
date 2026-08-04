# REICH '62 Player

An installable PWA player-character companion for **REICH '62**, a Genesys narrative-dice
system: character creation wizard, in-play tracker, dice engine, Heat system, solo oracle,
and an opt-in GM screen.

**Status: planning complete, no application code yet.**

| File | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The canonical project spec — completed System Profile, blockers and proposed rulings, content inventory, data model, 60-row Data Extraction Ledger, and the 7-phase build roadmap |
| `source/reich62_manual.md` | The rulebook — sole source of record for every rules value |
| `source/BUILD_TEMPLATE_v2.md` | The build template `CLAUDE.md` instantiates |

## Open items before Phase 0

Four gaps in the manual block specific features (full detail in `CLAUDE.md` §4):

- **B-1** — die face distributions are not printed → manual symbol entry ships as the
  primary dice input; the digital roller stays toggled off until face data is supplied.
- **B-2** — the human base Wound/Strain Threshold is not printed → proposed base WT 8 / ST 10.
- **B-3** — starting gear budget and currency name are not printed → proposed generic
  "credits" with a configurable house-aid default.
- **B-4** — "staggered" and "disoriented" are used but never defined → proposed definitions.

Ten further ambiguities (R-2 … R-14) have proposed rulings recorded in the same section.

## Licensing

This is a **personal play aid** built from the owner's own material. Rules mechanics and
numbers are extracted; all effect text is paraphrased, and no setting prose, art, or logo
content is included. If you publish or distribute this app, licensing is your
responsibility — openly licensed material (an SRD, ORC/CC content) is the safe basis for
anything public.
