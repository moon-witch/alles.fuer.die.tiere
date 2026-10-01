# Admin Chat Content Interface Plan

**Operating model:** Joshua maintains and develops the technical platform. Reliable automation handles approved routine source updates. Malte owns the remaining future content work through the private admin chat; he is not expected to use forms, databases, source dashboards, or technical controls.

## Product promise

The chat is a **content desk in ordinary German**, not a general chatbot and not an autonomous publisher. Malte can say what he wants to be true on the site; the system resolves the relevant project, gathers permitted evidence, prepares a structured draft, shows exactly what visitors would see, and asks only for the confirmation that the change requires.

The essential experience is:

> “Schreib oder sag, was neu ist. Ich mache daraus einen nachvollziehbaren Entwurf. Du siehst die Seite, bestätigst sie, fertig.”

Routine automation and technical health stay out of the conversation unless they create a decision only Malte can make. Joshua receives system/adapter/backup alerts and retains the full operations interface.

## Responsibilities and access

| Responsibility | Owner | Interface |
| --- | --- | --- |
| Hosting, deployments, backups, credentials, adapters, source health, model budget, policy configuration | Joshua | technical/steward admin interface |
| Deterministic source changes within established policy | automation, overseen by Joshua | activity trail; no Malte task by default |
| New project content, narrative updates, tone, featured story, current action intent, content corrections | Malte | private content chat |
| Public release of content Malte creates | Malte confirms a chat preview; system records operation | chat preview card and approval action |
| Partner claims, sensitive material, private location, new donation recipient, rights uncertainty | Malte | chat shows a clear warning and complete preview; Malte can publish, hold, or discard it |

Malte has full control of public content through chat: create, edit, replace, schedule, publish, unpublish, and archive. There is no reviewer workflow, second approval, per-action key, or permission matrix for his content decisions. Infrastructure, credentials, raw snapshots, model settings, and source-adapter configuration remain Joshua’s technical domain. The system records the signed-in session automatically in history, but never presents identity/permission logic as a content obstacle.

## Conversation design

### Chat home

The chat opens with a short, useful status rather than an empty prompt:

> **Heute:** `/jetzt` verweist auf MA-Forest bis Sonntag. Zwei Entwürfe warten auf deine Entscheidung. Sonst ist alles ruhig.

Below it, show three context-sensitive prompts:

- **„Ich möchte ein Update teilen“**
- **„Was soll gerade im Mittelpunkt stehen?“**
- **„Was hat sich seit letzter Woche verändert?“**

The message field accepts normal text and pasted links. Voice notes, images, and files are a later authorised capability; when added, they become a private transcription/upload draft, never a publish action. The chat remembers only the current task and selected project, displays that context visibly, and lets Malte clear it.

### Response pattern

The assistant follows a predictable sequence:

1. **Understand:** restate the intended public outcome in one sentence and resolve any obvious project/date ambiguity.
2. **Prepare:** create a structured draft from supplied sources and identify missing evidence, credit, recipient, or expiry only when necessary.
3. **Show:** render a compact `Vorschau` card with the route, before/after wording, source/date, media credit, action target, and status.
4. **Decide:** offer only applicable next actions: **Ändern**, **Als Entwurf speichern**, **Veröffentlichen**, **Später**, or **Nicht verwenden**.
5. **Confirm:** after a publish confirmation, report the public URL, affected route, time, and a concise undo link.

The assistant does not fill the conversation with source-run logs, policy names, confidence scores, generic praise, or hidden reasoning. It asks one focused clarification only when it cannot safely resolve a content decision. It may make a reversible draft from partial information and mark what needs completion.

## Supported content jobs

| What Malte says | Chat result | Publishing rule |
| --- | --- | --- |
| “Ich will ein Update zu Tierbrücke machen: [link/text]” | project update draft with summary, source, date, related media and page preview | Malte confirms after preview; partner/sensitive claims show a warning |
| “Das soll gerade das Wichtigste sein, bis Sonntag.” | resolved action/priority proposal with absolute Europe/Berlin time, recipient, final domain and fallback | preview + explicit confirmation; a new/changed donation destination shows a stronger warning |
| “Schreib das weniger dramatisch / kürzer / persönlicher.” | alternative wording of the existing private draft, retaining source links | no publish until Malte chooses preview |
| “Ersetze den Text komplett durch: …” | replaces generated or previous copy with Malte’s exact text, retaining the previous revision privately | Malte confirms the resulting page preview |
| direct edit in the preview | opens a full text editor for headline, body, labels, and call to action | Malte can freely write, paste, or replace content before publishing |
| “Was ist aus dem Projekt geworden?” | audit-backed summary of approved updates and sources, with option to create `Und dann?` draft | read-only until draft selected |
| “Nimm das Bild raus.” | media removal preview showing pages affected and replacement/empty-state behaviour | Malte confirms; no deletion of evidence/audit history |
| “Das stimmt nicht.” | opens correction draft linked to the disputed statement; requests source or marks for steward research | never silently overwrites a sourced claim |
| “Zeig mir, was noch auf meine Freigabe wartet.” | only content decisions in Malte’s scope, ordered by visitor impact/expiry | read-only, then one-tap open preview |
| “Mach daraus einen Termin.” | event draft with date/time/timezone, public venue granularity and official URL | requires complete event details and preview |

