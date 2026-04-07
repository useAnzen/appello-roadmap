# Agent Planning Guidelines — Appello Analysis & Spec Authoring

> **Purpose:** This document captures lessons learned from the UIS-15 (Equipment) and UIS-20 (T&M Work Orders) planning rounds. It is intended to be given to AI agents that draft the **analysis/spec and mockups** — the first round of planning. Implementation plans are created separately by a developer after reviewing the spec.
>
> **Your job as the planning agent:** Produce a spec document that correctly identifies scope, data model changes, API surface, UI concepts, and acceptance criteria. A developer will review your output and then build the implementation plan with full code-level detail. Your spec needs to be accurate enough that the developer doesn't have to redo your data model or scope decisions.

---

## 1. The #1 Rule: Read Before You Write

The single largest category of error in first drafts was **inventing new infrastructure instead of extending what already exists.** Before proposing any new model, table, enum, config system, or billing flow:

1. **Search the Prisma schema** (`apps/api/prisma/schema.prisma`) for existing models that already do what you need.
2. **Search `apps/api/src/models/`** for business logic patterns (BaseModel conventions, hooks, computed fields).
3. **Search `apps/api/src/graphql/models/`** for existing resolver patterns and GraphQL type conventions.
4. **Search the frontend** for existing components that match what you're about to build (ListTable, TabGroup, FormControl types, CustomCombobox, AsyncMultiselect).

**The correct answer is almost always "add one FK to an existing model" not "create a new subsystem."**

### Examples of What Went Wrong

| Original Draft | What It Should Have Been |
|---|---|
| New `EquipmentBillingConfig` model with separate billing models (cost-plus, flat-rate, T&M) | One FK addition to `JobBillLineItem` — the existing `JobBill` Simple template already handles equipment invoicing |
| New aggregation pipeline for equipment P&L | One `accountItemId` FK on `EquipmentCategory` — mirrors the exact pattern labor uses via `TradeLevel.accountItemId` |
| Full rate resolution engine from scratch | LEM-2 already built the entire foundation (EquipmentRateLabel, EquipmentRateValue, resolveEquipmentRate, shared UI). Only needed to add time-window + attachment logic on top |
| `isWorkOrder` boolean flag on Job model | `jobClassification` enum on PropertyValue — leveraging the existing PropertyValue job type system |
| `EquipmentAttachmentRate` model for attachment pricing | Attachments are Equipment records — they already have LEM-2 rates. No new model needed |
| Custom dashboard with new SQL views for T&M log | Frontend refactor to share existing ListTableViews infrastructure. No new backend |

---

## 2. Appello Data Model Conventions

Every model in the Appello schema follows these conventions. Deviating from them is always wrong. You must use these conventions when proposing new models or fields in the Data Model section of a spec.

### IDs
```prisma
id  String  @id  @db.VarChar(21)  // nanoid, NOT autoincrement Int
```
Never use `Int @id @default(autoincrement())`.

### Soft Deletes
```prisma
isDeleted   Boolean   @default(false)
isArchived  Boolean   @default(false)
```
All models use these two flags. Never use hard deletes.

