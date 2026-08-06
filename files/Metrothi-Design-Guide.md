# Metrothi — Design Brand Guide & Redesign Plan

**Status:** Reference document. **No design changes are executed by this document.**
**Part I** is a distillation of Apple's Human Interface Guidelines, scraped in full on 2026-08-02.
**Part II** is a redesign plan for Metrothi derived from the app's *data*, not from its current design.

**Source:** `https://developer.apple.com/design/human-interface-guidelines/` — 176 pages crawled via the
documentation JSON API (`/tutorials/data/design/human-interface-guidelines[/<slug>].json`). The public
HTML is client-rendered and returns nothing to a plain fetch; the JSON endpoint is the reliable source
if this document ever needs re-verifying.

**Companion documents:**
- `files/Metrothi-PRD.md` — product vision, scope, non-goals. Governs *what* is built. Wins on conflict.
- `CLAUDE.md` — engineering invariants (boot budget, data layering, i18n rules). Governs *how*. Wins on conflict.
- `DISCREPANCIES.md` — out-of-scope findings.

This document governs *how it should look and feel*. Where it disagrees with the PRD on product truth,
the PRD wins. Where it disagrees with CLAUDE.md on an engineering invariant, CLAUDE.md wins — several of
those invariants (boot budget, no fake real-time, no stand-in photos) are load-bearing and the redesign
is constrained by them rather than free to override them.

---
---

# PART 0 — How to read this

The HIG is not a stylesheet. It is a set of *arguments* about how people use software, each argument
followed by a rule that falls out of it. Copying the rules without the arguments produces an app that
looks Apple-ish and behaves badly. So Part I keeps the reasoning attached to each rule.

Three cautions before the rules:

1. **Metrothi is a web PWA, not an iOS app.** Some HIG guidance is platform machinery we cannot and
   should not clone (Liquid Glass, SF Pro, Dynamic Type, SF Symbols licensing). §I.11 is an explicit
   translation layer that says, per topic, what transfers and what does not. Read it before applying
   anything from §I.2–§I.7.
2. **The HIG is a floor for correctness and a ceiling for eccentricity, not a source of identity.**
   Apple says so itself: *"Ensure branding always defers to content"* and *"Simplicity isn't
   minimalism."* Following it exactly yields a competent, characterless app. Metrothi's identity has to
   come from somewhere else — Part II §7 proposes where.
3. **Metrothi's users are not Apple's median user.** They are riders in Ahmedabad and Gandhinagar, often
   one-handed, often on a moving train, often on a mid-range Android device, often reading Gujarati or
   Hindi, often in bright outdoor daylight on a platform. Every rule below should be re-read through
   that filter. Where the HIG's assumption fails for this audience, Part II says so.

---
---

# PART I — The Human Interface Guidelines, distilled

## I.1 The eight principles

Apple reintroduced an explicit principles page on 2026-06-08. These eight are the root of everything
else in the HIG, and they are the part most worth internalising.

### 1. Purpose — create value

- **Create value.** At every stage, ask what the product is *for* and whether the design serves it.
- **Keep focused.** Prioritise the most important features and make those *truly great*, rather than
  making everything adequate.
- **Find new ways to solve the problem.** Investigate existing solutions and avoid re-creating them.
  Define what sets the product apart and let the design reflect it.

### 2. Agency — the person is in control

- **Stay out of the way.** Get people directly to the task or content. *"The best designs are
  unobtrusive and present when people need them."*
- **Give people the freedom to explore.** Don't lock them into flows or modes. When a guided flow is
  necessary, make it easy to skip or escape.
- **Help people recover from mistakes.** *"When people know they can reverse an action or return to a
  previous state, they feel free to explore, and that freedom makes your interface more inviting."*

### 3. Responsibility — earn trust

- **Be fully transparent about what the product does and why.** Provide a clear rationale when asking
  for permission; be clear about what data is collected and how it is used.
- **Keep people's information safe.** Collect only what the product needs. Anticipate misuse.

### 4. Familiarity — borrow, don't invent

- **Use concepts people know.** People bring knowledge of the real world and of other software.
- **Keep visuals and interactions consistent.** Once a behaviour or appearance is established, apply it
  throughout. Consistency speeds learning and builds confidence.
- **Provide clear feedback.** Show when controls are available, indicate when content changes, use
  system patterns for alerts and choices.

### 5. Flexibility — design for everyone

- **Design for everyone.** *"Treat accessibility as a priority from the start."*
- **Preserve a person's context.** Keep content and controls in consistent, predictable positions; use
  natural animation to ease transitions.
- **Consider a variety of input methods** — voice, touch, keyboard, and more.
- **Approach every platform with intention.** Give each platform the same level of care.

### 6. Simplicity — include just what's necessary

- **Include just what's necessary.** *"Simplicity isn't minimalism. Aim for a focused, useful experience
  that keeps the important things close by and lets the others fall away."* This is the single most
  useful sentence in the document for Metrothi, which is dense with genuinely useful facts.
- **Be concise.** *"When you find the simplest way to say something, it's often the most universal, and
  the most helpful."*
- **Establish hierarchy.** When form and function are apparent, people know how to reach an outcome.

### 7. Craft — quality sets the tone

- **Quality sets the tone.** *"Every element of your design shows people how much you care."*
- **Experiment and iterate.** Prototype early; be willing to discard.
- **Maintain your craft.** *"Shipping isn't the finish line."*

### 8. Delight — earned, not decorated

- **Identify the emotion you want to inspire.** A fitness app might energise; a meditation app might calm.
- **Create defining moments.** Every interaction — even an error message — is a chance to show character.
- **Don't mistake delight for decoration.** *"People are trying to accomplish a task, so don't let
  pursuit of delight for its own sake get in the way of your product's core purpose."*
- **Consider the whole.** Delight is the sum of freedom to act, safety to explore, familiar metaphors,
  and smooth transitions between contexts.

> **For Metrothi:** the emotion to design for is **confidence**. Not excitement, not calm — the specific
> relief of knowing you will make your train. Every visual decision in Part II is tested against that.

---

## I.2 Typography

### The rules

- **Use font sizes most people can read easily.** iOS default **17 pt**, absolute minimum **11 pt**.
- **Avoid light font weights.** Prefer Regular, Medium, Semibold, Bold. Avoid Ultralight, Thin, Light —
  *"which can be difficult to see, especially when text is small."*
- **If using a custom font with a thin weight, go larger than the recommended sizes.**
- **Convey hierarchy with weight, size, and colour** — and *maintain the relative hierarchy and visual
  distinction when people adjust text sizes.*
- **Minimise the number of typefaces.** *"Mixing too many different typefaces can obscure your
  information hierarchy and hinder readability."*
- **Prioritise important content when responding to text-size changes.** When someone enlarges text they
  want *the content they care about* larger — not every word on screen. Tab titles need not grow.
- **Keep text truncation to a minimum as font size increases.** Aim to display as much useful text at
  the largest accessibility size as at the largest standard size.
- **Consider adjusting layout at large font sizes.** Inline items (glyphs, timestamps) crowd text in
  horizontally constrained contexts — *"consider using a stacked layout where text appears above
  secondary items."* Reduce column count as size increases.
- **Maintain a consistent information hierarchy regardless of font size.** Keep primary elements toward
  the top even when text is very large.
- **Increase the size of meaningful interface icons as font size increases.**

### The iOS type scale (Large — the default tier)

This is the reference ladder. Sizes in points; on the web, 1 pt ≈ 1 CSS px at the base zoom.

| Style | Weight | Size | Line height | Emphasized |
|---|---|---|---|---|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

**Note the shape of this ladder.** It is not a geometric scale. It is dense and finely graded in the
13–22 range (where UI text actually lives) and jumps hard above 28 (where display text lives). There are
**five steps between 11 and 17** — that is deliberate: it lets you express hierarchy inside a dense row
without ever going below the legibility floor.

At the largest accessibility tier (AX5), the same ladder runs 40 → 60 pt. Body goes 17 → 53. That is a
**3.1× multiplier on body text** — any layout that assumes text is roughly its authored size will break
completely. This is the single most demanding constraint in the whole HIG.

### Minimum and default sizes by platform

| Platform | Default | Minimum |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

---

## I.3 Colour

### Best practices

- **Avoid using the same colour to mean different things.** If a brand colour indicates that a
  borderless button is interactive, using the same colour on non-interactive text is confusing.
- **Make sure all colours work in light, dark, and increased-contrast contexts.** Supply light and dark
  variants for every custom colour, *and* an increased-contrast option for each.
- **Test under a variety of lighting conditions.** *"In bright surroundings, colours look darker and
  more muted. In dark environments, colours appear bright and saturated."* — directly relevant to a
  transit app used on an open-air platform at midday.
- **Consider how artwork and translucency affect nearby colours.** *"Maps displays a light colour scheme
  when in map mode but switches to a dark colour scheme when in satellite mode."*
- **Avoid hard-coding system colour values.** Documented values are for design-time reference; actual
  values fluctuate between releases.
- **Avoid redefining the semantic meaning of dynamic colours.** Don't use a separator colour as a text
  colour, or a secondary-label colour as a background.

### Inclusive colour

- **Never rely on colour alone** to differentiate objects, indicate interactivity, or communicate
  essential information. *"Use text labels or glyph shapes to identify objects or states."*
- **Avoid colours that make content hard to perceive.** Red-green and blue-orange pairings are
  particularly difficult for colour-blind users.
- **Consider cultural perception.** *"Red communicates danger in some cultures, but has positive
  connotations in other cultures."* — a live consideration for an Indian audience, where red and saffron
  carry meanings quite unlike the Western "error" reading, and where white is not a neutral.

### Semantic layering (the iOS model worth copying)

iOS defines **two background sets** — *system* and *grouped* — each with primary / secondary / tertiary:

- **Primary** — the overall view
- **Secondary** — grouping content within the overall view
- **Tertiary** — grouping content within secondary elements

And **four foreground label levels**:

| Level | Use for |
|---|---|
| Label | Primary content |
| Secondary label | Subheading or supplemental text |
| Tertiary label | Text describing an unavailable item or behaviour |
| Quaternary label | Watermark text |

Plus `placeholderText`, `separator`, `opaqueSeparator`, `link`.

**This is the important idea, and it transfers completely to CSS custom properties:** colours are named
by *role in the hierarchy*, never by appearance. `--c-text-2` is right; `--c-grey-600` is wrong.

### Dark Mode

