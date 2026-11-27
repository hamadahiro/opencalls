# Tone — opencalls.monographica.com

How we write prose on detail pages. The goal is content that reads like a knowledgeable friend describing the call to you, not a brochure.

## Voice

- **Editorial, not promotional.** State what's there, not why it's exciting.
- **Observational, not motivational.** No "don't miss this," "exciting opportunity," or "your work deserves." Treat the reader as someone already deciding whether to apply, not someone being convinced.
- **Specific over generic.** "150-page softcover, edition of 500" beats "beautiful publication." If we don't have the specific, we don't fill the space.
- **Skeptical of marketing language.** Strip "world-class," "prestigious," "renowned," "leading," "premier" unless we're directly quoting an external source that earned the right to say it (e.g., "winner of the 2024 Deutsche Börse Prize").
- **Short syntactical units.** Short sentences. Comma splices over semicolons. No transitions like "Furthermore," "Additionally," "Moreover."

## What we write about

In rough priority order — only include if the source material supports it:

1. **What's actually offered** — money, exhibition, publication, residency length, materials, what the artist physically receives.
2. **Concrete logistics** — who's eligible (with the actual restriction, not "open to artists"), how submissions work, what gets reviewed.
3. **Selection process** — who's the juror/curator and what they bring, how many finalists, how shortlist works.
4. **Context that helps the applicant decide** — past winners, edition number, partner organizations, where it's been exhibited.
5. **Things worth flagging** — non-obvious eligibility limits, fee waivers, AI policy quirks, location requirements that might disqualify someone.

## What we don't write

- "About X" intros that restate the title.
- "Why apply" sections — let the facts argue for themselves.
- "How to apply" sections that just rephrase the apply button.
- Generic statements true of any prize ("a great opportunity for emerging photographers").
- Speculation about prestige, importance, or visibility unless we have a source.
- Anything we couldn't defend if the organizer read the page.

## Length — enforced by the build (owner, 2026-11-16)

The owner: "what started as 2-3 sentences now is 2-3 screens full of text". The old target here (200–350 words)
is what made descriptions grow; it is withdrawn.

- **description**: 2–3 sentences, one paragraph, 40–60 words. The build refuses more than 3 sentences or 75 words
  on any call added from 2026-11-16 (existing calls keep their text).
- **summary**: one sentence, at most 25 words and 140 characters.
- Keep, in this order: what is actually offered; who can apply when restricted; the one catch (a fee charged on
  selection, rights, AI rule, membership). The tags already show deadline, fee, prize and location — don't repeat them.

## Privacy — enforced by the build (owner, 2026-11-25)

"none private info is public... that the rule". data.json, every page and this repository are public. No email
address in any job note (write `[address]`); organizers' contact addresses (the private outreach store) are never in
data.json or a page. The only address a page may show is the application address artists need, written in the
description, copied from the organizer's own page. No private, scratch or fetched files in the repository: they live
under `scripts/` (ignored). The build refuses an address in a note and any private address in a published file.

## Fees — one format, enforced by the build (owner, 2026-11-25)

"if something is paid at the end its not free... its like paying in a restaurant before or after the meal", and
"whatever format you have you must stick to that one not mix it every time". Two fields, one way of writing each.

**Amounts.** The currency before the number: `$30` (US dollars), `£30`, `€30`, `¥5,000`, `₹100`; other dollars
with their letters: `CA$65`, `A$20`, `NZ$30`, `S$120`; every other currency as its code and a space: `DKK 100`,
`SEK 500`, `CHF 65`, `ISK 50,000`. Ranges with an en dash, the symbol on both ends (`€15–€35`; a code once:
`SEK 250–500`). "And up" is `$10+`. A period after a slash: `$45/year`, `€900/month`, `$325/week`.

**fee** — what it costs to enter. It starts with `Free`, the amount, `Pay what you can` or `Fee (amount not stated)`
(`Not stated` when nobody knows). The shapes:
- `Free`, `Free (1 image)`, `Free (voluntary €5 donation)`
- `$30`, `$30 per image`, `$35 for 5 images`, `$35 for up to 3 works`, `$35 for 5 images, $5 each additional`,
  `$40 for 5 images, $45 for 10`, `$40 per image, $80 per series`, `$35 ($25 members)` — "each additional",
  "for 5 images", members in brackets; never addl, per extra, /5 images, + $5 each, PWYC, From.
- One bracket note at the end carries everything else, commas inside: `$35 ($25 members, $45 after Dec 1)`,
  `$15 for up to 3 images (fee waivers available)`, `€25–€45 for 3–15 images (€30–€50 after Nov 30)`.
- `Free (voluntary donation)` when the amount is left to the artist.
The build reads the WHOLE fee against these shapes, on every call, open or closed (generate-pages.js, "ONE FORMAT").

**additionalFees** — every other payment the artist must make; left out when there is none; at most 90 characters.
Each item: the amount, then what it is (lowercase), then when; items joined by `; `; notes in brackets at the end, with
commas inside (never a semicolon):
- `$150 hanging fee if selected`, `£20–£35 fee if selected`, `€900/month residency fee if selected (€1,000 in summer)`
- `$45/year WEAD membership ($20 students)`, `€15 Freelens membership`, `$75/year Aperture print subscription`
- `£8 each additional image`, `$100 deposit if selected (refundable)`
- unknown amount: the noun first, then `(amount not stated)`: `Participation fee if selected (amount not stated)`,
  `HCP membership (amount not stated)`
- "if selected" is the one word for when (not if accepted, on acceptance); never "required" — everything in this
  field must be paid. A membership or subscription needed to apply has no "when".

