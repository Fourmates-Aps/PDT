# Brand Guidelines v1.0

**Profil Design Trading ApS** · CVR 35657886 · Vejle · Billund · Fredericia · Skjern
Direction: **Nordic Workwear** — industrial credibility, Nordic restraint, premium finish.

## Quick Reference

| Token | Value |
|---|---|
| Primary Color | #BC4318 |
| Secondary Color | #0E1214 |
| Accent Color | #F26522 |
| Primary Font | Familjen Grotesk |
| Body Font | Instrument Sans |
| Voice | Direct · Trade-confident · Effortless |

### Why this direction

The category defaults to corporate blue or eco-green. Profil Design Trading sells, among other
things, EN 20471 high-visibility garments — so a high-visibility amber is both *authentic to the
product* and *unclaimed by competitors*. It is used as a 5% accent against generous neutrals, never
as a field colour: restraint is what keeps it premium rather than loud.

Graphite (`#0E1214`) rather than pure black, and a warm bone white (`#FBFAF7`) rather than `#FFFFFF`,
give the page the softer, warmer light of Nordic interiors and stop the palette reading as
generic-SaaS.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| High-Vis Burnt | #BC4318 | rgb(188,67,24) | Accent text on light, solid buttons with white text |
| Graphite Ink | #0E1214 | rgb(14,18,20) | Primary buttons, dark sections, headings |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| High-Vis Amber | #F26522 | rgb(242,101,34) | CTA fill on dark sections (with ink text), rules, marks |
| High-Vis Light | #FF8A4C | rgb(255,138,76) | Accent text on dark backgrounds only |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | #FBFAF7 | rgb(251,250,247) | Page background (warm bone) |
| Surface | #F4F2ED | rgb(244,242,237) | Alternating sections, cards |
| Border | #E7E4DC | rgb(231,228,220) | Dividers, hairlines, input borders |
| Text Primary | #1A2126 | rgb(26,33,38) | Headings, body copy |
| Text Secondary | #5A666E | rgb(90,102,110) | Captions, muted text, labels |
| Ink Muted | #98A3AA | rgb(152,163,170) | Muted text on dark surfaces |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success | #1F7A4C | Confirmations, in-stock, form success |
| Warning | #B26A00 | Back-order, low stock, budget warnings |
| Error | #B3261E | Validation errors, overdue |
| Info | #1D4E86 | Neutral system notices |

### Accessibility — measured, not assumed

Every pairing below was computed against WCAG 2.1 relative luminance. **All pass AA.**

| Pairing | Ratio | Level |
|---|---|---|
| Text Primary on Background | 15.9:1 | AAA |
| Text Secondary on Background | 5.65:1 | AA |
| Text Secondary on Surface | 5.27:1 | AA |
| White on High-Vis Burnt (button) | 5.31:1 | AA |
| High-Vis Burnt on Background (accent text) | 5.09:1 | AA |
| Graphite Ink on High-Vis Amber (CTA on dark) | 5.97:1 | AA |
| High-Vis Light on Graphite Ink | 8.06:1 | AAA |
| Background on Graphite Ink | 18.0:1 | AAA |

**Rule:** never place white text on High-Vis Amber (`#F26522`) — it measures 3.15:1 and fails AA.
On amber, text is always Graphite Ink. This is also how real safety signage works.

---

## 2. Typography

### Font Stack

```css
--font-display: 'Familjen Grotesk', system-ui, sans-serif;  /* headings, eyebrows, numerals */
--font-body: 'Instrument Sans', system-ui, sans-serif;      /* body, UI, forms */
```

Both are variable fonts, self-hosted through `next/font/google` (no external requests, no layout
shift). Both include the `latin` subset, which covers **æ ø å** — mandatory for Danish.

Familjen Grotesk is a Scandinavian grotesk: it carries Nordic character without costume, and its
tight uppercase suits the short, declarative headlines this brand uses. Instrument Sans stays
legible at 14px in dense B2B content (specs, tables, form labels) where a display face would not.

### Type Scale

| Element | Font | Weight | Desktop / Mobile | Line Height | Tracking |
|---------|------|--------|------------------|-------------|----------|
| Display | Familjen Grotesk | 700 | 68px / 38px | 1.02 | -0.03em |
| H1 | Familjen Grotesk | 700 | 48px / 32px | 1.08 | -0.02em |
| H2 | Familjen Grotesk | 600 | 36px / 27px | 1.15 | -0.015em |
| H3 | Familjen Grotesk | 600 | 24px / 20px | 1.25 | -0.01em |
| Eyebrow | Familjen Grotesk | 600 | 12px | 1.2 | 0.18em, uppercase |
| Body Large | Instrument Sans | 400 | 19px / 17px | 1.55 | 0 |
| Body | Instrument Sans | 400 | 16px | 1.6 | 0 |
| Small | Instrument Sans | 400 | 14px | 1.5 | 0 |
| Caption | Instrument Sans | 500 | 12px | 1.4 | 0.01em |