- **Never offer an app-specific appearance setting** that conflicts with the system preference. *"They
  may think your app is broken because it doesn't respond to their systemwide appearance choice."*
  (An app-level toggle that *defaults* to system is fine; an app-level toggle that *ignores* system is not.)
- **Dark colours are not inversions of light ones.** Some invert, many do not.
- **Contrast minimum 4.5:1; strive for 7:1 for custom foreground/background pairs, especially small text.**
- **Soften white backgrounds in content images** so they don't glow in a dark context.
- **iOS uses two dark background sets — base and elevated.** Base recedes, elevated advances. The system
  swaps base → elevated automatically when an interface comes forward (popover, modal sheet). Using a
  custom background colour defeats this and makes depth harder to perceive.
- Beware: *"turning on Increase Contrast in Dark Mode can result in reduced visual contrast between dark
  text and a dark background."* Test that specific combination.

---

## I.4 Materials, depth, and the control/content split

This is the most recently rewritten part of the HIG (Liquid Glass, June 2025) and the part that
transfers least literally to the web — but the *structural* idea transfers completely and is worth
taking seriously.

### The structural idea

There are **two layers**: a **content layer** and a **functional (control/navigation) layer** that floats
above it. The functional layer is visually distinct from content — it does not sit on the same plane.
Content scrolls *beneath* it and peeks through.

- **Don't use the floating-control material in the content layer.** *"Including it in the content layer
  can result in unnecessary complexity and a confusing visual hierarchy."* Use standard materials
  (thin/regular/thick blurs) for structure *within* content.
- **Use these effects sparingly.** *"Limit these effects to the most important functional elements."*
- **The material has no inherent colour** — it takes colour from the content behind it. Apply colour only
  to elements that truly benefit from emphasis (a primary action, a status indicator).
- **To emphasise a primary action, colour the background — not the label.**
- **Refrain from colouring the background of multiple controls.**
- **Over visually rich backgrounds** (photos, video, *maps*), prefer the highly translucent variant, and
  add a dimming layer: *"If the underlying content is bright, consider adding a dark dimming layer of
  35% opacity."*
- **Thicker materials give better text contrast; thinner materials preserve context.** Choose by semantic
  need, not by the colour the material happens to impart.

### Scroll edge effects

Where a scroll view passes under a floating bar, a **scroll edge effect** blurs and reduces the opacity
of the content behind the bar to keep controls legible. *"Scroll edge effects aren't decorative. They
don't block or darken like overlays; they exist to ensure controls stay visually distinct."*

Apply **one per view**. In split layouts, keep their heights consistent.

> **For Metrothi:** this is directly load-bearing. The app is a full-bleed map (rich, bright, arbitrary
> content) with floating chrome (search pill, line-status strip, FAB, recentre) and a draggable sheet.
> The two-layer model is *already* the app's architecture; what's missing is a disciplined, consistent
> material treatment for the floating layer. See Part II §7.3.

---

## I.5 Layout

### Best practices

- **Group related items** using negative space, background shapes, colours, materials, or separators —
  *"ensure that content and controls remain clearly distinct."*
- **Make essential information easy to find by giving it sufficient space.** *"People want to view the
  most important information right away, so don't obscure it by crowding it with nonessential details."*
- **Extend content to fill the screen.** Backgrounds and full-screen artwork reach the edges; scrollable
  layouts continue to the bottom and sides. Controls appear *on top of* content, not on the same plane —
  the layout must account for that.

### Visual hierarchy

- **Differentiate controls from content** (see §I.4).
- **Place items to convey relative importance.** People read top → bottom, leading → trailing. Most
  important items go near the top and leading side. *"Be aware that reading order varies by language."*
- **Align components with one another.** Alignment communicates organisation and helps people track
  content while scrolling.
- **Use progressive disclosure.** If you can't show everything, *indicate* that more exists — a
  disclosure control, or partially visible items hinting that scrolling reveals more.
- **Give controls enough space and group them logically.** Crowded controls are hard to tell apart.

### Adaptability

Handle, at minimum: different screen sizes and resolutions; portrait and landscape; system features that
intrude on the display; text-size changes; and locale-based variation — *"left-to-right/right-to-left
layout direction, date/time/number formatting, font variation, and text length."*

**Preview on multiple devices, orientations, localizations, and text sizes.** Test the largest and
smallest layouts first — they surface the most problems fastest.

### Safe areas

A safe area is the region not covered by a bar or system feature. Respecting them is what makes an app
feel native. On the web the equivalents are the `env(safe-area-inset-*)` variables plus `100dvh`.

### iOS-specific

- **Aim to support both portrait and landscape.**
- **Avoid full-width buttons.** *"Buttons feel at home in iOS when they respect system-defined margins
  and are inset from the edges of the screen."*
- **Hide the status bar only when it adds value.**

---

## I.6 Icons and symbols

### Interface icons

- **Create a recognisable, highly simplified design.** Too many details make an icon unreadable.
- **Maintain visual consistency:** consistent size, level of detail, stroke weight, and perspective
  across every icon in the app.
- **Match icon weight to adjacent text weight** unless deliberately emphasising one.
- **Optically centre, don't geometrically centre.** Asymmetric icons look unbalanced when centred by
  bounding box. *"Adjustments for optical centering are typically very small, but they can have a big
  impact."*
- **Use inclusive images.** Prefer gender-neutral human figures; avoid culture-specific metaphors.
- **Include text in an icon only when essential for meaning** — and localise it if you do.
- **Use vector formats** (SVG/PDF) so scaling is free.
- **Always provide alternative text labels** for custom icons.

### SF Symbols (the system library)

Four rendering modes — **monochrome**, **hierarchical** (one colour at varying opacity per layer),
**palette** (one colour per layer), **multicolor** (intrinsic meaningful colours).

**Variable colour** represents a value that changes over time (capacity, strength, progress) by lighting
layers as thresholds are crossed. *"Use variable colour to communicate change — don't use it to
communicate depth."*

**Design variants:** outline (default; best in toolbars and lists beside text), fill (more emphasis; good
for tab bars, swipe actions, selection), slash (unavailable), enclosed (better legibility at small sizes).

**Animations** (SF Symbols 5+): Appear, Disappear, Bounce, Scale, Pulse, Variable Colour, Replace, Magic
Replace, Wiggle, Breathe, Rotate, Draw On/Off. Each carries a distinct meaning:
- **Bounce** — an action occurred or needs to take place
- **Pulse / Breathe** — ongoing activity (breathe changes size *and* opacity; pulse only opacity)
- **Rotate** — a task is in progress and working as expected
- **Wiggle** — highlight a change or call to action a person might overlook
- **Variable colour** — progress, connecting, broadcasting

*"Apply symbol animations judiciously… too many animations can overwhelm an interface and distract
people."*

**Licensing caution:** SF Symbols may not be used in app icons, logos, or any trademarked use, and the
font/library is licensed for Apple platforms. See §I.11.

---

## I.7 Motion

- **Add motion purposefully.** *"Don't add motion for the sake of adding motion. Gratuitous or excessive
  animation can distract people and may make them feel disconnected or physically uncomfortable."*
- **Make motion optional.** Never the only channel for important information.
- **Strive for realistic feedback motion that follows people's gestures and expectations.** *"If someone
  reveals a view by sliding it down from the top, they don't expect to dismiss the view by sliding it to
  the side."*
- **Aim for brevity and precision.** Brief, precise animation *"tends to feel lightweight and
  unobtrusive, and it can often convey information more effectively than prominent animation."*
- **Avoid adding motion to frequent UI interactions.** Don't make people watch an animation every time.
- **Let people cancel motion.** Never make someone wait for an animation to finish.

### Reduce Motion

When Reduce Motion is on (`prefers-reduced-motion` on the web), the HIG's specific instructions are:

- Tighten animation springs to reduce bounce
- Track animations directly with people's gestures
- Avoid animating depth changes in z-axis layers
- **Replace transitions in x-, y-, and z-axes with fades**
- Avoid animating into and out of blurs

---

## I.8 Accessibility

An accessible interface is **Intuitive** (familiar, consistent interactions), **Perceivable** (no single
required sense), and **Adaptable** (respects system settings and personal customisation).

### Vision

- **Support text enlargement to at least 200%.**
- **Meet contrast minimums:**

| Text size | Weight | Minimum contrast |
|---|---|---|
| Up to 17 pt | All | **4.5:1** |
| 18 pt and above | All | **3:1** |
| Any | Bold | **3:1** |

  If the default scheme doesn't meet these, it must at least provide a higher-contrast scheme when the
  system's Increase Contrast setting is on.
- **Convey information with more than colour alone.**
- **Describe the interface for screen readers.**

### Hearing

- Text-based equivalents for audio: captions, subtitles, audio descriptions, transcripts.
- **Pair audio cues with haptics** and with visual cues.

### Mobility

- **Control sizes:**

| Platform | Default control | Minimum control |
|---|---|---|
| iOS, iPadOS | **44 × 44 pt** | 28 × 28 pt |
| macOS | 28 × 28 pt | 20 × 20 pt |
| tvOS | 66 × 66 pt | 56 × 56 pt |
| visionOS | 60 × 60 pt | 28 × 28 pt |
| watchOS | 44 × 44 pt | 28 × 28 pt |

- **Spacing matters as much as size.** *"In general, it works well to add about 12 points of padding
  around elements that include a bezel. For elements without a bezel, about 24 points of padding works
  well around the element's visible edges."*
- **Support simple gestures for common interactions.** Avoid custom multi-finger gestures for anything
  frequent.
- **Always offer an alternative to a gesture.** *"If you use a swipe gesture to dismiss a view, also make
  a button available."*

### Cognitive

- **Keep actions simple and intuitive.** Prefer system gestures over custom ones people must learn.
- **Minimise time-boxed interface elements.** Views that auto-dismiss on a timer are *"problematic for
  people who need longer to process information, and for people who use assistive technologies."*
  Prefer explicit dismissal.
- **Let people control audio and video playback.** No autoplay without controls.
- **Be cautious with fast-moving and blinking animation.**

---

## I.9 Writing, voice, and inclusion

The HIG treats copy as a first-class design surface. For an app that must explain fares, ticket
validity, and feasibility, this is arguably the most important chapter.

### Voice and tone

- **Determine the app's voice.** *"What types of words are familiar to people using your app? How do you
  want people to feel?"* Build and keep a list of common terms.