What is not a fee: sales commission, the artist's own shipping, travel, materials or framing, optional add-ons, money
the organiser PAYS the artist (a "participation fee" paid to selected artists is a prize). A member discount is not an
additional fee; a membership needed to enter is — and then it is ALWAYS both the eligibility tag `membership-required`
and an additionalFees item naming it, or neither (the build refuses one alone). On every call page Eligibility
says "Membership required" (who can apply) and Additional fees says the price, "$45/year WEAD membership" (what it costs).

Cards show `Free` (nothing to pay at any stage), `Free entry*` (free to enter, additional fees), `$30 fee`,
`$30+ fee` (the price rises: per image, each additional, or a later higher amount — never for a lower members' price
or a waiver), `$30 fee*` (additional fees), `Paid entry` (amount not stated). The call page shows "Entry fee" and "Additional fees".

## Jury — enforced by the build (owner, 2026-11-26)

"this is about people... it must be accurate". A wrong entry shows a person as juror of a call they did not judge.

**jury** — the people the organizer's own page names as selecting for THIS call, this edition, one entry each:
`Name, Role, Organisation`, the role as that page states it for this call.
- A name goes in only when the page shows the person selecting for this edition. A jury of an earlier edition, "to be
  announced", "will be revealed soon": leave jury empty.
- A curator, reviewer, editor or partner is not jury unless the page says they select, judge or choose the work.
- A group stays as written (`Panel of three curators`). No jury named: no jury field.

**juryPeople** — one value per jury entry, same order, same length. `jury` and `juryPeople` always change together, in
the same write: add, remove, reorder or edit an entry and its value moves with it. The build refuses any other shape.
A value is a person id from jury.json, or `not-person`: a group, committee, organisation, team, a role without a name,
a placeholder. **A name on a call is linked** (owner 2026-11-27: "A name on a call is linked, or it is not on the
call"; on the names already listed: "dont remove", "keep and link"). Every person entry has a person id; there is no
plain-text name, and the build refuses one.

**Who is who.** Never on the name alone. The same person only when a public page ties the two beyond the name: the same
organisation or role on both calls, or a bio, CV, staff page or the organizer's juror bio naming the other role.
Anything else is a person of their own (scripts/jury-add.js), a namesake told apart by an organiser of their own calls.
A person goes in only when the entry was checked on the organizer's page. Every link and every "same person" decision
has a source page, kept outside the repository.

**Juror pages** say where the person judged and under what title, from their own entries only: "Juror for A, B and C,
listed as …". "Listed as", never "is" or "works as": a title is what that call printed, not the person's job today. A
person on two or more calls has a written `summary` and the calls it was written for (`summaryCalls`); when the build
prints `JURY SUMMARY STALE: <id>`, rewrite both in the same run: organisers as the site prints them, newest call first
(more than four: the newest three and "N other organisers"); wordings of one job merged; an entry that is only an
organisation or a place left out; nothing the entries do not hold. A person back on one call: delete both fields.

**Privacy.** A name, and the role the organizer published for the call. Never an email, phone, address, photo, birth
date, family or anything personal. Research and evidence stay outside the repository.

## Tags — enforced by the build (owner, 2026-11-16)

"tags is for 1 or sometimes 2 words not whole sentences". `prize` is split on " + " into tags:

- at most 3 tags; each at most 2 words and 20 characters; an amount counts as one word ("$1,000", "CHF 750");
- no dates, venues, brackets, dashes, colons or negations in a tag — details go in the description;
- good tags: Exhibition, Solo exhibition, Publication, Catalogue, Photobook, Residency, Fellowship, $500,
  $1,000 grant, CHF 750, Stipend, $350 honorarium, Artist fee, Purchase.

Location and eligibility chips are shortened by code (shared.js `tagLocation`, `eligibilityTag`); the full text
stays on the detail page.

## Sourcing

- Always pull from the **official call/organizer page** — never aggregator listings, never AI-generated content, never repackaged press releases.
- Read the source page in full, then close it and write from notes. Don't draft with the source open beside you — that's how plagiarism happens and how marketing language leaks in.
- If the source uses promotional language, translate it to factual: "world-renowned jury" → list the jurors with their actual roles.
- Cross-check numbers (prize amount, edition number, deadlines) against data.json. If they conflict, the official site wins.

## Tone calibration — examples

**Bad** (the kind we just reverted on Hopper Prize):
> The Hopper Prize is an unrestricted artist grant open to visual artists working in any medium. Unlike awards tied to a single discipline or theme, applicants submit work freely chosen from their existing practice…

This is filler. It restates "all visual art media eligible" in marketing prose, then explains what "unrestricted" means as if the reader doesn't know.

**Better** (same call, factual):
> The shortlist is published as an online journal feature. Past cycles have included artists working in painting, sculpture, video, and photography — the prize doesn't restrict by medium, and the juror typically rotates each cycle. This round is judged by Misa Jeffereis, an assistant curator at CAM St. Louis, a non-collecting institution with a contemporary program.

Specific, factual, leaves the reader with information they didn't have, and reads like someone who actually looked at the prize.

**Bad** (motivational):
> This is a unique opportunity for emerging photographers to gain visibility and recognition…

**Better** (observational):
> Six awards. Two at $4,500 and four at $1,000, paid as unrestricted grants — recipients aren't required to use the funds for a specific project.

## When to skip prose

- Calls with deadlines under two weeks away — not worth the effort if they'll close before Google reindexes.
- Calls where the official page itself is one paragraph — we'd be inventing material.
- Calls we suspect are fee-collection schemes (per existing rejection memos) — these shouldn't get extra surface area on our site.