Numerals in stats and prices use `font-variant-numeric: tabular-nums`.
Measure is capped at `65ch` for body copy.

---

## 3. Logo Usage

Profil Design Trading **already has a logo**. Do not generate, redraw, or "modernise" it.
Until the official vector asset is supplied, the landing page sets the name as a **typographic
wordmark** in Familjen Grotesk 700, with the descriptor "BE YOUR BRAND" as a tracked-out eyebrow.

- Clear space: minimum equal to the cap height of the wordmark on all sides
- Minimum digital size: 120px wide
- Do not: stretch, rotate, recolour outside the palette, add shadow/gradient, or set on a busy photo

---

## 4. Voice & Tone

### Brand Personality

| Trait | We Are | We Are Not |
|-------|--------|------------|
| **Direct** | Short sentences. The number, then the point. | Salesy build-ups, adjective stacking |
| **Trade-confident** | We know broderi vs. tryk, EN 20471, PMS, leveringstid | Condescending, or hiding behind jargon |
| **Effortless** | Copy that itself feels like less work to read | Dense corporate paragraphs |
| **Concrete** | Proof, specifics, real constraints | Vague promises we cannot evidence |

### We sound like

- "Jeres medarbejdere bestiller selv. Inden for det budget I sætter."
- "Logoet ligger som spec: placering, metode, mm og PMS. Trykkeren gætter ikke."
- "Én faktura til e-conomic. Ikke fyrre mails."

### We do not sound like

- "Revolutionerende platform, der disrupter branchen"
- "Vi er passionerede omkring arbejdstøj"
- "Book en uforpligtende demo i dag og oplev forskellen!"

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Marketing | Confident, plain | "Firmatøj med jeres logo — uden mailtråden." |
| Form labels | Neutral, minimal | "Antal medarbejdere" |
| Validation error | Helpful, blameless | "Skriv en e-mail vi kan svare på." |
| Success | Brief, specific | "Modtaget. Vi vender tilbage inden for én arbejdsdag." |

---

## 5. Claim Integrity — non-negotiable

This brand sells to procurement professionals. An unprovable claim on the landing page becomes a
credibility problem in the sales meeting. The following are **prohibited until PDT supplies written
evidence**:

- **Customer names or logos.** The company names in `prototype/` (`REALCUST`: Lego, Vestas, Novo
  Nordisk, Salling Group …) are seed data copied from an unrelated e-conomic fixture. They are
  **not** Profil Design Trading customers and must never appear as such.
- **Testimonials or quotes.** None exist. Do not write placeholder ones "to be replaced later" —
  they get shipped.
- **Counts and percentages** — "X+ kunder", "spar X% tid", "X ordrer om året". No source, no claim.
- **Integrations described as live.** Per `Supplier_data_capabilities.md`: NWG/New Wave still needs a
  token, Snickers and F&H have no ordering API, ID Identity access is pending. Supplier names may be
  listed as **assortment we supply**, never as "connected integrations".
- **CO₂ figures without the qualifier.** Only 237 of 700 You products carry CO₂ data and Fristads
  does not publish it at all. Always phrase as *"vejledende, baseret på leverandørdata"* and never
  imply full coverage.

Facts that **are** verified and may be stated freely: CVR 35657886 · four showrooms (Vejle, Billund,
Fredericia, Skjern) · 2–4 hverdages levering · priser ekskl. moms · assortment brands carried ·
e-conomic as finance system · GLS as carrier.

---

## 6. Imagery

- **Photography:** real garments and real work contexts — workshop, warehouse, site, kitchen.
  Natural side light, muted Nordic colour, no stock-photo handshakes or grinning boardrooms.
- **Treatment:** slight desaturation, warm shadow. Never a colour wash over people.
- **Placeholders:** while no licensed photography exists, use flat tonal blocks and typography
  rather than random stock. An honest empty frame beats a borrowed lifestyle image.
- **Icons:** outlined, 1.5px stroke, 2px corner radius, currentColor. No filled or duotone mixing.

---

## 7. Layout Principles

- Generous vertical rhythm: section padding 96px desktop / 56px mobile
- Content max width 1200px; text blocks capped at 65ch
- Hairline borders (`#E7E4DC`) instead of shadows for structure; shadows only on raised interactive surfaces
- Radius scale: 4px (inputs, tags) · 8px (buttons) · 14px (cards) · never fully rounded except avatars
- Alternate Background / Surface between sections; use one full Graphite Ink section as the visual anchor
- Accent appears at most twice per viewport