### Timestamps
```prisma
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

### No `companyId` FK
Appello is instance-scoped via auth context. Models do **not** have a `companyId` foreign key. Never add one.

### Duration Fields
Always stored as **seconds** (`Int`), not minutes, not `Decimal(10,2)`. This matches the timesheet convention where `secondsAtService` is standard.

### FKs
Always `String? @db.VarChar(21)` for optional, `String @db.VarChar(21)` for required. Always include the `@relation` and define the inverse on the related model.

### Polymorphic References
The codebase uses `referenceModel` / `referenceId` for polymorphic relationships (e.g., Notes, EquipmentRateValue, MaintenanceThreshold). `referenceModel` is a string matching a `ReferenceModel` seed value; `referenceId` is the FK. This pattern requires a `ReferenceModel` seed entry.

### Enums
Appello does NOT use Prisma enums. It uses a **const-based pattern** matching how `ApprovalStatus` is defined on timesheets:

```typescript
export const MAINTENANCE_STATUSES = ["OK", "DUE_SOON", "OVERDUE"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
```

The GraphQL enum is generated from the const via template literal in the resolver's typeDefs. Never define a Prisma `enum` block.

### PropertyValue System
Appello uses `PropertyValue` for user-configurable categorical types (e.g., maintenance types, job types, equipment statuses). PropertyValues support `includeColourPicker: true` for color-coded badges, arbitrary key-value metadata, and are simple lookup values (no workflows).

When a feature needs user-configurable categories (like "Oil Change", "Filter Replacement", "Annual Inspection"), use PropertyValue with a seed, not a new enum or config table.

### Computed vs Stored
Do NOT store values that can be computed (maintenance status, estimated revenue, totals that derive from child records). Compute on the fly and document the algorithm in the spec.

---

## 3. Spec Document Structure

Every spec follows this 8-section structure. Do not add sections, reorder them, or rename them.

| # | Section | Purpose |
|---|---------|---------|
| 1 | **Business Case** | 2-3 paragraphs max. Regulatory drivers, market context, pain point. |
| 2 | **Scope** | Three tiers with visual tags (see below). Includes Pending Business Decisions if needed. |
| 3 | **UI Concepts** | Wireframe mockups showing layout and information hierarchy. |
| 4 | **Data Model** | Prisma schema syntax showing new/modified models. |
| 5 | **API Surface** | GraphQL types, inputs, queries, mutations. |
| 6 | **Change Surface** | Table of every file that will be touched (Action / Path / Change). |
| 7 | **Acceptance Criteria** | Numbered list of testable behaviors, one sentence each. |
| 8 | **Dependencies** | Requires, Enables, Parent, Siblings. |

### Scope Section Detail

The Scope section uses three tiers with colored tags:

- **Already built** (blue `scope-done` tags) — only when the spec builds on prior work. List what exists that you are NOT rebuilding. This is critical for preventing the developer from re-implementing things.
- **In scope** (green `scope-in` tags) — what this spec delivers. Be specific about what is new.
- **Out of scope** (red `scope-out` tags) — what is excluded, with a pointer to where it lives (future spec ID or "future").
- **Pending Business Decisions** — use a yellow `decision` callout for questions that need stakeholder input before implementation. If a feature's workflow is undefined, do NOT include it as a disabled/coming-soon UI element — exclude it entirely until the decision is made.

### Data Model Section Detail

- Show full Prisma `model` blocks with all fields, types, decorators, relations, and indexes
- Show relations added to existing models as separate snippets
- Show seed data as SQL `INSERT IGNORE INTO` statements
- Explicitly call out computed fields as "not stored" and describe the computation algorithm
- Do NOT restate Prisma conventions (IDs, soft deletes, timestamps, etc.) in every spec — just use them correctly

### API Surface Section Detail

- Opening paragraph references: "Apollo GraphQL: resolvers and types in `apps/api/src/graphql/models/`; business logic in `apps/api/src/models/` extending `BaseModel`."
- List new GraphQL types, input types, queries, and mutations
- Reference existing patterns where applicable

### UI Concepts / Mockups

- Keep mockups minimal — they show layout and information hierarchy, not pixel-perfect design
- Show the new elements clearly, mark them with a "NEW" badge where helpful
- For features that use existing UI patterns, name the component (ListTable, TabGroup, CustomCombobox) rather than mocking it from scratch
- Do NOT mock up functionality that is out of scope or pending business decisions

### What NOT to include in specs
- Competitive landscape sections / competitor product cards
- "Value cards" with emoji icons
- Business case padding with margin percentages and vague ROI claims
- Table of Contents (the section headers are sufficient)
- Marketing copy or sales-oriented language

---

## 4. Scope Sizing Guidelines

### Signs a spec is too big (decompose it)
- More than 3 new Prisma models
- Frontend spans both desktop and mobile with different layouts
- The spec covers both configuration UI and operational UI
- The spec is doing CRUD + complex business logic + reporting in one document

### Signs a spec is over-specified (strip it down)
- The entire feature is "add one FK and one dropdown" — keep the spec short
- The spec describes functionality that already exists (SafetyForm system, JobBill templates) — call it "Already built" and focus only on the new integration point
- The spec is 600+ lines for a feature with one data model change

### Decomposition Pattern
When a feature is too large, split by architectural layer or workflow boundary:
- UIS-20C (Create/Edit Form) → split into: Schema/Form Foundation, Line Item Editors, Signatures/Submission, Property Settings
- UIS-20H (Mobile) → split into: Mobile List/Detail, Stepped Form Wizard, Collect Signatures

---

## 5. Common Mistakes to Avoid

### Data Model
- [ ] Do NOT use `Int @id @default(autoincrement())` — use `String @id @db.VarChar(21)`
- [ ] Do NOT add `companyId` FK — instance scoping is via auth context
- [ ] Do NOT use `Decimal(10,2)` for duration — use `Int` (seconds)
- [ ] Do NOT create Prisma `enum` blocks — use const-based TypeScript pattern
- [ ] Do NOT store computed values (maintenance status, estimated revenue) — compute on the fly
- [ ] Do NOT create a new rate/billing model when the existing rate system already handles it
- [ ] Do NOT use fixed columns for dynamic categories (e.g., `straightTimeHours`, `overtimeHours`) — use FK references to dynamic rate labels
- [ ] Do NOT forget inverse relations on existing models when adding new FKs
- [ ] Do NOT forget seed data for PropertyValues and ReferenceModel entries

### Scope & Content
- [ ] Do NOT show dollar rates/totals on data capture forms (WO forms, timesheets) — pricing is applied downstream at invoicing
- [ ] Do NOT bundle configuration UI and operational UI into one spec
- [ ] Do NOT include competitive analysis, value cards, or marketing copy
- [ ] Do NOT propose a disabled/coming-soon button for undefined features — either define the workflow or exclude it entirely
- [ ] Do NOT invent a new subsystem when an existing model + one FK would solve the problem
- [ ] Do NOT describe how existing systems work in detail — reference them briefly and focus on what's new

---

## 6. Dependency & Ordering Awareness

Before writing a spec:

1. **Map what exists today** — read the schema, identify existing models, queries, components
2. **Map what prior tickets in the release deliver** — if LEM-2 builds the rate engine, don't rebuild it
3. **Map what downstream tickets need from you** — if UIS-15E needs `defaultInspectionFormId`, make sure UIS-15F creates it first
4. **Validate the dependency chain makes sense** — a feature that reads data created by another feature must depend on it, not the other way around

Common dependency mistakes from first drafts:
- Proposing features that depend on things they're supposed to create (circular dependency)
- Not recognizing that a "foundation" ticket (LEM-1, LEM-2) already delivers 80% of what a downstream ticket needs
- Over-specifying prerequisites that are actually already built

---

## 7. HTML & CSS Conventions for Spec Documents

- All spec HTML files reference `shared-spec-styles.css` via `<link rel="stylesheet" href="shared-spec-styles.css">`
- **No CSS variables** (`var(--primary)`, etc.) — use hardcoded hex values everywhere
- **No inline `<style>` blocks** for shared styles — only for page-specific mockup classes (e.g., phone frame styles in mobile specs)
- Available mockup classes: `.mockup-container`, `.mockup-bar`, `.mockup-dots`, `.mockup-body`, `.mock-field-label`, `.mock-field-input`, `.mock-field-select`, `.mock-highlight`, `.mock-new-badge`, `.mock-helper`, `.mock-divider`
- Scope tags: `.scope-in` (green), `.scope-out` (red), `.scope-done` (blue)
- Decision callouts: `.decision` class (yellow/amber border)
- Informational callouts: `.callout` class (blue)
- Acceptance criteria: `.ac-list` class (numbered list with checkbox styling)
- Use the Inter font via Google Fonts link

---

## 8. Release Timeline Page

All specs for a release should be consolidated into a single **release timeline page** (e.g., `release-1.32-timeline.html`). This page:

- Groups features into **phases** with dependency ordering
- Each feature is an **expandable accordion row** with columns: ID, Feature, Estimate, Status, Depends On
- Expanding a row loads the spec (and implementation plan, when available) in **tabbed iframes** — so reviewers can read every spec without bouncing between files
- Specs from other repos are loaded via a configurable base URL (`REPO_BASES` in the JS) so cross-repo specs render correctly on GitHub Pages
- Same-repo specs use relative paths

This is the primary review interface. When creating specs for a release, ensure:
- Every spec has a corresponding row in the timeline with correct `data-spec` (and `data-plan` when available) attributes
- Dependencies between rows match the actual dependency chain in the specs
- Phase groupings reflect the build order (foundations first, dependent features later)
- Status tags are kept current (BLOCKED, READY, IN PROGRESS, DONE)

---

## Appendix: Implementation Plan Reference

> **Note:** Implementation plans are created by a developer after reviewing the approved spec. The following is included as reference so the spec author understands what the developer will need, and can ensure the spec provides sufficient detail.

### What the developer needs from your spec to build the plan

1. **Accurate data model** — correct Prisma syntax, correct conventions, correct relations. The developer will turn this into migration SQL, modelFields, and GraphQL types.
2. **Clear scope boundaries** — what's new vs what exists. The developer needs to know which files to create vs modify.
3. **API surface** — queries and mutations with their signatures. The developer will write the resolver implementations.
4. **Change surface** — every file that will be touched. The developer uses this as their task list.
5. **Acceptance criteria** — testable behaviors that become the verification checklist.

### What the developer will add that you don't need to

- Full code snippets (Prisma, TypeScript, GraphQL, React components)
- Exact line numbers and file references
- Step-by-step implementation order
- Registration reminders (schema.ts registrations)
- Migration SQL
- Verification checklist
- Files summary table with action types (CREATE/MODIFY)
