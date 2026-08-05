# REICH '62 — ERRATA & RULINGS
*Resolves all 22 identified gaps across the Manual and Bestiary. Each ruling is binding going forward; where a document required a text fix, the fix has been applied to the source file. Badge legend: 🏷️ = inferred/house value (not printed elsewhere in either source), no badge = restatement or bookkeeping only.*

---

## A. SILENT — the sources never stated it (7)

| # | Gap | Ruling | Fixed in |
|---|---|---|---|
| R-B1 🏷️ | Die face distributions never printed | Full face table supplied (Manual §1 cross-reference) — see *genesys_dice_breakdown.md* | Standalone file, already delivered |
| R-1 🏷️ | Human base Wound/Strain Threshold unstated | **Base Wound Threshold 8, base Strain Threshold 10** (human). Anna Voss's printed Wound 11 was an erratum — corrected to **10** (8 + Brawn 2) | Manual §6, §16 |
| R-4 | GM Story Point pool starting size unstated | **GM pool starts at 0** — points reach it only through player spends (per §8's flow rule, this was implicit; now stated explicitly) | Manual §8 |
| R-5 | Characteristic floor before XP spend unstated | **All six characteristics start at 1** — matches the sequential 10×N cost already printed in §7 | Manual §7 |
| R-6 🏷️ | "Staggered" used, never defined | **Staggered: cannot take actions; maneuvers and incidentals unaffected.** | Manual §9 (new definitions note) |
| R-7 🏷️ | "Disoriented" used, never defined | **Disoriented: adds 🎲Setback to all checks** for the stated duration. | Manual §9 (new definitions note) |
| R-8 🏷️ | No currency name or starting budget printed | **Currency = Reichsmark (RM). Starting budget: 500 RM**, unspent kept; roll d100 after purchases for "pocket money" (not usable for further starting gear) | Manual §13/§14A |

## B. AMBIGUOUS — printed, but two readings (5)

| # | Gap | Ruling |
|---|---|---|
| R-3 | Competitive check ties unaddressed | Break ties by **total Success → total Advantage → Triumph**; if still tied, treat as simultaneous. |
| R-12 | Spend-table rows read "🔺🔺 or ☀️" — does Triumph = 2 Advantage? | **No.** One Triumph buys **any** effect listed at **any** tier in that table (attacker's/active character's choice). Advantage costs remain literal (must accumulate the stated number). |
| R-16 | Guard Dog offered as "Minion-equivalent or Rival-lite," neither chosen | **Defaults to Minion.** GM may promote a specific individual dog to Rival with a one-line note ("this one's a Rival") — no separate stat block needed, reuse Rival-tier numbers from the Hound Handler's dog. |
| R-17 | Bestiary "Defense: 0/1" printed with no key | **Read as melee/ranged**, matching the Character Sheet Reference field order (Manual §16A). |
| R-20 | Face table: Proficiency 12 = Triumph alone; Challenge 12 = Despair alone | **Stored exactly as printed.** A Triumph face does **not** also count as a Success; a Despair face does **not** also count as a Failure. (Already correct in *genesys_dice_breakdown.md* — no change needed.) |

## C. CONTRADICTIONS between sections (6)

| # | Clash | Ruling |
|---|---|---|
| R-2 | Basic Military Training talent grants "Ranged (Heavy)" — a split Manual §4 doesn't use | **Grants Athletics, Ranged, Resilience** (flat, no Light/Heavy split, matching Manual §4's unsplit skill list). Talent entry corrected. |
| R-9 | Week-rest healing said "on ⚡ an additional Critical Injury heals" — a Despair granting a benefit contradicts §1 | **Read as Triumph (☀️).** Manual §5G corrected. |
| R-10 | Meaning/Element tables said "roll 1🎲, an Ability die read 1–10" — but §1 makes Ability a d8 | **Use a plain d10** for all Meaning/Element/Oracle-adjacent 1–10 rolls. Wording corrected in §15A/§15B. |
| R-13 | TOC advertised "18 items" for the Gear List; §15 lists 17 | **Ship 17.** TOC corrected to match. |
| R-14 | Critical Injury table runs to 151+ on a stated d100 | **Index roll + modifiers** (e.g., Vicious X adds 10×X, per §10) is how totals beyond 100 are reached — this was already the intended mechanism, now stated explicitly in §9. |
| R-21 | §5 said "1 action + 2 maneuvers"; §5A said one free maneuver, second costs 2 strain, cap of two | **§5A governs.** §5's combat sequence step 2 corrected to reference §5A directly rather than restating a conflicting version. |

## D. BESTIARY CONVENTIONS (3)

| # | Gap | Ruling |
|---|---|---|
| R-15 | Nemesis thresholds and the Patrol Horse's Soak don't match the PC-derivation formulas (§6) | **Printed bestiary stats are authoritative and are never recomputed** from the PC formulas — they're hand-tuned for balance. Any *new* adversary you build fresh with the §12C recipe derives its own numbers and is stored separately; it doesn't retroactively "correct" printed entries. |
| R-18 | Bestiary prints a per-member Wound Threshold; §12C defines the group total as a sum | **Store per-member** (as printed); **compute the group total = per-member value × member count** at the table. No contradiction — this is the same math, just computed at time of use rather than pre-summed on the page. |
| R-19 | "Disciplined" (SS Security Detail) and "Hardened" (§12D) both touch Disorient and look similar | **Kept as two distinct abilities.** Disciplined = immune to Disorient only. Hardened = immune to Disorient **and** Stagger. Do not merge. |

## E. NOT IN THE SOURCES AT ALL (1)

| # | Item | Status |
|---|---|---|
| H-1 🏷️ | Black-market purchase mechanic (ration cards above Rarity 5, +1 difficulty with nothing to trade, Heat exposure on bad failure) | **House rule — not derived from any printed rule.** Kept, badged, and unchanged: this is genuinely new content layered onto §14A, not a resolution of an existing gap. |

---

## Notes on process

- Every ruling above is intended to be treated as binding for future play and future edits — don't silently re-derive a different answer for the same question later.
- Items badged 🏷️ are inferred/house values with no printed source in either the Manual or Bestiary; everything else is either a restatement of what the sources already implied (R-14, R-18, R-20) or pure bookkeeping that doesn't change play (R-13).
- Where a fix was textual, it has been applied directly to *reich62_manual.md* or *reich62_bestiary.md* rather than left as a standalone correction to track by hand.