- **Match tone to context.** The tone for reaching a goal differs from the tone for a failed payment.
- **Be clear.** *"Check each word to be sure it needs to be there. If you can use fewer words, do so.
  When in doubt, read your writing out loud."*
- **Write for everyone.** Plain language, accessibility and localization in mind, no jargon, no gendered
  terminology.

### Best practices

- **Consider each screen's purpose.** Most important information first.
- **Be action oriented.** Active voice; label buttons with verbs. *"Just saying 'Send' often works better
  than 'Let's do it!'"* Never "Click here" — use descriptive phrases.
- **Build language patterns.** Consistency makes writing easier and the app more cohesive.
- **Adopt capitalization rules and apply them consistently.** Title case reads formal, sentence case
  casual — pick one per element type and hold it.
- **Use consistent language across multi-step flows.** "Get Started" → "Continue"/"Next" → "Done".
- **Use possessive pronouns sparingly.** *"'Favorites' conveys the same message as 'Your Favorites,' and
  is more succinct."* **Avoid "we" altogether** — *"'We're having trouble loading this content'…
  Something like 'Unable to load content' is much clearer."*
- **Write for how people use each device.** Never "click" on a touch device.
- **Provide clear next steps on blank screens.** *"An empty screen can be daunting if it isn't obvious
  what to do next."*
- **Write clear error messages.** Display near the problem, avoid blame, be specific about the fix.
  *"'That password is too short' isn't as helpful as 'Choose a password with at least 8 characters.'"*
  *"Interjections like 'oops!' or 'uh-oh' are typically unnecessary and can sound insincere."*
- **Keep settings labels clear and simple.** Describe what a setting does *when turned on*; people infer
  the opposite.
- **Link directly to a setting rather than describing where it is.**

### Inclusion

- **Consider tone from different perspectives.** *"An academic tone can make an app or game seem like it
  welcomes only high levels of education."*
- **Use "you" and "your"** to address people. *"Referring to people indirectly as the user or the player
  can make your experience feel distant and unwelcoming."* Reserve "we"/"our" for the company.
- **Define specialized or technical terms, or avoid them.** *"Even when people know the definition… the
  sentence is easier to read — and translate — when it uses plain language."*
- **Replace colloquial expressions with plain language.** They are culture-specific and hard to translate.
- **Consider carefully before including humour.** *"Highly subjective and difficult to translate."*
- **Avoid unnecessary gender references** — they also break under localization into gendered languages.
- **Colours carry culture-specific meanings.** Verify per locale.
- **Each disability is a spectrum, and everyone experiences disability** — permanently, temporarily, or
  situationally. The HIG's own example: *"being unable to hear while on a noisy train."*

---

## I.10 Patterns and components (the relevant subset)

### Launching