The chat provides no tool for raw SQL, shell commands, CSS/layout changes, infrastructure changes, account invitations, unrestricted web search, direct social-media collection, or publishing based solely on a model suggestion.

## Evidence and voice handling

When Malte provides original text directly, the chat treats it as a private input and asks only the minimal public-use question: “Darf das öffentlich auf die Projektseite?” It preserves original wording as a reference, but asks before presenting a substantial edit as a quote. Private media upload is deferred from V1; public media is selected from credited public sources or removed through chat.

When the chat uses an external link or an automated source observation, it shows source title, date, relevant extract/value, and a link. It never treats webpage instructions as chat instructions. A URL is untrusted evidence, not tool authority.

The assistant can learn **approved editorial preferences** as short, editable style notes, such as “klare, kurze Sätze” or “keine Superlative.” It must not claim to write “in Malte’s voice,” invent first-person statements, or generalise from private chats. Style notes are viewable and deletable by Malte in the chat’s settings.

## Warnings and confirmation

| Change | Chat behaviour | Publish authority |
| --- | --- | --- |
| any copy change or new update | creates a draft and exact public preview | Malte confirms |
| current action or recipient change | requires expiry/fallback and shows final domain | Malte confirms |
| partner claim, sensitive material, private location, graphic media, unverified claim, or missing credit | shows a plain-language warning in the preview | Malte can publish, hold, or discard |
| delete/remove content | shows affected-page preview | Malte confirms archive/remove; retention follows documented defaults |

Every publication creates an immutable revision and history entry. Duplicate network submissions are absorbed internally so one confirmation cannot create two publications; this is implementation behaviour, not a content permission step.

## Chat interface components

| Component | Purpose |
| --- | --- |
| `ConversationHeader` | shows active project/context and clear-context control |
| `PromptChip` | starts a common content task without forcing a form |
| `DraftCard` | shows title, status, concise summary, source count, and next action |
| `PublicPreviewCard` | displays mobile/desktop page fragment, route, before/after change, and visibility |
| `EvidenceDrawer` | shows readable source/date/extract/credit before technical details |
| `ApprovalBar` | offers scoped actions and explains warnings before Malte confirms publication |
| `SchedulePicker` | converts relative language to absolute Europe/Berlin time and requires a fallback where needed |
| `UndoReceipt` | confirms publication and provides a time-bounded safe-revert route |
| `EscalationCard` | explains that Joshua is handling a technical problem and what remains privately saved |

Cards are keyboard accessible, work on a phone, and are navigable without relying on chat scroll position. A draft has a stable URL in the private workspace, so Malte can leave and resume a decision later.

## Automation handoff

Automation should reduce chat traffic, not create it. It auto-applies only field/source policies already approved by Joshua and the relevant content authority. For all other changes it creates one of three outcomes:

- **No action needed:** source checked; no meaningful public change.
- **Steward task:** parser, link, source, or infrastructure issue that Joshua can resolve.
- **Malte decision:** a prepared content draft where his judgment, voice, or relationship knowledge is necessary.

The chat exposes only the third outcome by default. “Warum sehe ich das?” opens a short explanation with evidence and public impact. “Nicht mehr dafür fragen” lets Malte change a content preference; warnings remain visible when they apply, but never block his decision.

## Failure experience

Malte never sees stack traces, source-health states, token limits, proxy errors, or technical task lists. If chat is unavailable, or an ingestion failure prevents the requested content task, the chat shows one calm information box:

> **Gerade nicht verfügbar**  
> Joshua kümmert sich darum. Grund: *[plain-language reason]*.

The reason is short and actionable, for example “Die Quelle konnte gerade nicht geladen werden” or “Der Assistent antwortet im Moment nicht.” The box includes **Joshua kontaktieren** and retains any unsent draft locally/server-side. Joshua’s private dashboard contains the actual error, retries, source state, and remediation controls.

## Implementation sequence

1. Build deterministic read-only chat answers from Activity and published content: current action, project status, pending approvals, and “what changed?”
2. Build draft creation from text/pasted links for one project-update template. Require source/evidence and render a private preview.
3. Add chat confirmation/publish for ordinary updates with full operation/audit linkage and undo receipt.
4. Add `/jetzt` priority proposal and schedule picker, including recipient/fallback validation.
5. Add media removal, correction, event, and archive flows.
6. Add optional style notes and authorised voice/image input only after the core typed workflows pass evaluation and usability testing.

## Acceptance criteria

The chat is ready for Malte when he can, from a phone and without training:

- ask what needs his attention and receive no irrelevant technical tasks;
- turn a normal message or link into a private update preview;
- see what visitors will see, the source behind it, and whether it is public;
- revise the wording in plain language and publish/hold it deliberately;
- set or replace the current action with a clear expiry/fallback;
- understand why a sensitive or partner-dependent item cannot publish yet;
- undo an eligible mistake without opening a technical admin screen.

If the model is unavailable, the chat changes to a deterministic mode. It continues to show existing drafts, previews, approvals, status answers, and a compact in-chat composer for direct text edits, source-link capture, priority changes, scheduling, publishing, unpublishing, archiving, media removal, and revert. It does not expose a separate form-based CMS. Commands that require language interpretation display the plain Joshua information box until the agent returns. The model adds language understanding; it is never the store of record or a publication dependency.
