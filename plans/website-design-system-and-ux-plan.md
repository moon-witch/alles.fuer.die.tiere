# Alles für die Tiere — Design System and Website UX Plan

**Status:** researched design direction and implementation plan  
**Date:** 28 September 2026  
**Applies to:** `allesfuerdietiere.earth` V1, with foundations for a future international edition
**Product and adoption requirements:** [malte-platform-product-plan.md](malte-platform-product-plan.md)

## 1. Design outcome

Create a German animal-rights platform that feels **close, candid, hopeful, and capable**. It begins with an individual animal or an honest human moment, gives the visitor enough context to care, then makes the next action unmistakably clear. The experience must have emotional warmth without becoming cute, and documentary credibility without feeling like an institutional annual report.

The site should immediately feel like an adopted Malte project. It uses relevant public identity and assets where they make sense, always with visible original credit/source. The visual system combines those assets with original components so it can connect MAPHIA, Tierbrücke, animal stories, and partner work into one coherent site.

## 2. Research: signals to retain and boundaries to respect

| Observed public signal | Design implication | Boundary |
| --- | --- | --- |
| MAPHIA uses irregular hand-drawn lettering, a heart detail, short phrases such as “LOVE ANIMALS.”, and a playful merchandise voice. [MAPHIA shop](https://maphia.shop/) | use selected identity assets and the same handmade warmth where appropriate | merchandise remains visibly separate from donations |
| MAPHIA’s support page explicitly distinguishes shop purchases from direct project support. [MAPHIA support page](https://maphia.shop/pages/taylt) | actions name the recipient and action type plainly; shop links use “Merchandise” | never use shop conversion language or shopping-cart conventions for helping actions |
| Tierbrücke’s public imagery combines a close human/animal relationship with pale sky, a restrained map cue, and the line “Jede Seele braucht ein Zuhause.” [FilmCrew Media](https://www.filmcrew.media/tierbruecke) | use credited Tierbrücke materials on the Tierbrücke project page and carry its documentary intimacy into adjacent original components | retain project-specific title/slogan context and original credit |
| Public interviews describe an activist voice rooted in attention to individual animals, directness, humour and the emotional weight of the work. [DU UND DAS TIER](https://www.duunddastier.de/ausgabe/katzenschutz-interview-malte-zierden/), [watson interview](https://www.watson.de/leben/interview/959607210-tiktok-star-malte-zierden-leistet-tierschutz-im-krieg-auf-kosten-seiner-psyche) | tell specific stories, use plain German, leave room for gentle levity, then give facts and agency | do not turn personal mental-health or crisis material into decorative branding or a conversion device |
| The MA-Forest partner page combines tangible units, personal campaign context, and a direct donation handoff. [Wilderness International](https://en.wilderness-international.org/ma) | metrics should be concrete, dated, and paired with their source/action | never imply the platform collects donations or represents a partner without approval |
| The public body of work includes local animals, crisis work, rainforest protection, books, film, and music. [Joyn profile](https://www.joyn.de/bts/themen/stars/malte-zierden-so-machte-ihn-eine-taube-zum-tierschutz-influencer-67070) | content system needs quiet relationship-based links rather than one visual style per topic | avoid a celebrity fan-site or a traumatic-image feed |

### Design personality

The following is a design interpretation of those public signals, not a claim about a private person:

- **Personal:** animals are individuals with names, histories, and agency; show their presence before statistics.
- **Plain-spoken:** use everyday German, active verbs, short headings, and direct calls to action.
- **Unvarnished but careful:** show reality with captions, context, source credit, and content controls; never use distress only for visual impact.
- **Warmly unruly:** small hand-drawn accents and occasional gentle humour keep the site human, but navigation and action paths remain calm and precise.
- **Actionable:** emotion always has a next step—help, learn, attend, share, or follow a project’s outcome.

## 3. Brand architecture

Use **Alles für die Tiere** as the public verbal identity, informed by Malte’s existing identity and project assets. The domain is prominent only in technical/legal contexts, not as the brand name in every heading.

### Voice rules

| Use | Avoid |
| --- | --- |
| “Hilf, dass dieser Ort geschützt bleibt.” | vague moral pressure or guilt language |
| “Stand: 28. September 2026 · Quelle: Wilderness International” | unsupported superlatives, hidden source links, or artificial urgency |
| “Was danach passiert ist” | claims of final success when only an outbound handoff is known |
| specific animal names and respectful pronouns when verified | reducing animals to generic decorative imagery |
| short, conversational German in supporting copy | adopting a personal social-media voice as if it were a verified quote |

The public site uses German first. Define content records with `locale: de`; international routes and translations are introduced only after editorial capacity exists. Do not use automatic translation as a publication step.

### Logo and marks

V1 wordmark: `alles für die tiere` in a lowercase display treatment that can sit alongside selected MAPHIA/Malte project marks. Use existing marks/assets directly when they identify their original project; original supporting marks fill the gaps between them. The wordmark must pass at one colour, reverse, favicon, and screen-reader tests.

Use a restrained original “care mark” only as a recurring micro-detail in labels, dividers, and empty states. It cannot replace an accessible text label or a familiar control icon. A later logo update can replace this provisional mark; all components must therefore accept an SVG logo slot without layout changes.

## 4. Visual foundations

### Colour tokens

The foundation is off-white paper and almost-black ink. Campaign accents are semantic and limited to one per page/module. They never indicate status by colour alone.

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#F7F3EC` | default page ground |
| `--color-surface` | `#FFFDF9` | cards, forms, raised content |
| `--color-ink` | `#1B1B18` | main text, wordmark, strong rules |
| `--color-muted` | `#655F57` | supporting text, metadata |
| `--color-line` | `#D8D1C6` | borders and dividers |
| `--color-moss` | `#315B47` | positive/help context, verified-source details |
| `--color-sky` | `#B8D7E6` | calm campaign/editorial accent |
| `--color-clay` | `#C95343` | urgent action accent, errors, destructive emphasis |
| `--color-sun` | `#E7BB48` | small discovery/highlight accent |
| `--color-night` | `#20252B` | dark media/story section |

Verify every foreground/background pair at WCAG AA contrast before it becomes a token. `clay` is not the default button colour; it is reserved for a time-sensitive primary action or error. `moss` is not a universal “good” indicator; status always includes text and icon.

### Typography

Self-host two open-licence variable fonts as WOFF2 subsets for German characters:

- **Newsreader** for editorial display headings, pull quotes, and durable project storytelling. It brings a book/documentary quality without impersonating handwritten branding.
- **Instrument Sans** for navigation, UI, body text, dates, data, and action labels. It is plain, compact, and highly legible at small sizes.

Fallback stack: `Georgia, 'Times New Roman', serif` for display; `system-ui, sans-serif` for interface. Use a 16 px base, 1.5–1.65 body line-height, `clamp()` display scale, and normal case in sentences. Use all caps only for short metadata/kickers with letter spacing; never set German paragraph copy in all caps.

### Layout, shape, and texture

Use a 12-column desktop grid, 6-column tablet grid, and 4-column mobile grid. Main content width is 72rem; long reading measure is 42–46rem. Base spacing unit: 0.25rem; practical rhythm: 0.5, 0.75, 1, 1.5, 2, 3, 5, 8rem. Use 1px imperfect-looking rules only in editorial dividers; components remain geometrically dependable.

Cards have a 1px ink/line border, modest 0.5rem radius, and no floating glass, heavy shadow, or rounded-pill overload. Use a torn-paper or hand-drawn accent only as an original SVG/CSS texture at the edge of an editorial feature; do not place it behind body copy or controls. The site should still look complete with texture disabled.

## 5. Photography, illustration, and motion

### Art direction

Prioritise original or licensed documentary photographs that show animal individuality, relationship, place, and work in context. Favour daylight, honest grain, close details, real environments, and captions that name the animal/project/source where safe. Pair difficult documentation with quiet images of care, landscape, or aftermath so the site does not overwhelm visitors.

Never crop a photo so tightly that it removes essential context, misrepresents a rescue, or treats a visibly distressed animal as a visual pattern. Do not use stock “sad animal” imagery, AI-generated animal suffering, or decorative wildlife images as proof of an unrelated claim. Original source credit is visible near media; sensitive images use the reveal behaviour already defined in the product plan.

Original line illustrations can depict tracks, leaves, bowls, maps, or simple animal silhouettes. They must be created for the platform, use one or two ink-like strokes, and never mimic MAPHIA merchandise graphics. Illustration is supportive: photography/evidence carries the story.

### Motion

Use motion only to clarify state: a button press, a source panel opening, image reveal, or a new item entering a list. Duration: 120–180 ms with standard easing. Respect `prefers-reduced-motion`; it removes nonessential transforms and all looping decoration. No autoplay video or loud visual interruption on page load.

## 6. Public information architecture and page UX

### Navigation

Desktop navigation: wordmark · **Projekte** · **Helfen** · **Termine** · secondary overflow (Tiere, Über uns, Presse) · persistent **Jetzt helfen** button. On mobile, keep the wordmark and primary action visible; the menu is a full-height, keyboard-trapped dialog with clear close control and the current action repeated inside.

The active route uses text weight and an underline/marker, never colour alone. The persistent action shows its recipient in a compact hover/focus disclosure on desktop and plainly on its destination page. It never changes location while a user is interacting with the navigation.

### Homepage sequence

1. **Current action:** full-width but compact editorial panel—what, who receives it, why now, source/checked date, and one action button.
2. **A living story:** a featured project or animal, with one strong image and one real status/outcome line.
3. **Ways in:** three routes—project work, individual animals, and upcoming events—using varied imagery rather than three identical cards.
4. **What changed:** one dated, verified outcome, explicitly separate from donation/petition completion counts.
5. **Next public event** or a calm “Aktuell sind keine öffentlichen Termine geplant” state.
6. **Trust footer:** about/operator wording, source approach, contact, legal links, and distinct partner/merch links.

The hero is not a generic oversized slogan or autoplay reel. At first visit, it lets a visitor understand the current help request before encountering the wider archive. A campaign can own the opening panel temporarily, but all pages retain the global navigation and context.

### Core route patterns

| Route | Structure | Main interaction |
| --- | --- | --- |
| `/jetzt` | current action → recipient/destination → why now → source/stand → alternatives → fallback | informed outbound handoff |
| `/projekte` | intro → filters by theme/status only when enough entries exist → editorial card grid → archive link | browse without a taxonomy burden |
| `/projekte/:slug` | durable story → timeline → Stand heute → Und dann? → current action → sources/related items | understand an ongoing project and act |
| `/tiere/:slug` | animal story → related issue/project → gentle action → media controls | feel individual connection without anthropomorphising claims |
| `/termine` | next event first → concise date/place/accessibility → official link → past events | decide whether to attend |
| `/presse/:slug` | verified facts → cited timeline → reusable media/credits only where licensed | journalist/researcher fact check |

On public listings, cards carry a content type, title, one-sentence purpose, date only when meaningful, and a clear status. Avoid infinite scroll. Use “Mehr Projekte zeigen” with accessible page state, then durable paginated URLs as the archive grows.

### Action and handoff UX

Every action button uses a verb and recipient: “MA-Forest bei Wilderness International schützen,” not “Jetzt spenden” in isolation. Before departure, `/jetzt` names the organisation, the final destination domain, whether it is a donation, petition, ticket, or information page, and that the visitor completes the action on the partner site. External-link icon plus accessible text communicates the handoff.

On return/back navigation, the site does not claim completion. It can offer a quiet “Danke, dass du dir Zeit genommen hast” state only after an outbound click, while clearly describing it as a visit to the partner—not a completed donation/petition.

## 7. Component system

Build components as small Svelte primitives with explicit variants. Tokens live in `src/lib/styles/tokens.css`; reset/base typography in `base.css`; layout primitives in `layout.css`; each component owns its scoped CSS. Use CSS custom properties for theme/accent variation rather than runtime style generation or a utility framework.

| Family | V1 components | Rules |
| --- | --- | --- |
| Foundations | `PageShell`, `Container`, `Stack`, `Cluster`, `Grid`, `Section`, `VisuallyHidden` | semantic HTML first; no generic `Box` component |
| Navigation | `SiteHeader`, `MobileMenu`, `Breadcrumbs`, `Footer`, `SkipLink` | one landmark/heading hierarchy per page |
| Actions | `ActionButton`, `ExternalAction`, `TextLink`, `ActionPanel`, `ActionFallback` | primary/secondary/quiet/destructive variants; label action type and recipient |
| Editorial | `Kicker`, `StoryHeader`, `ProjectCard`, `AnimalCard`, `OutcomeBlock`, `Timeline`, `Quote`, `FactRow` | content type drives component, not visual novelty |
| Trust | `SourceNote`, `AsOf`, `StatusLabel`, `RecipientDisclosure`, `MediaCredit`, `SensitiveReveal` | human-readable by default; technical evidence stays internal |
| Media | `ResponsiveImage`, `Caption`, `MediaGrid`, `EmbedPlaceholder`, `VideoConsent` | width/height required; no social script until user initiates load |
| Feedback | `EmptyState`, `InlineNotice`, `ErrorSummary`, `LoadingSkeleton`, `Toast` | no colour-only signal; errors explain next action |
| Admin | `TaskCard`, `DraftComposer`, `EvidencePanel`, `PublicPreview`, `WarningDecision`, `HistoryPanel` | the same tokens, denser layout, no public-campaign theatrics |

Document every component with purpose, permitted variants, content constraints, keyboard behaviour, screen-reader announcement, and examples. Add a `/admin/design-system` route protected from public indexing for component review; it renders mock content only and is not a production CMS surface.

## 8. Responsive, accessible, and resilient behaviour

Design mobile first. At 40rem, allow two-column editorial grids; at 64rem, use the 12-column layout and persistent desktop navigation. Touch targets are at least 44 × 44 CSS pixels. Body content never relies on hover, and every action remains visible without it.

All images carry meaningful alt text or are explicitly decorative. Source details use native `details/summary` only when that disclosure is suitable; complex action context is always visible. Focus moves deliberately into/out of the mobile menu and sensitive-media reveal. Error summary links target the corresponding field. Event dates include a text timezone. Use semantic `article`, `nav`, `main`, `aside`, `time`, and heading order before ARIA.

The no-JavaScript baseline renders navigation links, all critical action context, sources, and page content. JavaScript may enhance menus, filters, previews, upload, and embeds. If an image, external embed, source, or action destination fails, the visitor sees readable text, a safe fallback, and the last verified state—not an empty or misleading panel.

## 9. Internal UI visual direction

The steward console inherits the paper/ink system and typography, but it is quieter than public storytelling. Use a dense but breathable two-column desktop workspace: task list left, content/evidence/preview right. On smaller screens, task → detail → preview becomes a predictable linear path. Malte’s interface is the phone-friendly content chat, not this console. Do not use campaign photography as a dashboard background.

Severity uses plain labels plus icon and colour: **Jetzt wichtig**, **Zur Prüfung**, **Pflege fällig**, **Info**. The public preview has a clear `Vorschau` frame and shows the route, device-width toggle, and what is currently live. The source/evidence panel presents title, date, exact passage/value, credit, and original link before technical metadata. Revert controls sit in Verlauf and require a visual result preview.

## 10. Design delivery sequence

| Stage | Design deliverable | Acceptance check |
| --- | --- | --- |
| 0 | visual audit, approved brand boundary, licensed/original photo inventory, writing samples | no unlicensed or implied-affiliation asset enters a prototype |
| 1 | tokens, typography loading, logo placeholder, layout primitives, public component inventory | contrast, font fallback, and mobile baseline pass |
| 2 | clickable mobile and desktop prototypes for home, `/jetzt`, project, event, and sensitive media | visitors can identify recipient, source, and next step without explanation |
| 3 | Joshua-dashboard prototypes for update, action change, attention, archive, and revert; Malte-chat prototypes for the same content outcomes | Malte completes the content tasks on a phone through chat; Joshua completes technical/source tasks through the dashboard |
| 4 | implemented components, real-content visual QA, image derivatives, accessibility/performance checks | representative pages pass keyboard, screen-reader, Core Web Vitals, and responsive checks |
| 5 | launch content art direction review and reusable editorial style guide | every hero/media choice has right, credit, crop, alt text, and sensitivity decision |

### Required UX and visual tests

- Test at 320 px, 375 px, 768 px, 1024 px, and a wide desktop view with long German words and text zoom at 200%.
- Run automated contrast and accessibility tests, then manually test keyboard navigation, screen-reader landmarks, mobile menu focus, external action disclosure, and sensitive reveal.
- Compare a source-linked project page, a current action, a cancelled event, an old historic project, and an empty-state page. These states are the design system, not edge cases.
- Use visual-regression captures for every component and public route state. Include no-image, long-title, missing-source, and expired-action fixtures.
- Measure local font/image weight and LCP on representative mobile network/hardware. Defer all social embeds and never let them become the LCP element.

## 11. Decisions needed before visual production

1. The V1 visual direction is an adopted Malte project and may use public-source identity/assets where they make sense, with visible original credit. Record the original source on every reused asset.
2. Select the launch photographs and any content/safety restrictions. A real image library is necessary before final art direction, crop rules, and page compositions can be signed off.