- **Launch instantly.** *"Sometimes they don't want to wait more than a couple of seconds."*
- **A launch screen is not a branding opportunity.** *"A launch screen's sole function is to enhance the
  perception of your experience as quick to launch."* Design it to be *nearly identical to the first
  screen*, or people see an unpleasant flash. Avoid text on it (it can't be localized).
- **Restore the previous state.** *"Avoid making people retrace steps… scroll the view to people's most
  recent position."*

### Loading

- **Show something as soon as possible.** *"If you make people wait… they can interpret the lack of
  content as a problem."* Show placeholder text, graphics, or animation and replace it as content lands.
- **Let people do other things while waiting.**
- **Use a determinate indicator when duration is known.** Switch indeterminate → determinate when
  possible, but **never switch shape** (spinner ↔ bar).
- **Be accurate.** *"Showing 90 percent completion in five seconds and the last 10 percent in 5 minutes
  can make people wonder if your app is still working and can even feel deceptive."*
- **Avoid vague descriptions** like "loading" or "authenticating" — *"they seldom add value."*
- **Keep indicators moving.** A stationary indicator reads as a frozen app.

### Onboarding

- **Ideally people understand the app by experiencing it.** If onboarding is needed, make it *fast, fun,
  and optional*.
- **Teach through interactivity**, not instructional slides.
- **Prefer a collection of context-specific tips over a single onboarding flow.** A contextual tip *"lets
  them concentrate on a single action or task before encountering new information."*
- **Postpone nonessential setup.** *"Provide reasonable default settings so most people can immediately
  start interacting."*
- **Request permission when the feature that needs it is used** — or integrate the request into
  onboarding *if the app cannot function without it*, so the rationale is visible.

### Feedback

Feedback communicates: current status; success or failure of an important action; a warning about
negative consequences; an opportunity to correct a mistake.

- **Match the delivery to the significance.** Status information can be passive; a warning about data
  loss must interrupt.
- **Integrate status feedback into the interface,** near the items it describes, so people get it
  *"without having to take action or leave their current context."*
- **Reserve alerts for critical, ideally actionable information.** *"Alerts can lose their impact if you
  use them too often."*
- **Confirm significant completions only.** *"Because people typically expect their action or task to
  succeed, they only need to know when it doesn't."*
- **Show when a command can't be carried out, and why.**
- **Make all feedback multi-channel** — colour, text, sound, haptics — so it reaches people who silence
  their device, look away, or use VoiceOver.

### Modality and sheets

- **Present modally only when there's a clear benefit.**
- **Keep modal tasks simple, short, streamlined.**
- **Avoid an app-within-an-app.** *"Presenting a hierarchy of views within a modal task can make people
  forget how to retrace their steps."*
- **Always give an obvious way to dismiss.**
- **Make it easy to identify the modal view's task** — a title naming the task.
- **Display only one sheet at a time.** *"If closing a sheet takes people back to another sheet, they can
  lose track of where they are."*
- **Always pair Done with Cancel or Back.** *"Relying solely on the Done button implies that completing
  the task is the only way to exit the sheet, which can feel restrictive or misleading."*
- **Never show Cancel, Done, and Back together.**

**Detents.** A resizable sheet rests at defined heights. The system defines *large* (full) and *medium*
(≈ half). *"Consider supporting the medium detent to allow progressive disclosure of the sheet's
content."* Don't support medium if the content is only useful at full height.

**Grabber.** *"A grabber shows people that they can drag the sheet to resize it; they can also tap it to
cycle through the detents."* It also works with VoiceOver — the accessible way to resize without sight.

**Support swipe-to-dismiss.** *"People expect to swipe vertically to dismiss a sheet instead of tapping a
dismiss button."*

### Searching

- **If search is important, give it a primary position.**
- **Make content searchable through a single location.** For apps with distinct sections a *local* search
  can still make sense — *"search acts as a filter on the current view."*
- **Clearly display the current scope.** Descriptive placeholder, scope bar, or title.
- **Provide suggestions** — recent searches before typing, predictive suggestions while typing.
- **Start search immediately as a person types.** *"Searching while someone types makes the search
  experience feel more responsive."*
- **Simplify and prioritise results**; consider categorising them.
- **Take privacy into account before displaying search history**, and provide a way to clear it.

**Placement on iOS:** as a tab; in a bottom toolbar; in a top toolbar; or inline with content.
*"Place search at the bottom if there's room… Search at the bottom is useful in any situation where
search is a priority, since it keeps the search experience easy to reach."* Place it at the top only when
covering bottom content would interfere with a primary function.

**Inline search** is right *"when its position alongside the content it searches strengthens that
relationship."*

### Settings

- **Provide defaults that give the best experience to the largest number of people.**
- **Minimise the number of settings.** *"Too many settings can make the experience feel less
  approachable, while also making it hard to find a particular setting."*
- **Avoid using settings to ask for information you can get another way.**
- **Respect systemwide settings; don't duplicate them.** A custom copy of a global option *"implies that
  systemwide settings may not apply to your app."*
- **General, infrequently-changed options belong in settings. Task-specific options belong in the task.**
  *"Putting this type of option in a separate settings area disconnects it from its context, requiring
  people to suspend their task to make adjustments, and often hiding the results until people resume."*

### Charting data

- **Not every dataset needs a chart.** *"If you simply need to provide data — and you don't need to
  convey information about it or help people analyze it — consider offering the data in other ways, such
  as in a list or table."*
- **Use a chart to highlight important information.** Charts are visually prominent; earn that prominence.
- **Keep charts simple; let people choose additional detail.**
- **Prefer common chart types.**
- **Add descriptive text.** Titles, subtitles, annotations, and a **headline summary**. The HIG's example
  is exactly the right model for transit: *"Weather displays text that summarizes the information people
  need right now — such as 'Chance of light rain in the next hour' — above the scrolling list of hourly
  forecasts."*
- **Maintain continuity across multiple charts of the same data** — same type, colours, annotations.

### Lists and tables

- **Prefer text in a list.** *"The row-based format is especially well suited to making text easy to scan
  and read."* Items varying widely in size, or many images, suggest a collection instead.
- **Keep item text succinct** to minimise truncation and wrapping.
- **Preserve readability of clipped text.** *"Sometimes, an ellipsis in the middle of text can make an
  item easier to distinguish because it preserves both the beginning and the end."*
- **Provide appropriate selection feedback.** Navigation lists persistently highlight the selected row;
  option lists highlight briefly then show a checkmark.
- **Use a disclosure indicator for drilling in, an info button only for more information about the row.**

### Buttons

- **Hit region of at least 44 × 44 pt.**
- **Always include a press state.** *"Without a press state, a button can feel unresponsive."*
- **One or two prominent buttons per view.** *"Presenting too many prominent buttons increases cognitive
  load."*
- **Distinguish the preferred choice by style, not size.** *"Placing two buttons of different sizes near
  each other can make the interface look confusing and inconsistent."*
- **Roles:** Normal, Primary (the default/most likely), Cancel, Destructive.
- **Never assign the primary role to a destructive action** — *"people sometimes choose a primary button
  without reading it first."*
- **Start text labels with a verb**, title-case.
- **Consider an in-button activity indicator** for actions that don't complete instantly, with a changed
  label ("Checkout" → "Checking out…").

### Labels

Four semantic levels — Label, Secondary, Tertiary (unavailable items), Quaternary (watermark).
**Make useful label text selectable** — *"an error message, a location, or an IP address."*

### Progress indicators

Covered under Loading above. Additionally: **display in a consistent location**; **let people halt
processing** where safe (Cancel, and Pause if cancelling loses work).

### Scroll views

- **Make it apparent when content is scrollable.** *"Displaying partial content at the edge of a view
  indicates that there's more content in that direction."*
- **Never nest same-axis scroll views.** Cross-axis nesting (horizontal inside vertical) is fine.
- **Scroll automatically only as much as necessary to help people retain context.**

### Entering data

- **Get information from the system whenever possible.** *"Don't ask people to enter information that you
  can gather automatically."*
- **Be clear about the data needed** — prompts, introductory labels, sensible prefilled defaults.
- **Offer choices instead of text entry where possible.** *"It's usually easier and more efficient to
  choose from lists of options than to type information."*
- **Validate dynamically**, with feedback as soon as a problem is detected.

### Gestures

Standard, expected everywhere: **Tap** (activate/select), **Swipe** (reveal actions, dismiss, scroll),
**Drag** (move), **Touch and hold** (reveal additional controls), **Double tap** (zoom), **Zoom**,
**Rotate**.

- **Respond to gestures consistently with expectations.** *"Avoid using a familiar gesture like tap or
  swipe to perform an action that's unique to your app."*
- **Handle gestures as responsively as possible**, with immediate feedback.
- **Indicate when a gesture isn't available**, or people will think the app is frozen.
- **Custom gestures must be discoverable, straightforward, distinct, and never the only way** to do
  something important.
- **Shortcut gestures supplement standard controls; they never replace them.** *"People expect to find a
  Back button in a top toolbar… To help accelerate this action, many apps also offer a shortcut gesture
  — while continuing to provide the Back button."*

---

## I.11 Maps — the most directly applicable technology page

- **Make the map interactive.** *"Noninteractive elements that obscure the map can interfere with
  people's expectations for how maps behave."*
- **Pick an emphasis style.** The **default** style is fully saturated and keeps visual alignment with
  the system Maps app. The **muted** style is desaturated and *"is great if you have a lot of
  information-rich content that you want to stand out against the map."*
- **Help people find places.** Search combined with **category filters**.
- **Clearly identify selected elements** with distinct styling — outline and colour variation.
- **Cluster overlapping points of interest.** *"As people zoom in on a map, clusters expand to
  progressively reveal individual points of interest."*
- **Annotations should match the visual style of the app.** Icon strings should be **two to three
  characters** for readability.
- **Overlay levels:** *above roads* (below buildings/labels — people can still read what's underneath) or
  *above labels* (hides everything beneath — for content that should be fully abstracted).
- **Ensure enough contrast between custom controls and the map.** *"Consider using a thin stroke or light
  drop shadow to help a custom control stand out, or applying blend modes to the map area to increase
  its contrast with the controls atop it."*
- **Adjust detail by zoom level.** *"Too much detail can cause a map to appear cluttered. Show large
  areas… at all zoom levels. Then, progressively add more detailed features and labels as the map is
  zoomed in."*
- **Use distinctive styling to differentiate features** — colour *with* icons.
- **Include surrounding areas for context**, dimmed and distinctly coloured if non-interactive.
- **Limit scrolling outside your venue.** *"This can help people avoid getting lost when they swipe too
  hard."*
- **Keep the selected location visible when showing a place card.** Offset the card so it points at the
  location rather than covering it.
- **Attribution:** keep provider logo and legal link visible with ~7 pt side and ~10 pt vertical padding,
  fixed relative to the map, placed above the **lowest resting position** of any pull-up card.

> Note the last one carefully. Apple's own rule is that attribution is positioned against the **lowest
> resting position of a draggable card** — exactly the sheet pattern Metrothi uses, and exactly the
> mistake it is easy to make with a CARTO/OSM attribution.

---

## I.12 Live Activities (the model for a live journey)

Not implementable as an iOS Live Activity in a web PWA, but the *design* guidance is the best available
specification for "a glanceable, continuously-updating summary of an in-progress trip" — which is
precisely Metrothi's live-journey sheet header and, later, its notification surface.

- **Offer them for tasks with a defined beginning and end**, ideally under eight hours.
- **Focus on important information people need at a glance.** *"Your Live Activity doesn't need to
  display everything."* Tapping opens the app for detail.
- **Avoid displaying sensitive information** — it's visible to casual observers.
- **Match the app's visual aesthetic and personality** in both light and dark.
- **Ensure text is easy to read.** *"Use large, heavier-weight text — a medium weight or higher. Use
  small text sparingly and make sure key information is legible at a glance."*
- **Dynamically change height as information changes.** *"A rideshare app might display a more compact
  Live Activity without additional details while it locates a driver. The app's height extends as more
  information is available."*
- **Use consistent, concentric margins.** Match inner corner radii to the outer radius minus the margin,
  *"to ensure a harmonious fit… This prevents elements from poking into the rounded shape and creating
  visual tension."*
- **Use bold colours for text and objects to convey personality** and make it recognisable at a glance.
- **Animate layout changes; preserve as much of the existing layout as possible.** *"Animate existing
  elements to their new positions rather than removing and animating them back in."*
- **When animating list items, only animate the element that moves**; fade the others.
- Maximum animation duration **two seconds**.

---

## I.13 Translation layer — what actually transfers to a web PWA

This section exists so nobody tries to implement the HIG literally and produces something worse.

| HIG concept | Verdict | What to do instead |
|---|---|---|
| **Liquid Glass material** | **Do not clone.** Proprietary, GPU-backed, and it takes its behaviour from system compositing we don't have. A CSS imitation reads as a cheap knock-off, costs real paint time on mid-range Android, and breaks on the map. | Take the **two-layer structure**, not the material. Use one honest, consistent floating-layer treatment: `backdrop-filter: blur()` + a semi-opaque token + a hairline border. Define it **once** as a token pair (`--surface-float`, `--border-float`), never per-component. |
| **SF Pro / SF Compact / New York** | **Not available.** Licensed for Apple platforms; not a web font we may serve. | Keep `var(--font-app)` (Space Grotesk) as the app face, per CLAUDE.md. Take the **type ladder** (§I.2), not the typeface. Space Grotesk is geometric and slightly wide — it needs *tighter* tracking than SF at display sizes and holds up worse below 12px, which sharpens the case for an 11px floor. |
| **SF Symbols** | **Not licensable** for a non-Apple-platform web app, and explicitly barred from logo/trademark use. | Keep `lucide-react` (already in use). Adopt the SF Symbols *discipline*: one stroke weight, one optical size family, weight matched to adjacent text, optical (not geometric) centring, filled variants only for selection/emphasis. |
| **Dynamic Type** | **No web equivalent** to the system text-size slider. But browser font-size settings, page zoom, and `prefers-reduced-motion`-style user preferences do exist. | Author **every** font size in `rem`, never `px`, so the browser's own base-size setting scales the app. Test at 200% zoom (the HIG's own vision target). Ship a **text-size preference** in YOU that scales the root — this is the *one* place duplicating a "system" setting is justified, because the web platform genuinely doesn't expose it. |
| **Base vs elevated dark backgrounds** | **Transfers.** | Add `--c-bg-elevated` used by sheets, popovers, and the search overlay in dark mode. Currently the sheet and the page share a background, which flattens the depth the sheet is trying to express. |
| **Semantic colour roles** | **Transfers completely.** Already the project's stated rule. | Extend the existing token set to a full four-level label ramp and a three-level background ramp. See Part II §7.2. |
| **Safe areas** | **Transfers.** | `env(safe-area-inset-*)` and `100dvh` (already used). Verify the sheet's lowest resting edge and the map attribution against the home indicator. |
| **Detents / grabber / swipe-to-dismiss** | **Transfers.** Already implemented in `DraggableSheet`. | Audit against §I.10: is the grabber tappable to cycle snaps? Is it exposed to assistive tech? |
| **Scroll edge effect** | **Transfers**, cheaply — a small gradient/blur strip. | Apply under the floating search pill and status strip where the sheet content scrolls beneath. One per view. |
| **Haptics** | **Partially.** `navigator.vibrate` exists on Android, is absent on iOS Safari. | Treat as progressive enhancement only. Never the sole feedback channel — which the HIG already requires. |
| **Live Activities / Dynamic Island** | **Not available.** | Apply the guidance to the live-journey sheet header and to Web Push notifications (already in PRD scope §3). |
| **Alerts / action sheets** | **Transfers as a pattern**, not as a component. | Build them; don't borrow the chrome. Honour "never Cancel + Done + Back together" and "one modal at a time". |
| **Right-to-left** | **Not currently needed** — en/hi/gu are all LTR. | Keep logical CSS properties (`margin-inline-start`, not `margin-left`) so it stays cheap if Urdu is ever added. Low priority; zero cost if done from the start. |

---
---

# PART II — The Metrothi redesign plan

## II.0 Method — data first, design last

The instruction for this redesign is explicit and correct: **the current design is not the starting
point.** The starting point is the data.

So the method is:

1. **Inventory** every data variable available on each surface — including variables the app currently
   computes and does not show.
2. **Classify** each variable by *what question it answers* and *when*. A fact that answers "should I run
   for this train?" is a different species from a fact that answers "can I bring my dog?".
3. **Rank** within each surface: exactly one primary question, one or two supporting, everything else
   available on demand.
4. **Derive form** from that ranking — hierarchy, then components, then style. Style is the *last* step
   and the least important.
5. **Only then** compare against the current design, and record what changes.

Step 5 is where the current design is allowed back into the room, and only as a diff.

### Two things that are *not* design legacy and must survive

The PRD and CLAUDE.md contain rules that look like design decisions but are product or engineering
truths. The redesign is bounded by them:

- **Never fake real-time.** GMRC publishes no live vehicle feed. Everything "live" is simulated from the
  static timetable and must be labelled as such. This is HIG principle 3 (Responsibility) — *"Be fully
  transparent about what your product does and why"* — and it is non-negotiable.
- **GMRC-sourced facts only; absence is not a negative.** A station with no listed `multiModal` means
  "GMRC lists no built interchange here", never "nothing nearby". The design must never render an
  absence as a "No" — that is inventing a fact.
- **No stand-in station photos.** A photo of the wrong station is worse than none in a wayfinding app.
- **Ride time is not `totalMins`.** Anything presented as the trip's own duration uses `rideMinsOf()`.
- **The app must stay fully usable with no account, no network, and no Supabase project.**
- **The boot path is protected.** Map-first means first paint is sacred; a redesign that adds weight to
  the entry chunk is a regression regardless of how it looks.
- **UI strings go through `t()`; GMRC's words and proper nouns do not.** A composed sentence assembled
  from fragments breaks in Hindi and Gujarati, which put the verb last.

---

## II.1 Complete data inventory

Everything the app has. **Bold** = currently rendered somewhere. *Italic* = computed or available but
**not currently surfaced** — the redesign's raw material.

### II.1.1 Station data — `StationRecord` (54 stations)

| Variable | Type | Answers |
|---|---|---|
| **`id`**, **`name`** | string | Identity |
| **`line`**, *`secondLine`* | string | Which line(s) serve this |
| **`order`**, *`secondLineOrder`* | number | Position along the line |
| **`phase`** | 1 \| 2 | Ticket validity, network era |
| **`terminal`** | bool | Trains originate/end here |
| **`interchange`** | bool | You can change lines here |
| **`operational`** | bool | Whether it's open yet |
| *`needsVerification`* | bool | Our own confidence in the coordinate |
| *`connectsTo`* | string | Named onward connection |
| *`notes`* | string | Free-text caveat |
| **`lat`**, **`lng`** | number \| null | Map position; null = not yet operational |

### II.1.2 Station facilities — `StationFacilities` (53 stations; GMRC-sourced)

| Variable | Answers |
|---|---|
| *`gmrcName`* | GMRC's own spelling where it differs from ours |
| **`structure`** | elevated \| underground — *"do I climb or descend?"* |
| **`gates`** | Which street-level entrances are open |
| **`lifts[{lift, gates[]}]`** | Which gate is step-free, and which lift serves it |
| **`multiModal.modes[]`** | BRTS / GSRTC / Indian Railways / High-speed rail |
| **`multiModal.connections[{gate, text}]`** | GMRC's verbatim wording for each transfer |
| *`multiModal.summary`* | GMRC's own one-line summary of the interchange |
| *`multiModal.amenities[]`*, *`plannedAmenities[]`* | Stated amenities (PDEU: parking) |
| *`multiModal.sourceNote`* | Provenance caveat for this row |

Derived: `accessibleGates()`, `stationModes()`, `stationsWithMode()`, `stationSearchKeywords()`.

### II.1.3 Timetable and service — `LineMeta`, `LineEstimate`, departures

| Variable | Answers |
|---|---|
| **`LINE_META[line].name`**, **`avgFrequencyMins`** | "How often, roughly?" |
| *`LINE_META[line].avgSegmentMins`* | Per-hop travel time |
| *`LINE_META[line].noTrainWindow`* | The violet line's bus-bridge window |
| **`LineEstimate.status`** | `running` \| `before-first-train` \| `after-last-train` \| `bus-only` |
| **`waitMins`** | "How long until the next one?" |
| *`currentFrequencyMins`* | The headway **right now** — peak vs off-peak |
| **`minsUntilFirst`**, *`resumesInMins`* | "When does service come back?" |
| **`DayTrain{clockTime, hour, waitMins, departed, isNext}`** | The full day's timetable |
| **`DayScheduleDirection{originId/Name, destinationId/Name, trains[], nextIndex}`** | Per-direction schedule |

### II.1.4 Journey plan — `PlanResult`

| Variable | Answers |
|---|---|
| **`source`/`dest`**, **`sourceStation`/`destStation`**, **`sourcePlace`/`destPlace`** | Endpoints, station or POI |
| **`sourceWalkMins`**, **`destWalkMins`** | Each walk leg separately (currently summed for display) |
| **`legs[LegDetail]`** | Per-leg: `line`, `ids`, **`headingId`/`headingName`** (platform signage!), `waitMins`, `travelMins`, *`currentFrequencyMins`*, `status`, *`bufferMins`* |
| **`stops[JourneyStop]`**, **`totalStops`** | The stop-by-stop path |
| **`travelMins`**, **`initialWaitMins`**, **`totalMins`** | Timing decomposition |
| **`feasible`**, **`strandedAtLine`** | "Is this trip possible today?" and where it breaks |
| **`fare`** | ₹, from real GMRC distance data — `null` rather than a guess |
| **`ticketInfo{tokenValid, cscValid, ncmcValid, note, where}`** | "Which ticket works, and where do I buy it?" |
| *`usesViolet`*, **`crossesPhase`** | Why the ticket rule bites |
| **`numTransfers`**, **`warnings[]`** | Complexity and caveats |
| **`options[JourneyOption]`** | Every departure today: `departClockTime`, `arriveClockTime`, `leaveClockTime`, **`leaveInMins`**, `departInMins`, `totalMins`, `feasible`, **`isTight`**, `departTimeMs` |
| **`recommendedOptionIdx`** | The departure you can comfortably make |
| **`queryTime`**, *`arriveBy`*, **`isLeaveNow`** | Query mode |
| Derived: **`rideMinsOf()`**, *`routeKm()`*, *`segmentKm()`* | Ride time; **route distance in km** |
| Derived: **`exitGuidanceFor(destId)`** → `{stepFreeGates[], connections[]}` | Last-mile guidance |

### II.1.5 Live journey — session + `liveStatus`

| Variable | Answers |
|---|---|
| **`currentState`** | 8 states: `WALKING_TO_STATION`, `WAITING_FOR_TRAIN`, `ON_TRAIN`, `APPROACHING_TRANSFER`, `TRANSFERRING`, `APPROACHING_DESTINATION`, `FINAL_WALK`, `COMPLETED` |
| **`currentStopIndex`**, **`stops`** | Where you are on the path |
| **`activeCoords`** | Live GPS fix |
| *`elapsedMins`*, *`startedAt`* | How long you've been travelling |
| *`stopTimeline[]`* | Predicted arrival offset for **every** stop — currently used internally only |
| **`initialWalkMins`** | The first walk |
| **`liveStatus{icon, tone, instruction{key,values}, countdown}`** | 11 state branches, each a bundle key + proper nouns |

### II.1.6 Live map — `ActiveTrain`

| Variable | Answers |
|---|---|
| **`line`**, **`direction`** | Which train, heading where |
| *`originId`/`destId`* | Its full run |
| **`fromStationName`**/**`toStationName`** | Between which two stations |
| **`lat`**/**`lng`**, **`segmentProgress`** | Interpolated position, 0–1 through the segment |

### II.1.7 Reference content — `metroInfo` + `passengerInfo`

`metroInfo`: `fareMedia`, `fareProducts`, `purchase`, `ticketValidity`, `timeInPaidArea`, `concessions`,
`discounts`, `refunds`, `phaseRestriction`, `ticketConditions`, `penalties`, `luggage`, `cards`,
*`unverified`*.

`passengerInfo`: `dosAndDonts` (9 + 14), `prohibitedItems` (with exceptions, under the Metro Rail O&M Act
2002), `facilities` (10 general + 8 accessibility), `emergencyFacilities` (11, grouped by *location*:
platform / station / train / both), `contact.customerCare`, `lostAndFound`, `officialApp`,
`officialLinks` (12), `social` (5).

Catalog: 8 topics → `/you/:topic`, rendered from a block model (`list`, `keyValue`, `prose`, `actions`,
`sourceLink`).

### II.1.8 User data and preferences

Saved stations; saved journeys; recent trips (capped 5); `walkSpeedKmh` (presets + custom);
`defaultDepartureStationId` (or GPS); `language` (en/hi/gu); `analytics` (on/off); theme (light/dark);
auth state; sync state (outbox depth, last cursor, online/offline).

### II.1.9 Provenance — the honesty layer

Every scraped dataset carries `_meta` with source URL, `lastVerified`/`scrapedOn`, and a `rule` string.
Surfaced by `features/info/provenance.ts`.

Also: *`stations._meta.knownDataIssues`* — three named, specific caveats (Vastral's coordinate, Mahatma
Mandir's landmark pin, Sabarmati Railway Station not yet operational). **Currently invisible to riders.**

---

## II.2 Classification — four species of information

Every variable above falls into exactly one of these, and the species determines the treatment.
This is the core of the redesign.

### Species A — **Decision-now**
*Answers a question the rider is asking in the next 60 seconds, standing up, possibly moving.*

Examples: leave-in countdown; next departure and its direction; which platform/heading; is this trip
possible; which ticket; step-free exit at the destination; is the line running.

**Treatment:** Largest type in the view. Highest contrast. Never behind a tap. Never truncated.
Legible at arm's length in sunlight. One per view — at most.

### Species B — **Orientation**
*Answers "where am I / what is this / how does this fit together?"*

Examples: station name and line; stops and transfers; route on the map; position along the line; the full
day's schedule; elevated vs underground.

**Treatment:** Supporting scale (Callout/Subhead). Present without being asked, but visually subordinate.
Can wrap; can scroll.

### Species C — **Reference**
*Answers a question asked rarely, at leisure, usually seated.*

Examples: fare rules; prohibited items; do's and don'ts; lost and found; accessibility facilities
network-wide; official links.

**Treatment:** Behind navigation. Optimised for **reading**, not glancing — long measure, generous
leading, real prose typography. This is the one place in the app where a comfortable reading column
matters more than density.

### Species D — **Provenance & confidence**
*Answers "how much should I trust this?"*

Examples: "simulated from the timetable, not a live feed"; `scrapedOn` dates; `knownDataIssues`;
`needsVerification`; `unverified`.

**Treatment:** Quiet but **never hidden**, and never merely in a settings page. Per HIG principle 3 and
the PRD's principle 1, honesty is a *feature*. The redesign's position: provenance should be reachable
from the fact it qualifies, not only from an About page.

### The classification, applied

| Surface | Species A (one only) | Species B | Species C | Species D |
|---|---|---|---|---|
| Home / station sheet | Next departure + countdown, per direction | Station name, line, walk distance/time, interchange, modes, full schedule, map | — | "Simulated" marker on the live indicator |
| Plan results | **Leave in N** | depart→arrive, ride time, fare, stops, transfers, route timeline, all trains | Ticket rules (link out) | Fare source; feasibility basis |
| Live journey | Current instruction + countdown | Progress along stops, next station, elapsed | — | — |
| Station page | Next train each way | Structure, gates, lifts, connections, position on line, first/last train | — | GMRC source + date; known issues |
| Directory | — (browsing, not deciding) | Name, line, phase, interchange, modes | — | — |
| YOU | — | Account, sync, prefs | All reference topics | All `_meta` dates |

---

## II.3 Redesign by surface, derived from the data

### II.3.1 HOME — the map and the station sheet

**Primary question:** *"When is my next train, and which one do I want?"*

Everything else on this screen is orientation. The current design answers this correctly but **buries the
answer under the station's identity** — the name, photo, eyebrow and five chips come first, and the
departures are below them.

**Derived hierarchy:**

1. **A** — Next departure, per direction. Countdown as the hero figure, clock time beneath, direction
   named by `headingName` (which is what's actually printed on the platform).
2. **B** — Station identity (name, line, interchange, structure), walk distance and time, modes.
3. **B** — The full day's merged schedule, below the fold.
4. **D** — "Simulated from the timetable" attached to the live indicator, not only in settings.

**Concrete changes this implies:**

- **Invert the sheet header.** The collapsed peek should lead with the *departure*, not the station name.
  The station name becomes the eyebrow; the countdown becomes the headline. A rider who opens the app on
  a platform gets their answer in the peek without a drag. This is HIG Layout — *"place the most
  important items near the top"* — applied to the actual question.
- **Reduce the chip row.** Five to seven chips of equal weight is a flat list, not a hierarchy. Line
  status is Species A when degraded and Species B when normal — so a *running* line should not spend a
  chip at all in the peek; it should appear on expansion. Distance/walk-time merge into one chip
  ("450 m · 6 min walk"). Interchange and mode chips are Species B → below the fold.
- **`structure` (elevated/underground) is currently only on the station page.** It belongs in the sheet:
  knowing whether to look up or down is a wayfinding fact you want *before* you arrive.
- **Surface `currentFrequencyMins`.** "Every 8 min" during peak vs "Every 20 min" off-peak is materially
  different information, and the app computes it but shows only `avgFrequencyMins`. Per HIG Charting,
  the *headline summary* is the highest-value form: **"Trains every 8 min right now."**
- **Map:** adopt the **muted** emphasis style (§I.11) — the app overlays four coloured lines, station
  markers, live train markers, and a route path onto CARTO tiles. That is exactly the
  "information-rich content that you want to stand out against the map" case. Currently the basemap
  competes with the network.
- **Attribution:** verify CARTO/OSM attribution sits above the sheet's *lowest resting position* per
  §I.11, and is not covered at the collapsed peek.
- **Live train markers:** `segmentProgress` and `direction` are already computed. A direction arrowhead
  exists; consider whether the marker should also encode *crowding-free* facts it has — origin and
  destination terminal — on tap, as a place-card-style callout (§I.11) rather than nothing.

### II.3.2 PLAN — the journey result

**Primary question:** *"When do I leave, and can I actually do this?"*

The current design already identifies this correctly (the "Leave in N" hero is right, and the reasoning
recorded in the PRD is sound). The redesign's job here is **subtraction and clarification**, not
restructuring.

**Derived hierarchy:**

1. **A** — `leaveInMins` as the hero. Or, when `!feasible`, the *reason* replaces it entirely.
2. **A** — `ticketInfo` when it constrains (`crossesPhase` / `usesViolet`); silent otherwise.
3. **B** — depart → arrive span, `rideMinsOf()`, `fare`, stops, transfers.
4. **B** — the departure picker; the route timeline; all trains.
5. **A, at the end** — `exitGuidanceFor(destStation)`: step-free gates and onward connection.

**Concrete changes this implies:**

- **Surface route distance.** `routeKm()` exists and is what the fare is *actually charged on*. Showing
  "12.4 km · ₹25" makes the fare legible rather than magic, and pre-empts "why does this cost more than
  that trip with more stops?". This is HIG Feedback — *"Show people when a command can't be carried out
  and help them understand why"* — generalised to *explain the number*.
- **Split the walk disclosure.** `sourceWalkMins` and `destWalkMins` are separate values currently summed
  into "Includes N walking". They answer different questions ("when do I leave here" vs "how much further
  after I get off"). The timeline already names each; the summary should at minimum not imply they're
  interchangeable.
- **`bufferMins` per leg is computed and never shown.** For a transfer, buffer *is* the anxiety: "you have
  4 minutes to change at Old High Court" is Species A. A tight transfer deserves the same amber treatment
  `isTight` gets on the departure.
- **Infeasible states deserve more than a card.** `strandedAtLine` names exactly where the trip breaks.
  Per HIG Writing — *"be clear about what someone can do to fix it"* — the infeasible state should
  propose the fix it can compute: the last feasible departure today, or the first tomorrow. The engine
  has `options[]`; the answer is already in memory.
- **Ticket guidance** stays a quiet aside (correct), but the "where to get one" line should follow the
  HIG's rule for settings links: *"provide a direct link or button, rather than trying to describe its
  location."* It currently describes.

### II.3.3 LIVE — the journey in progress

**Primary question:** *"What do I do right now?"*

This is the surface where §I.12 (Live Activities) is the specification, and where the HIG's guidance is
most demanding: large, heavy text; one fact; height that changes with content.

**Derived hierarchy:**

1. **A** — the current instruction (one line, from `liveStatus.instruction`) + its countdown.
2. **B** — progress: which stop of how many, next station name.
3. **B** — elapsed time, remaining stops.

**Concrete changes this implies:**

- **The collapsed peek is the whole design.** A rider in a moving train looks at this for two seconds.
  Per §I.12, it should be *large, medium-weight-or-heavier, and legible at a glance*, and its height
  should **change with the state** rather than being a fixed floor. The current `LIVE_COLLAPSED_H = 80`
  is a fixed floor chosen to always be under the shortest state — the HIG's advice is the opposite:
  size to the content and animate the change.
- **`stopTimeline[]` is computed and unused.** It holds a predicted arrival offset for *every* remaining
  stop. That is the data for a genuine progress rail — a vertical timeline where each upcoming stop
  carries its own ETA, and the current position slides between them. This is the single largest piece of
  unused signal in the app.
- **`elapsedMins` is unused.** Minor, but "18 min in, 11 to go" is a better answer than either half alone.
- **Tone is already modelled** (`normal` / `alert` / `good`) and maps cleanly onto a semantic colour role.
  Ensure it is never the *only* channel (HIG Colour: never rely on colour alone) — the `icon` field
  already provides the second channel; verify both are always rendered together.
- **Never auto-dismiss.** HIG Accessibility (Cognitive): *"Minimise use of time-boxed interface
  elements… Prefer dismissing views with an explicit action."* The `COMPLETED` state must wait for the
  rider.

### II.3.4 STATION page — reference about a place

**Primary question:** *"What is this station like, and when do trains leave it?"*

Two distinct questions, which is why the current tab split (Schedule / Info) is structurally right.

**Concrete changes:**

- **`gmrcName` is unused.** Where GMRC's spelling differs from ours, showing it prevents a rider from
  doubting they're at the right place when the signage disagrees. Species D, quietly placed.
- **`multiModal.summary`, `amenities`, `plannedAmenities`, `sourceNote` are unused.** All four are
  GMRC-stated and belong in the Connections block. `plannedAmenities` in particular needs a clear
  *future tense* treatment so it is never read as available now.
- **`knownDataIssues` is unused.** Three stations have named, specific caveats — including one whose
  coordinate is known to be wrong and one that is not yet operational. A wayfinding app that knows its
  pin is unreliable and doesn't say so fails principle 3. This should appear on the affected station,
  not only in a JSON comment.
- **`operational === false`** already renders as "Opening soon" — good. Pair it with `lat === null`
  handling so the map doesn't silently drop the station.
- **First/last train** is present. Add the **service window as a span** ("05:45 – 22:20") as a headline
  summary above the per-direction detail, per HIG Charting.
- **Reading measure:** the Info tab is Species C. It should adopt the reference typography (§II.7.1),
  not the dense UI typography.

### II.3.5 SEARCH and the directory

**Primary question:** *"Get me to the thing I'm thinking of."*

Per §I.10 (Searching), the gaps against HIG are specific and cheap:

- **No recent searches, no suggestions before typing.** The app *has* recent trips (capped 5) and saved
  stations. An empty search field should offer them. *"Provide suggestions to make searching easier."*
- **Scope is not displayed.** The overlay searches stations *and* places *and* mode keywords. The
  placeholder says "Search stations and landmarks" — but results don't indicate which kind each result
  is, beyond the row's own shape. Per HIG, categorise results.
- **The connection facet is single-select and correct** — that reasoning in the PRD is sound and should
  survive. But per HIG it should be a **scope bar**, visually distinct from content, not chips that read
  like the mode chips on a station row.
- **Empty state.** HIG Writing: *"An empty screen can be daunting if it isn't obvious what to do next…
  guide people on actions they can take, and give them a button or link to do so."* A no-results state
  should offer the nearest station or the line browser, not just say nothing matched.

### II.3.6 YOU — settings and reference

Per §I.10 (Settings), the rules that bite:

- **"Minimise the number of settings."** Audit each of walk speed, default departure, language,
  analytics, theme against "would most people ever change this?" Walk speed and default departure are
  genuinely useful to a daily commuter and genuinely noise to everyone else — consider surfacing them
  *contextually* (walk speed from a plan that has walk legs; default departure from the station sheet)
  rather than only in settings. That is the HIG's own "task-specific options belong in the task" rule.
- **"Respect systemwide settings; don't duplicate them."** Theme must default to `prefers-color-scheme`
  and offer System / Light / Dark — not a bare two-way toggle that ignores the OS.
- **Text size is the justified exception** (§I.13) — the web genuinely doesn't expose a system control
  the way iOS does.
- **Reference pages are Species C.** They currently render through the shared block model, which is
  right. They need reading typography, not UI typography.
- **Provenance rows exist** — extend them so every dataset's date is visible, and link each fact's
  provenance from where the fact appears.

---

## II.4 What the data says that the design currently doesn't

Consolidated list of **computed-but-unsurfaced** signal, ranked by rider value:

| Rank | Data | Why it matters | Surface |
|---|---|---|---|
| 1 | `stopTimeline[]` | Per-stop ETA for the whole remaining trip | Live journey |
| 2 | `currentFrequencyMins` | Actual headway now, vs the daily average | Home sheet, station page |
| 3 | `bufferMins` per leg | How tight each transfer is | Plan results |
| 4 | `routeKm()` | Makes the fare explicable | Plan results |
| 5 | `stations._meta.knownDataIssues` | Three stations with known-unreliable data | Station page |
| 6 | `multiModal.summary` / `amenities` / `plannedAmenities` | GMRC-stated facts about interchanges | Station page |
| 7 | `elapsedMins`, `startedAt` | Trip progress in both directions | Live journey |
| 8 | `structure` (elevated/underground) | Wayfinding before arrival | Home sheet |
| 9 | `gmrcName` | Resolves signage mismatch | Station page |
| 10 | `LINE_META.noTrainWindow` | The violet bus-bridge, explained rather than just flagged | Line status |
| 11 | `sourceWalkMins` / `destWalkMins` split | Two different decisions | Plan results |
| 12 | `arriveBy` | Query mode is invisible in the result | Plan results |

**Nothing on this list requires new data.** All twelve are already in memory.

---

## II.5 What the current design does that the data doesn't justify

Recorded as a diff, per the method's step 5. These are hypotheses to test, not verdicts.

- **The station photo in the sheet header.** Currently one station has a photo. A 40 px circular image
  that appears on 1 of 54 stations creates a layout that shifts unpredictably and carries — by the
  project's own admission — no information (`alt=""`). The "no stand-in photos" rule is right; the
  question this raises is whether the *slot* earns its place at all until coverage is meaningful.
- **Five-to-seven equal-weight chips.** A flat row of chips is the absence of a hierarchy decision.
  Species A/B classification (§II.2) should split them.
- **`10px` uppercase eyebrow text.** Below the HIG's 11 pt floor, and uppercase tracking at that size is
  the hardest thing to read on a moving train. It is also the label most likely to be redundant with the
  headline beneath it.
- **36 px (`w-9 h-9`) icon buttons** in the sheet header (save, walking directions, close). Below the
  44 × 44 minimum. On a bookmark toggle this is a mis-tap that silently changes saved state.
- **Hardcoded `#f0997b` and `rgba(216,90,48,0.35)`** in `HomeScreen.tsx` (the alert-toned `Chip`). This
  violates both the HIG's dark/light adaptivity rule and the project's own stated rule that colours come
  from CSS custom properties. It needs a semantic token (`--c-warn`, `--c-warn-border`) — otherwise the
  alert chip does not adapt with the theme. *(Also worth an entry in `DISCREPANCIES.md`.)*
- **Three separate elevation treatments** for floating chrome: the FAB uses
  `boxShadow: 0 6px 24px rgba(0,0,0,0.35)`; the recentre button uses `--c-blur` + `blur(18px)` +
  `--c-border-2` + a different shadow; the sheet uses its own. Per §I.4 the floating layer should have
  **one** material treatment defined once.
- **No scroll edge effect** where sheet content scrolls beneath the floating search pill and status
  strip. §I.10 (Scroll views) — this is exactly what the effect exists for.
- **Theme is a two-way toggle** with no System option (per CLAUDE.md, light is the default). §I.10
  (Settings) and §I.3 (Dark Mode) both say the system preference must be respected.

---

## II.6 Adaptations where the HIG is wrong for this audience

Places where following the HIG literally would make Metrothi worse. These are deliberate deviations,
recorded so they read as decisions rather than oversights.

1. **"Avoid full-width buttons."** The HIG's reasoning is about fitting the iOS visual language. Metrothi's
   primary action (**Start Journey**) is pressed one-handed, often while walking, often in motion. A
   full-width target inside the sheet's margins is the correct accessibility trade. **Deviate.**
2. **Contrast target.** The HIG's floor is 4.5:1 and it *suggests* 7:1 for custom colours. For an app used
   on an open platform in Ahmedabad daylight, **7:1 should be the target for all Species A text**, not an
   aspiration. **Exceed.**
3. **Type floor.** HIG minimum is 11 pt. For Species A on this app, the floor should be **higher** —
   nothing that answers "should I run?" should be under 17 px. **Exceed.**
4. **Colour semantics.** The HIG's implicit red = danger / green = go mapping is Western. Three of the four
   line colours are fixed by real-world GMRC signage and cannot move (CLAUDE.md). Semantic status colours
   must therefore be chosen to *not collide* with the line palette — a constraint the HIG never faces.
   **Adapt.**
5. **"Test on actual devices."** The HIG means iPhone. Metrothi's median device is a mid-range Android at
   360–412 CSS px. Every measurement in this document should be verified at **360 px**, not 393.
   **Reinterpret.**
6. **Reduce Motion.** The HIG says replace x/y/z transitions with fades. Metrothi's sheet is
   *gesture-tracked* — the drag must continue to track the finger even under Reduce Motion (the HIG
   itself lists "tracking animations directly with people's gestures" as a *reduced-motion* technique).
   The springs shorten; the tracking stays. **Apply carefully, not literally.**
7. **Multi-script typography.** The HIG has no guidance for a UI that must set Latin, Devanagari and
   Gujarati in one interface. Devanagari and Gujarati have taller ascenders and descenders and need
   **more leading at the same optical size** than Latin. The type ladder's line heights (§I.2) are tuned
   for SF and will feel cramped in `hi`/`gu`. **Extend:** define per-script leading multipliers keyed off
   `[lang]`, the same mechanism CLAUDE.md already uses for the font stack.

---

## II.7 The design system that falls out of this

Only reached at step 4 of the method. Everything here is *derived* from §II.2–§II.6.

### II.7.1 Type

Two ladders, because the app has two reading modes.

**UI ladder** (Species A/B) — derived from §I.2, floored per §II.6.3, authored in `rem`:

| Token | px | Line | Weight | Used for |
|---|---|---|---|---|
| `--t-hero` | 40 | 44 | 700 | The one countdown per view |
| `--t-title-1` | 28 | 34 | 700 | Station name (page), plan endpoints |
| `--t-title-2` | 22 | 28 | 700 | Station name (sheet), section headings |
| `--t-title-3` | 20 | 25 | 600 | Departure clock times |
| `--t-headline` | 17 | 22 | 600 | Row titles, primary labels |
| `--t-body` | 17 | 22 | 400 | Body copy |
| `--t-callout` | 16 | 21 | 400 | Secondary rows |
| `--t-subhead` | 15 | 20 | 400 | Chip text, metadata |
| `--t-footnote` | 13 | 18 | 400 | Captions, provenance |
| `--t-caption` | 12 | 16 | 500 | Smallest permitted; eyebrows |

**Nothing below 12 px.** The current 10 px eyebrow is retired (§II.5).

**Reference ladder** (Species C) — for `/you/:topic` and the station Info tab: body at 17 px / 28 line
height, measure capped at ~68 characters, paragraph spacing at 1em. Reading, not scanning.

**Per-script leading** (§II.6.7): `hi` and `gu` take a line-height multiplier of ~1.15 on the UI ladder.

### II.7.2 Colour

Extend the existing custom-property set to a full semantic ramp. Every value gets a light variant, a dark
variant, and — new — a high-contrast variant behind `prefers-contrast: more`.

**Backgrounds:** `--c-bg` (base) · `--c-bg-2` (grouped) · `--c-bg-elevated` (sheets, overlays, popovers —
new, per §I.3) · `--c-card` · `--c-card-alt`

**Labels (four levels, per §I.3):** `--c-text` · `--c-text-2` · `--c-text-3` · `--c-text-4`

**Status (new, must not collide with `LINE_COLORS` — §II.6.4):**
`--c-warn` / `--c-warn-bg` / `--c-warn-border` (tight connections, degraded service) ·
`--c-error` / `--c-error-bg` (infeasible) · `--c-good` / `--c-good-bg` (arrived, on time)

**Floating layer (one treatment, per §I.4 / §I.13):**
`--surface-float` · `--border-float` · `--shadow-float` · `--blur-float`

**Fixed:** the four `LINE_COLORS` stay constant across themes — they map to physical signage.

**Rule:** no component may declare a colour literal. The `#f0997b` in `HomeScreen.tsx` is the current
violation.

### II.7.3 Materials and elevation

Exactly **three** elevations, defined once:

1. **Content** — flat on `--c-bg`. No shadow.
2. **Grouped content** — `--c-card` on `--c-bg`. Hairline border, no shadow.
3. **Floating** — `--surface-float` + `--blur-float` + `--border-float` + `--shadow-float`. Used by: the
   search pill, the line-status strip, the FAB, the recentre button, and the sheet. **One definition,
   five consumers.** Over the map (bright, arbitrary content) it takes the dimming treatment from §I.4.

Plus a **scroll edge effect** token for the strip where content passes under floating chrome.

### II.7.4 Spacing and targets

- Base unit **4 px**. Layout rhythm on 8.
- **Minimum touch target 44 × 44 px**, no exceptions. Where the visual element is smaller, the hit area is
  padded to 44.
- **12 px minimum between adjacent interactive elements**; 24 px around unbezeled ones (§I.8).
- Sheet content inset **20 px** at 360 px width.

### II.7.5 Motion

- One spring, already centralised in `components/sheetMotion.ts` (`SPRING`) — keep that discipline and
  extend it: **one spring for sheets, one ease for entrances, one duration for state changes.** No
  per-component curves.
- Framer Motion only — Tailwind's `animate-in` utilities generate no CSS in this project (CLAUDE.md).
- Entrances: opacity + small y offset. **Never a lateral offset on a page root** — `<main>`'s
  `overflow-y: auto` makes `overflow-x` compute to `auto`, so a 16 px lateral offset becomes real
  horizontal scroll (CLAUDE.md).
- Maximum duration for a content update: **2 s** (§I.12). Typical: 200–320 ms.
- `prefers-reduced-motion`: shorten springs, drop y offsets to fades, **keep gesture tracking** (§II.6.6).

### II.7.6 Iconography

`lucide-react`, one stroke weight (2.2 at the sizes used), weight matched to adjacent text, optically
centred, always paired with a text label or an `aria-label`. Filled variants reserved for selection.
Icons scale with the text-size preference (§I.2: *"Increase the size of meaningful interface icons as
font size increases"*).

### II.7.7 Voice

Derived from §I.9, and from the product's own stance on honesty.

- **Voice:** plain, factual, unhurried. The app is a colleague who knows the network, not a brand.
- **Never "we".** *"Unable to load"*, not *"We're having trouble loading."*
- **"You" and "your"** for the rider.
- **Verbs on buttons.** Title case for buttons and alerts; sentence case for body and descriptions. Pick
  once, hold everywhere.
- **No interjections, no humour, no exclamation marks.** They don't localise and they don't help.
- **Never state an absence as a negative.** "GMRC lists no interchange here" ≠ "No connections."
- **Say when a figure is simulated**, every time it could be mistaken for live.
- **Errors name the fix.** "Last Blue Line train has gone. First train tomorrow is 05:45." — not "Route
  not possible."
- **A line with optional parts gets one whole key per shape** (CLAUDE.md) — never a base sentence with
  fragments appended.

---

## II.8 Phased plan

Sequenced so that each phase is independently shippable and the earlier phases de-risk the later ones.

### Phase 0 — Foundations (no visible change)
Token layer only. Full semantic colour ramp with light/dark/high-contrast variants; two type ladders in
`rem`; the three-elevation material definition; spacing scale; motion tokens. Retire every colour
literal. **Exit criterion:** the app looks identical and no component declares a raw colour or px font
size.

### Phase 1 — Accessibility floor
Touch targets to 44 px. Type floor to 12 px, Species A to 17 px minimum. Contrast audit against 4.5:1
(7:1 for Species A). Theme gains a System option. Text-size preference in YOU. `prefers-reduced-motion`
and `prefers-contrast` honoured. **Exit criterion:** passes at 200% zoom and at 360 px width.

### Phase 2 — Home sheet re-hierarchy
Invert the header (departure first, station as eyebrow). Chip row split by species. `structure` and
`currentFrequencyMins` surfaced. Muted map style. Scroll edge effect. Attribution position verified
against the sheet's lowest rest. **Exit criterion:** the primary question is answered in the collapsed
peek without a drag.

### Phase 3 — Plan results
`routeKm` surfaced beside fare. `bufferMins` on transfers. Split walk disclosure. Infeasible states
propose the computable fix. Ticket "where" becomes a link. **Exit criterion:** no number on the screen
is unexplained.

### Phase 4 — Live journey
`stopTimeline[]` becomes a progress rail. Content-sized peek height with animated transitions. `elapsed`
+ remaining. Verify tone is never the sole channel. **Exit criterion:** meets §I.12's legibility bar at
arm's length.

### Phase 5 — Station page and reference
`gmrcName`, `multiModal.summary`/`amenities`/`plannedAmenities`, `knownDataIssues` surfaced. Service
window as a headline span. Reference typography for Species C. Provenance linked from the facts it
qualifies. **Exit criterion:** every GMRC-stated fact in the data is reachable in the UI.

### Phase 6 — Search
Recents and suggestions before typing. Categorised results. Facet as a scope bar. Useful empty state.

### Phase 7 — Multi-script polish
Per-script leading. Verify the ladder in `hi` and `gu` at every size. Confirm Space Grotesk stays first in
the stack and only non-Latin glyphs fall through to Noto (CLAUDE.md).

---

## II.9 Acceptance criteria

A redesigned surface is done when:

1. **One Species A fact** is identifiable in under two seconds at arm's length, at 360 px, in daylight.
2. **Every rendered number is explicable** — either self-evident or accompanied by its basis.
3. **No colour literal** appears in a component.
4. **Every interactive element is ≥ 44 × 44 px** with ≥ 12 px separation.
5. **Species A text meets 7:1**; everything else meets 4.5:1, in both themes and under Increase Contrast.
6. **Nothing below 12 px**; nothing that answers "should I run?" below 17 px.
7. **The layout survives 200% text** without truncating a Species A fact.
8. **No absence is rendered as a negative.**
9. **Every simulated figure is labelled as simulated** where it could be mistaken for live.
10. **The surface works** with no account, no network, and no Supabase project configured.
11. **`prefers-reduced-motion` and `prefers-contrast`** are honoured.
12. **The boot-path budget is not regressed** — measured by summing every JS file `index.html` loads, not
    the `index-*.js` line (CLAUDE.md).
13. **It reads correctly in all three languages**, with no sentence assembled from fragments.

---

## II.10 Open questions for the product owner

These change the work materially and are not mine to decide:

1. **Station photography.** Is coverage going to be completed? If yes, the photo slot is worth designing
   around properly. If no, it should probably go — one photo across 54 stations is a layout liability
   with no informational return.
2. **Is "confidence" the right emotional target?** §I.1.8 requires naming one. I've assumed confidence.
   Reassurance, speed, and calm are all defensible alternatives and would pull the palette and motion in
   different directions.
3. **Text-size preference:** ship it, or rely on browser zoom? Shipping it is more work and duplicates
   something the platform half-provides; not shipping it leaves the HIG's 200% target to browser zoom
   alone, which reflows differently.
4. **How prominent should provenance be?** My position is "reachable from the fact, not just from
   About". The counter-position — that constant sourcing notes undermine confidence — is reasonable and
   I'd want the product call before designing it in.
5. **`knownDataIssues` on the station page.** Telling a rider "we think this pin may be wrong" is
   maximally honest and mildly alarming. Worth a decision rather than a default.

---

## Appendix A — Source manifest

176 HIG pages retrieved 2026-08-02 from `developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`.

**Read in full for this document:** design-principles · getting-started · foundations · patterns ·
designing-for-ios · layout · typography · color · dark-mode · materials · accessibility · inclusion ·
writing · branding · icons · sf-symbols · motion · privacy · right-to-left · loading · feedback ·
launching · onboarding · searching · settings · modality · charting-data · offering-help · entering-data ·
gestures · sheets · lists-and-tables · labels · content · scroll-views · search-fields ·
progress-indicators · buttons · maps · live-activities.

**Retrieved and available, not central to a mobile transit PWA:** the visionOS, tvOS, watchOS, macOS,
games, and Apple-service-integration pages (HomeKit, Wallet, Apple Pay, CarPlay, ResearchKit, etc.).

**Change log referenced:** Design principles reintroduced 2026-06-08. Liquid Glass guidance added
2025-06-09. Typography emphasized weights added 2025-12-16.

## Appendix B — Apple Design Resources: what to take, what to avoid

`https://developer.apple.com/design/resources/` — reviewed 2026-08-02. Nine sections; two are useful
here. It changes no conclusion in this document, but it is a better source of *precision* for §II.7 than
the prose tables in Part I, which were derived from the HIG's written guidance rather than measured.

### Take

**Correction (2026-08-02): these are not downloadable files.** An earlier draft of this appendix called
them downloads. They are not. The Figma entries are **Figma Community files** — you open them and
*Duplicate* into your own account; there is no `.fig` to fetch, and the URLs return `403` to any
non-browser client. The Sketch entries are **Sketch Cloud documents** — publicly viewable in a browser
without login, but the "Download Assets (ZIP 7 MB)" and "Export Design Tokens" buttons need a real user
gesture and an account. Plan for a duplicate-and-inspect workflow, not a download.

- **iOS & iPadOS 27 UI Kit** (Figma Community → duplicate). The specs in §I.2, §I.8 and §II.7.4 exist here
  as measurable objects rather than tables transcribed from prose — component dimensions, safe-area
  guides, spacing, and the Dynamic Type ladder as artboards. If any part of this redesign is drawn in
  Figma, measure against the kit, not against Part I.
- **Live Activities Template** (Figma Community → duplicate). §I.12 is the specification for the
  live-journey sheet (§II.3.3), and its rules on concentric margins and content-sized height are difficult
  to apply from words. The template carries the actual radius-to-margin relationships.

### Reading the kits programmatically

The Figma MCP server available to this project is the **Dev Mode MCP Server**. It does **not** read
`figma.com` URLs — it is a bridge to the **Figma desktop app running on this machine**, and a URL only
tells it which node to look at. Pasting more links achieves nothing on its own. Prerequisites, all four:

1. Figma **desktop** app installed and up to date (the browser app will not do).
2. The duplicated file open in it.
3. Figma menu → Preferences → **Enable Dev Mode MCP Server**.
4. Restart the Claude desktop app.

**Likely next blocker to check:** Dev Mode is generally a paid-seat feature. A Community file duplicated
into a free Starter account may not expose it, in which case the `m=dev` URLs open but the MCP server
still returns nothing. Confirm seat level before investing time in this path.

Once connected, `get_variable_defs` is the highest-value call for this document — it returns the kit's
colour, type and spacing variables as name/value pairs, which is exactly the form §II.7 needs. `get_metadata`
gives structure to target further calls.

### Avoid — these are the two most tempting downloads and neither can ship

- **SF Pro / SF Compact / SF Mono / New York.** Apple's font licence restricts these to designing and
  mocking up software **for Apple platforms**; it does not extend to embedding them as a webfont in a PWA
  served to Android. Read the licence bundled with the download before relying on this summary. Separately,
  `CLAUDE.md` fixes `var(--font-app)` to Space Grotesk, which is geometric and wider than SF — **a mockup
  set in SF will not hold its spacing when built.** If the kit is used for measurement, substitute the
  real app face before judging any layout.
- **SF Symbols 7 / 8.** Same licensing conclusion as §I.13, plus a hard blocker: the app **requires
  macOS Sonoma or later** and cannot run on this project's Windows development machine. `lucide-react`
  remains the icon source (§II.7.6).

### Not applicable

Icon Composer (macOS Sequoia only; produces layered Liquid Glass App Store icons, which are a different
artifact from PWA manifest and `apple-touch-icon` assets) · product bezels · Apple Pay / Health / Wallet /
HomeKit / Sign in with Apple badges and templates · Parallax image tools · the macOS, tvOS, watchOS and
visionOS UI kits.

**Note on tooling availability:** most of the *applications* on that page (SF Symbols, Icon Composer,
Parallax Previewer) are macOS-only. The Figma kits are the only part of the page usable from this
project's environment.

## Appendix C — Numbers to design against

| Constraint | Value | Source |
|---|---|---|
| Body text default | 17 pt | §I.2 |
| Absolute type minimum | 11 pt (Metrothi: 12 px) | §I.2, §II.6.3 |
| Species A type minimum | 17 px | §II.6.3 |
| Touch target default | 44 × 44 pt | §I.8 |
| Touch target absolute minimum | 28 × 28 pt (not used by Metrothi) | §I.8 |
| Padding around bezeled controls | ~12 pt | §I.8 |
| Padding around unbezeled controls | ~24 pt | §I.8 |
| Contrast, text ≤ 17 pt | 4.5:1 | §I.8 |
| Contrast, text ≥ 18 pt or bold | 3:1 | §I.8 |
| Contrast, custom colours (target) | 7:1 | §I.3 |
| Contrast, Metrothi Species A | 7:1 | §II.6.2 |
| Text enlargement support | ≥ 200% | §I.8 |
| Largest accessibility body size | 53 pt (3.1× default) | §I.2 |
| Dimming layer over bright content | 35% opacity | §I.4 |
| Map attribution padding | ~7 pt sides, ~10 pt vertical | §I.11 |
| Map annotation icon string | 2–3 characters | §I.11 |
| Live-update animation maximum | 2 s | §I.12 |
| Design/test viewport width | 360 px | §II.6.5 |
