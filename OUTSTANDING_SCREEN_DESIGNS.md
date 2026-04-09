# Outstanding Screen Designs — Requirements Reference

> **57 screens** across all work packages that need mockup designs before implementation.
> This document serves as the design brief for each screen, derived from deep research of every UIS spec.

---

## Design Rule Compliance — Known Issues

> **User-First Time & Labor Allocation Rule**: All time/labor records must reference individual users (`userId`). Trade classification is a filter/display attribute on users, never a standalone dimension. `qtyOfWorkers` must be derived from `COUNT(DISTINCT userId)`, not a standalone scalar.

### WO-2 Labor Line Item Model — VIOLATES User-First Rule

The `WorkOrderLaborItem` model as currently spec'd has `tradeLevelRateId` + `qtyOfWorkers` but **no `userId`**. The UI flow lets a foreman enter "3 Journeymen, 8 hours" without specifying which workers. This breaks the timesheet rollup chain and prevents user-specific rate resolution.

**Affected screens:** WO-2-01, WO-3a-01, WO-7-01, WO-7-02, WO-8-01, plus all already-designed WO-3 mockups.

**To comply, the design must:**
1. Add a `WorkOrderLaborItemWorker` join table linking each labor line to specific `userId` records
2. Replace the `qtyOfWorkers` numeric input with a **worker picker** (search/select actual users)
3. Derive `qtyOfWorkers` as `COUNT(DISTINCT WorkOrderLaborItemWorker.userId)`
4. Resolve trade level and rates from the user's `UserTradeLevel` → `TradeLevel` → `TradeLevelRate` chain, not from a direct `tradeLevelRateId` picker
5. Retain blank lines (no `tradeLevelRateId`) for ad-hoc entries, but still require user assignment

**All WO labor designs below are flagged with ⚠️ and must be redesigned with this constraint.**

---

## Table of Contents

- [Release 1.33 — LEM Track (2 screens)](#release-133--lem-track)
- [Release 1.33 — WO Track (12 screens)](#release-133--wo-track)
- [Release 1.33 — Equipment Track (13 screens)](#release-133--equipment-track)
- [Release 1.34 — MAT Track (9 screens)](#release-134--mat-track)
- [Unscheduled — Forms Track (7 screens)](#unscheduled--forms-track)
- [Unscheduled — Other (14 screens)](#unscheduled--other)

---

## Release 1.33 — LEM Track

### LEM-2-01: Equipment Category — Rate Labels Management
| | |
|---|---|
| **Work Package** | LEM-2 · Equipment Billable Rates |
| **Platform** | Desktop |
| **Type** | Form |
| **Location** | Equipment Category detail page → Rates tab, above the rate value table |

**Purpose:** Define and manage editable equipment rate type labels (e.g., Standard, Standby, Overtime, Weekend, Holiday) per equipment category. These labels form the vocabulary for all downstream rate amounts, WO line items, and invoicing.

**Data & Entities:**
- `EquipmentRateLabel`: `id`, `name`, `description`, `orderNo`, `equipmentCategoryId`
- Constraint: `@@unique([name, equipmentCategoryId])`
- Seeded defaults: Standard, Standby, Overtime, Weekend, Holiday (via `initializeEquipmentRateLabels`)

**User Interactions:**
- Add new rate label ("+ Add Rate Type" button)
- Edit existing label name/description
- Reorder labels (drag or up/down arrows by `orderNo`)
- Delete label (with confirmation if used by `EquipmentRateValue` records)
- First visit auto-seeds default labels

**Layout Guidance:**
- Sits above the shared `EquipmentRateTable` on the Rates tab
- Breadcrumb: Equipment Categories › [Category] › Rates
- "Rate Labels" management section with "+ Add Rate Type" and edit controls
- Below this section: the two-level-tab rate table (Operator Included / Equipment Only × Hourly…Yearly)

**Dependencies:** LEM-1 (parallel); Enables UIS-15H, UIS-15B, WO-2, UIS-15C, UIS-15A

**Notes:** Follows the `EmployeeAgreementRateLabel` pattern (without `isLineItem`). Labels are user-defined starting seeds, not fixed. Time windows and OT multipliers are out of scope (UIS-15C).

---

### LEM-3-01: Job Detail — Material Markup % Settings
| | |
|---|---|
| **Work Package** | LEM-3 · Material Billable Rates |
| **Platform** | Desktop |
| **Type** | Settings field |
| **Location** | Job detail page → Financial Settings / Pricing section |

**Purpose:** Tier 3 of the material charge-out cascade — a job-wide material markup percentage that overrides both MaterialGroup and Material-level markup when set. Allows per-job pricing posture for tight-margin or customer-specific scenarios.

**Data & Entities:**
- `Job.materialMarkupPercent` — nullable `Decimal(5,2)` (e.g., `25.00` = 25%)
- GraphQL: `extend type Job { materialMarkupPercent: Float }`
- When set, `resolveMaterialSellPrice` returns `source: "job"` and applies this markup before material/group defaults

**User Interactions:**
- Edit/save the Material Markup % field on the job edit flow
- Null = use material/group cascade; setting a value overrides Tier 1/2
- Validation: Decimal(5,2) range, nullable

**Layout Guidance:**
- Field in the job financial settings area (alongside other job-level pricing fields)
- Label: "Material Markup %"
- Inline with existing job edit patterns (not a separate page)

**Dependencies:** LEM-3a (backend prerequisite); LEM-1 (establishes cost vs. billable pattern); Enhanced by MAT-0, MAT-9

**Notes:** Fallback behavior — if no markup at any tier, sell price = cost (zero margin). Customer-level price lists, time-based promos, and quantity breaks are out of scope.

---

## Release 1.33 — WO Track

### WO-2-01: Labor Line Item Editor — Data Model & Fields
| | |
|---|---|
| **Work Package** | WO-2 · Line Item Tables |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Form (repeating rows) |
| **Location** | WO Create/Edit form (WO-3), Labor section |

> **⚠️ USER-FIRST VIOLATION — REDESIGN REQUIRED**: Current spec uses `tradeLevelRateId` + `qtyOfWorkers` without `userId`. Must be redesigned with a worker picker and `WorkOrderLaborItemWorker` join table. See [Design Rule Compliance](#design-rule-compliance--known-issues).

**Purpose:** Capture structured T&M labor (specific workers with their trade levels + rate labels + hours) or ad-hoc blank lines. Structured lines don't show rates on the WO — pricing happens at invoice generation (WO-7).

**Data & Entities (REVISED per User-First rule):**
- `WorkOrderLaborItem`: `jobId`, `submittedDuration` (seconds), `description`, `orderNo`
- `WorkOrderLaborItemWorker`: `workOrderLaborItemId`, `userId` — join table linking each line to specific workers
- Worker's trade level resolved via: User → `UserTradeLevel` → `TradeLevel` → `TradeLevelRate`
- `qtyOfWorkers` is **derived**: `COUNT(DISTINCT WorkOrderLaborItemWorker.userId)`
- Blank lines: free-text description, hours, manual rate — still require user assignment

**User Interactions:**
- "+ Add Labor" dropdown: Structured vs Blank
- **Worker picker**: search/select actual users (not a numeric "qty of workers" input)
- Trade level auto-resolved from selected worker's `UserTradeLevel`
- Add/edit/remove rows without page reload
- Phase 1: ordering by `orderNo` only (no drag reorder)

**Layout Guidance:**
- Repeating-row table pattern within the WO form
- Structured rows: **worker selector** (multi-select or repeated rows), auto-derived trade level, hours input
- Blank rows: description, hours, worker selector, manual rate
- Subtotals display-only (wage-based subtotals gated by `user___viewWageDetails`)

**Dependencies:** WO-1; Enables WO-3, WO-7

**Notes:** No rates or dollar totals on WO form for structured lines — pricing resolved at invoice/conversion via LEM-1 `TradeLevelRate`. Worker assignment enables timesheet rollup and payroll chain.

---

### WO-2-02: Material Line Item Editor — Data Model & Fields
| | |
|---|---|
| **Work Package** | WO-2 · Line Item Tables |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Form (repeating rows) |
| **Location** | WO Create/Edit form (WO-3), Material section |

**Purpose:** Catalog-backed or manual material rows showing sell vs cost visibility.

**Data & Entities:**
- `WorkOrderMaterialItem`: `jobId`, `materialId`, `description`, `quantity`, `unitPrice` (sell, from LEM-3, editable), `costPrice` (read-only on WO), `total` (= qty × unitPrice), `orderNo`

**User Interactions:**
- "+ Add Material" dropdown: Structured (material lookup) vs Blank (manual entry)
- Structured: auto-populates `unitPrice`/`costPrice` from `resolveMaterialSellPrice()`
- Blank: manual description, qty, prices
- Batch via `upsertWorkOrderLineItems`

**Layout Guidance:**
- Same repeating-row pattern as labor
- Columns: Material (or description), Qty, Unit Price, Cost Price (read-only), Total

**Dependencies:** WO-1, LEM-3; Enables WO-3, WO-7

---

### WO-2-03: Equipment Line Item Editor — Data Model & Fields
| | |
|---|---|
| **Work Package** | WO-2 · Line Item Tables |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Form (repeating rows) |
| **Location** | WO Create/Edit form (WO-3), Equipment section |

**Purpose:** Catalog equipment with LEM-2 rates or manual rental/ad-hoc lines.

**Data & Entities:**
- `WorkOrderEquipmentItem`: `jobId`, `equipmentId`, `equipmentRateLabelId`, `per` (EquipmentRatePer), `operatorIncluded`, `isFullDayBilling`, `submittedDuration` (seconds), `quantity`, `description`, `orderNo`
- Blank lines: `unitRate`, description, qty, manual rate

**User Interactions:**
- "+ Add Equipment" dropdown: Structured (equipment + rate label + billing options) vs Blank
- Same upsert batch pattern as labor/material

**Layout Guidance:**
- Identical UX pattern to labor/material repeating rows
- Columns: Equipment, Rate Type, Duration/Qty, Billing Type

**Dependencies:** WO-1, LEM-2; Enables WO-3, WO-7

**Notes:** Structured rates resolved at invoice/conversion via LEM-2 `resolveEquipmentRate`; no separate rate-management UI for WO.

---

### WO-3a-01: Job DataModelForm — WO Fields (DAA Configuration)
| | |
|---|---|
| **Work Package** | WO-3a · Schema & Form Foundation |
| **Platform** | Desktop |
| **Type** | Form configuration |
| **Location** | WO Create/Edit flow — DAA-driven form layout |

> **⚠️ Inherits USER-FIRST violation from WO-2**: The `wo-labor-items` DAA custom renderer must use a worker picker (not `qtyOfWorkers` numeric input) and resolve trade levels from selected users.

**Purpose:** Gate WO-only fields and position custom blocks (date, L/M/E editors, signatures) using the `DocumentAttributeAssignment` system with `subModel="WorkOrder"`.

**Data & Entities:**
- `DocumentAttributeAssignment` with `referenceModel="Job"`, `subModel="WorkOrder"`
- WO-only DAAs: `wo-date-of-work` → `Job.dateOfWork`, `wo-labor-items` (worker picker), `wo-material-items`, `wo-equipment-items`, `wo-signatures` (all custom render)
- Shared job DAAs: `job-number`, `job-name`, `job-description`, `job-rate-type`, `job-wage-region`, `job-purchase-order`, `job-status`

**User Interactions:**
- `renderChild` switch on `defaultAttribute` for custom renderers
- `job-type` filtered by classification (no cross-class switch)
- Transactional save: Draft/Submit collects job + line items + signatures in one flow

**Layout Guidance:**
- Sections: Work Order Info → Labor → Materials → Equipment → Signatures
- Subtotals inside line editors (WO-3b), not separate DAA rows
- Subtotals display-only, wage-based subtotals gated by `user___viewWageDetails`

**Dependencies:** WO-1, WO-2, PR #6831 (DataModel)

**Notes:** No comma-delimited `subModel` — use separate DAA records per value. WO classification triggers WO-prefixed job numbering.

---

### WO-3d-01: WO Settings — Detail/Settings/Forms/Custom Properties
| | |
|---|---|
| **Work Package** | WO-3d · WO Property Settings |
| **Platform** | Desktop |
| **Type** | Settings (multi-tab) |
| **Location** | Property Settings → Entity Dropdown → "Work Orders" (new entry) |

**Purpose:** Admin-configure WO layouts, forms, custom fields, and `workOrderStatus` defaults separately from project jobs.

**Data & Entities:**
- `PropertyValue` with `workOrderStatus` vs `jobStatus`
- DAAs/sections scoped `subModel="WorkOrder"`
- Existing `Job`-referenced settings patterns

**User Interactions:**
- Sub-tabs via `DataModelSettingsTabs`:
  - **Detail View Layout** (`DocumentSectionLayoutBuilder`)
  - **Settings View Layout**
  - **Manage Forms** (`DataModelFormBuilderWrapper`)
  - **Custom Properties** (`DocumentAttributes`)
  - **Default Properties** (`PropertyValues` + `DefaultDocumentAttributesTable`) — shows `workOrderStatus` management (add/reorder/rename/color)

**Layout Guidance:**
- Top-level Property Settings dropdown adds: Projects, Jobs, **Work Orders (NEW)**, Companies, …
- Jobs tab gets `subModel="ProjectJob"` + `propertyNameFilter`
- Default Properties shows WO status table (Draft → Void)

**Dependencies:** WO-1 (classification + seeded WO statuses), WO-3a (DAA WorkOrder)

---

### WO-4-01: WO Detail — Invoices Tab
| | |
|---|---|
| **Work Package** | WO-4 · Work Order Detail Page |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | WO Detail page → Invoices tab |

**Purpose:** Show bills generated from this WO. Read-only list; invoice creation is via WO-7 header action.

**Data & Entities:**
- Reuse `JobBillList` component, filtered to job
- Columns: Invoice #, Date, Status, Total

**User Interactions:**
- Read-only list; row click → bill detail
- No "Create Invoice" button on this tab (creation via header "Generate Invoice" per WO-7)

**Layout Guidance:**
- Tab alongside: Overview, Files, Settings
- Standard list table pattern

**Dependencies:** WO-2, WO-3a/b/c/d, WO-7

---

### WO-4-02: WO Detail — Settings Tab
| | |
|---|---|
| **Work Package** | WO-4 · Work Order Detail Page |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | WO Detail page → Settings tab |

**Purpose:** WO-specific settings panel driven by data model configuration.

**Data & Entities:**
- `DataModelSettings` with `subModel="WorkOrder"`

**User Interactions:**
- Standard settings UX for configured WO layout

**Layout Guidance:**
- Fourth tab: Overview, Invoices, Files, **Settings**
- Must respect DAA/section scoping for WorkOrder subModel

**Dependencies:** WO-3d (admin-defined WO settings layout)

---

### WO-4-03: Work Order PDF Template
| | |
|---|---|
| **Work Package** | WO-4 · Work Order Detail Page |
| **Platform** | Desktop |
| **Type** | PDF |
| **Location** | WO Detail → Print PDF header action |

**Purpose:** Printable T&M document with toggleable sections, same `ObjectDownloadTemplate` config pattern as other entities.

**Data & Entities:**
- `ObjectDownloadTemplate` linked to WO DAAs
- `Job`, line items, `Signature` data
- PDF pipeline: `/api/pdf-export`, `@useanzen/pdf-worker`

**User Interactions:**
- Admin configures visible fields/sections in Property Settings
- User clicks "Print PDF" from WO detail header

**Layout Guidance — PDF Sections:**
- **`wo-labor-items`**: table — Description | Workers | Hours | Rate (if permitted) + subtotal
- **`wo-material-items`**: table — Material | Qty | UoM | Unit Cost | Total + subtotal
- **`wo-equipment-items`**: table — Equipment | Rate Type | Duration + subtotal
- **`wo-signatures`**: signature images + name, date/time, GPS coordinates

**Dependencies:** WO-2/3 for data; migration seeds template

**Notes:** Extends existing Job PDF pipeline with custom LEM section renderers.

---

### WO-5-01: Work Orders — Kanban View
| | |
|---|---|
| **Work Package** | WO-5 · T&M Work Order Log |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | /work-orders → Kanban toggle |

**Purpose:** Dedicated WO home page with both list and Kanban views; reuses Jobs list infrastructure with classification + WO status set.

**Data & Entities:**
- `Job` filtered to `jobClassification = WorkOrder`
- Kanban columns from `workOrderStatus` `PropertyValues`
- Board mutations: `updateCardOrder`, `upsertManyBoardCards`

**User Interactions:**
- Search, filters, CSV export, archive/delete/restore
- Inline status updates
- Kanban drag-and-drop between status columns
- Flyout create/edit, links to `/work-orders/[id]`

**Layout Guidance:**
- Sidebar: "Work Orders" menu item (after Jobs)
- Page mirrors Jobs list header (e.g., "+ New Work Order")
- `ListTableViews` with `referenceModel="Job"`, `subModel="Job"`, `subModelForSave="WorkOrder"`
- Toggle between Table and Kanban views

**Dependencies:** WO-1 (classification, WO statuses, Board tableConfiguration, SQL view column)

**Notes:** No new backend needed for WO-5 itself; `statusPropertyName` for WO list uses `"workOrderStatus"`.

---

### WO-7-01: WO Conversion Confirmation Modal
| | |
|---|---|
| **Work Package** | WO-7 · WO to Invoice/CO Conversion |
| **Platform** | Desktop |
| **Type** | Modal |
| **Location** | WO Detail header → "Generate Invoice" or "Convert to CO" action |

> **⚠️ Inherits USER-FIRST violation from WO-2**: Conversion logic currently uses `qtyOfWorkers` scalar. Must be updated to derive worker count and rates from `WorkOrderLaborItemWorker` join table.

**Purpose:** Confirmation step before executing invoice generation or change order conversion mutations.

**Data & Entities:**
- Derived display: line item count, total value (labor totals derived from user-linked worker records)
- Mutations: `generateInvoiceFromWorkOrder` or `convertWorkOrderToChangeOrder`

**User Interactions:**
- Confirm / Cancel
- On confirm → mutation → navigate to `JobBill` or `EstimateChangeOrderRecord` detail
- Post invoice: WO → Invoiced, Generate Invoice disabled
- Post CO: WO stays Approved, "Converted to CO #…" badge, Convert to CO disabled once
- Both conversions allowed in either order

**Layout Guidance:**
- Standard confirmation modal with summary of what will be generated
- Triggered from WO detail header when status = Approved

**Dependencies:** WO-4 header hooks, WO-2 line data, LEM-1/2/3, UIS-15B

---

### WO-7-02: Change Order Detail — WO-generated CO Layout
| | |
|---|---|
| **Work Package** | WO-7 · WO to Invoice/CO Conversion |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | `EstimateChangeOrderDetails` — fallback layout when `accountItemId` is null |

> **⚠️ Inherits USER-FIRST violation from WO-2**: CO rows created from WO labor must derive hours and rates from user-linked worker records.

**Purpose:** Show CO lines created from a WO without account hierarchy (flat list instead of grouped by account).

**Data & Entities:**
- `EstimateChangeOrderRecord` + `EstimateChangeOrderRecordValue`
- `accountItemId` is optional/nullable for WO-generated COs
- Flat rows: description, estimate ($), numeric (hours derived from user-linked labor records)

**User Interactions:**
- Read CO as usual; conditional rendering: hierarchy vs flat rows when no `accountItemId`

**Layout Guidance:**
- Same CO detail route; flat list replaces account grouping when `accountItemId` is null

**Dependencies:** Prisma migration (nullable `accountItemId`), API `convertWorkOrderToChangeOrder`

**Notes:** Equipment numeric field — spec allows hours equivalent or 0 to avoid confusion. Open product question on CO business use cases (Corey/Chris).

---

### WO-8-01: Mobile WO — Preview Tag (PDF)
| | |
|---|---|
| **Work Package** | WO-8 · Mobile WO List, Detail & Creation |
| **Platform** | Mobile |
| **Type** | PDF preview |
| **Location** | Mobile WO Creation → Step 5 Summary → "Preview Tag (PDF)" button |

> **⚠️ Inherits USER-FIRST violation from WO-2**: PDF rendering currently uses `qtyOfWorkers` scalar. Must reflect actual assigned workers from `WorkOrderLaborItemWorker`.

**Purpose:** In-app preview of final T&M tag as formatted PDF before signature collection (Clearstory parity).

**Data & Entities:**
- `previewWorkOrderPdf` query — generates preview PDF URL
- Built on WO record + line items (labor items include user-linked worker assignments) + configured template

**User Interactions:**
- Tap "Preview Tag (PDF)" on Summary step → in-app PDF preview
- Separate action from "Prepare Signatures"

**Layout Guidance:**
- Step 5 Summary CTA row: Preview Tag (PDF) (outline button), Prepare Signatures (success button), Previous Step
- Component: `apps/mobile/.../PdfPreview.tsx`

**Dependencies:** WO-1, WO-2, WO-3

---

## Release 1.33 — Equipment Track

### UIS-15A-01: Financial Summary — CSV & PDF Export
| | |
|---|---|
| **Work Package** | UIS-15A · Equipment Job P&L |
| **Platform** | Desktop |
| **Type** | PDF/CSV export |
| **Location** | Job Financial Summary → Export controls |

**Purpose:** Include equipment data in job financial summary exports so estimate vs actual reflects approved equipment time and GL mapping.

**Data & Entities:**
- `FinancialSummaryFeed` / `FinancialSummaryFeedRecord` with `equipmentHoursAsSeconds`, `equipmentCost`
- `EquipmentCategory.accountItemId` → `AccountItem` for GL mapping
- Equipment Breakdown query: `equipmentJobBreakdown(jobId)` with `reportType: "equipment-breakdown"`

**User Interactions:**
- View Financial Summary with Equipment section
- CSV and PDF export includes equipment data

**Layout Guidance:**
- Multi-column grid like existing summary (Estimates / CO / Total / Actual / Difference)
- Equipment Breakdown: table grouped by category with subtotals and grand total

**Dependencies:** LEM-2, UIS-15H; Enables UIS-15B

---

### UIS-15B-01: Job Billing — Create Equipment Invoice
| | |
|---|---|
| **Work Package** | UIS-15B · Equipment Invoicing |
| **Platform** | Desktop |
| **Type** | Tab + Modal |
| **Location** | Job Detail → Billing tab → "Create Equipment Invoice" |

**Purpose:** Bill approved equipment time on Simple `JobBill`s; prevent double billing via `JobBillLineItem.equipmentTimeSheetRecordValueId`.

**Data & Entities:**
- `EquipmentTimeSheetRecordValue`, `JobBill`, `JobBillLineItem`
- Queries: `unbilledEquipmentTimeEntries`, mutation: `generateEquipmentInvoice`

**User Interactions:**
- "Create Equipment Invoice" button with unbilled count badge
- Opens Time Entry Selection modal: checkboxes, date filter, footer total, Generate Invoice
- Post-create: navigate to bill detail

**Layout Guidance:**
- Modal table: Checkbox | Date | Equipment | Rate Type | Per | Billing | Logged | Qty | Rate | Amount

**Dependencies:** LEM-2, UIS-15H, UIS-15A

---

### UIS-15B-02: Equipment Detail — Invoicing Tab
| | |
|---|---|
| **Work Package** | UIS-15B · Equipment Invoicing |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | Equipment Detail → Invoicing tab |

**Purpose:** Invoice history for line items tied to this equipment's time entries; cross-job invoicing entry point.

**Data & Entities:**
- Same as above, filtered by equipment
- Queries: `jobsWithUnbilledEquipmentTime`

**User Interactions:**
- View invoice history
- "Create Invoice" → Job Selection modal → Time Entry Selection modal (filtered by job + equipment)

**Layout Guidance:**
- Tab on Equipment detail; job picker table: Job | Entries | Amount

**Dependencies:** Same as UIS-15B-01

---

### UIS-15C-01: New Rate Schedule Form
| | |
|---|---|
| **Work Package** | UIS-15C · Equipment Variable Rates |
| **Platform** | Desktop |
| **Type** | Form |
| **Location** | Equipment Rates UI → Schedule dropdown → "+ New Rate Schedule" |

**Purpose:** Version rate schedules with future effective dates; copies rates from current selection.

**Data & Entities:**
- `EquipmentRateSchedule`: name, effectiveDate
- `EquipmentRateValue` (duplicated via `duplicateRateValuesForNewSchedule`)

**User Interactions:**
- Form fields: Name + Effective Date
- On create: copy rates from currently selected schedule
- Active badge on schedule effective for today

**Layout Guidance:**
- Toolbar above `EquipmentRateTable`: schedule dropdown + green "+ New Rate Schedule" button
- Form can be inline or flyout

**Dependencies:** LEM-2; Enables UIS-15A, UIS-15B

---

### UIS-15C-02: Time Window Configuration
| | |
|---|---|
| **Work Package** | UIS-15C · Equipment Variable Rates |
| **Platform** | Desktop |
| **Type** | Settings |
| **Location** | Instance Settings or Equipment Settings |

**Purpose:** Configure company-wide standard/OT time windows for equipment rate resolution.

**Data & Entities:**
- Option A (v1): `Instance` fields: `equipmentStandardWorkStartHour`, `equipmentStandardWorkEndHour`, `equipmentWeekendDays`
- Option B (future): `EquipmentRateWindow` per Instance/Job
- `EquipmentCategory` may get `overtimeMultiplier`

**User Interactions:**
- Set standard work start/end hours
- Define weekend days
- Simple form with save

**Layout Guidance:**
- Small settings form; company-wide first, per-job override documented as follow-on

**Dependencies:** LEM-2

---

### UIS-15D-01: Flyout — Maintenance Log Entry
| | |
|---|---|
| **Work Package** | UIS-15D · Equipment Maintenance Triggers |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Equipment Detail → Maintenance tab → "Log Service" action |

**Purpose:** Record a maintenance service event; resets baseline hours/date for that maintenance type.

**Data & Entities:**
- `MaintenanceLog`: `equipmentId`, `maintenanceTypeId`, `date`, `technicianName`, `cost`, `secondsAtService`
- Notes via `NoteReferences` / `NoteFeed` (not plain text field)

**User Interactions:**
- Create service record with date, technician, cost, current hours
- Attach notes/files via NoteFeed
- On save: resets threshold baseline for that maintenance type

**Layout Guidance:**
- Standard flyout form pattern
- Fields: Maintenance Type (dropdown), Date, Technician Name, Cost, Hours at Service, Notes

**Dependencies:** UIS-15H (hour meter data); Enables UIS-15G

---

### UIS-15D-02: Flyout — Maintenance Threshold Create/Edit
| | |
|---|---|
| **Work Package** | UIS-15D · Equipment Maintenance Triggers |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Equipment Category → Maintenance Thresholds section → "+ Add Threshold" / Edit |

**Purpose:** Configure hour-based or calendar-based maintenance thresholds with warning windows.

**Data & Entities:**
- `MaintenanceThreshold`: polymorphic (`EquipmentCategory` / `Equipment`), `MaintenanceThresholdType` (Hours/Calendar), `intervalSeconds`, `warningSeconds`, `maintenanceTypeId` → `PropertyValue`, `isActive`

**User Interactions:**
- Create/edit: maintenance type, threshold type (hours or calendar), interval, warning window, active toggle
- Category grid also has "+ Add Threshold" / Edit inline

**Layout Guidance:**
- Flyout form; category page can inline expand "Add/Edit Threshold"
- Fields: Maintenance Type, Threshold Type (Hours/Days toggle), Interval, Warning Window, Active

**Dependencies:** UIS-15H for hour meter; Enables UIS-15G, UIS-15E (status badge)

**Notes:** No log for a type → OVERDUE status; overall equipment status = worst across thresholds.

---

### UIS-15E-01: Desktop Equipment Detail — Generate QR Code
| | |
|---|---|
| **Work Package** | UIS-15E · Equipment Search & Mobile QoL |
| **Platform** | Desktop |
| **Type** | Modal |
| **Location** | Equipment Detail page → "Generate QR Code" button |

**Purpose:** Generate a printable/downloadable QR code encoding the mobile equipment detail URL for field scanning.

**Data & Entities:**
- URL: `https://{instance}.useappello.app/equipment/{equipmentId}`
- No stored `qrCode` field — generated dynamically

**User Interactions:**
- Click "Generate QR Code" → Modal with QR preview
- Print or download QR image

**Layout Guidance:**
- Button on equipment detail header/action bar
- Modal with: QR image (large), equipment name/ID, Print button, Download button

**Dependencies:** None for QR encoding; mobile scanner depends on UIS-15D/15G/15H/15F

---

### UIS-15G-01: Flyout — Schedule / Template Editing
| | |
|---|---|
| **Work Package** | UIS-15G · Equipment Maintenance Scheduling |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Maintenance Calendar → Schedule item → Edit |

**Purpose:** Create/update maintenance schedule instances; configure assignee, linked forms, and completion flow.

**Data & Entities:**
- `MaintenanceSchedule`: equipment, type, `scheduledDate`, `projectedDate`, status, assignee, `formWrapperId`
- Links to `MaintenanceThreshold` / `MaintenanceLog`

**User Interactions:**
- Create/edit schedule: date, assignee, linked form, notes
- Complete flow: creates `MaintenanceLog`, may auto-schedule next instance
- Optional downtime checkbox on complete
- Reschedule / Cancel actions

**Layout Guidance:**
- Flyout form; calendar/report routes are full pages
- Fields: Equipment, Maintenance Type, Scheduled Date, Assignee, Linked Form, Notes

**Dependencies:** UIS-15D (thresholds and maintenance types)

**Notes:** `MaintenanceScheduleTemplate` removed (B4) — tie checklists via `MaintenanceThreshold.formWrapperId`.

---

### UIS-15G-02: Equipment Detail — Record Downtime
| | |
|---|---|
| **Work Package** | UIS-15G · Equipment Maintenance Scheduling |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Equipment Detail → Maintenance context → "Record Downtime" |

**Purpose:** Record equipment downtime events with reason, optional job link, and cost tracking via expenses.

**Data & Entities:**
- `DowntimeRecord`: `startDate`, `endDate`, `reason`, optional `jobId`, expenses via `Expense.downtimeRecordId`

**User Interactions:**
- Start downtime: reason, optional job
- Close downtime: set `endDate`
- Costs via linked expenses

**Layout Guidance:**
- Flyout form
- Fields: Start Date, End Date (nullable = still down), Reason, Job (optional), Notes

**Dependencies:** UIS-15D

---

### UIS-15G-03: Compliance Dashboard
| | |
|---|---|
| **Work Package** | UIS-15G · Equipment Maintenance Scheduling |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | Equipment → Maintenance → Compliance Dashboard |

**Purpose:** Show overdue vs on-time completion rate by equipment category for the current quarter.

**Data & Entities:**
- Aggregate: scheduled vs completed vs overdue maintenance by category
- Time period: current quarter

**User Interactions:**
- View dashboard; filter by category or time period

**Layout Guidance:**
- Dashboard with stat cards, completion rate charts, category breakdown table
- Color coding: green (on-time), red (overdue), amber (upcoming)

**Dependencies:** UIS-15D, UIS-15G schedules

---

### UIS-15H-01: Timesheet Approval — Equipment Rollup
| | |
|---|---|
| **Work Package** | UIS-15H · Equipment Timesheet Capture |
| **Platform** | Desktop |
| **Type** | Modal/Tooltip |
| **Location** | Timesheet Approval Grid → "Equip. Hrs" column → Hover/Click |

**Purpose:** Approvers see weekly equipment totals and per-equipment/per-day drilldown.

**Data & Entities:**
- `EquipmentTimeSheetRecordValue` (`approvedDuration` / `submittedDuration`)
- `timeSheetListFeedSummaryDetails` extension for tooltip data

**User Interactions:**
- Hover/click on Equip. Hrs column value → shows weekly equipment rollup
- Table: Equipment | Mon–Sun | Total, grouped by rate type

**Layout Guidance:**
- Component: `EquipmentHoursTooltip.tsx`
- Wide enough for 7 day columns + equipment names
- Spec describes as tooltip; could be modal if product prefers

**Dependencies:** LEM-2; Permission: `timeSheetRecord___logEquipmentTime` for entry, `timeSheetRecord___approveTimesheet` for approval

---

### UIS-15H-02: Timesheet Approval Grid — Equip Hours Column
| | |
|---|---|
| **Work Package** | UIS-15H · Equipment Timesheet Capture |
| **Platform** | Desktop |
| **Type** | Page (column addition) |
| **Location** | Timesheet Approval Grid |

**Purpose:** New "Equip. Hrs" column showing weekly total per user alongside existing labor hours.

**Data & Entities:**
- Weekly total from `EquipmentTimeSheetRecordValue`
- Separate from labor totals in daily tooltip

**User Interactions:**
- View numeric value; hover opens rollup tooltip (UIS-15H-01)

**Layout Guidance:**
- New column in approval grid after labor hours
- Numeric display; hover triggers `EquipmentHoursTooltip`

**Dependencies:** LEM-2, UIS-15H entry side

**Notes:** Approval still sets `equipmentRateScheduleId` snapshot on all equipment rows.

---

## Release 1.34 — MAT Track

### MAT-1-01: Customer PO Detail — Line Items Tab
| | |
|---|---|
| **Work Package** | MAT-1 · Customer PO Entity |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | /purchase-orders/[id] → Line Items tab |

**Purpose:** View and manage the line structure of a customer PO with quantity × unitPrice economics and optional cost coding.

**Data & Entities:**
- `PurchaseOrderLineItem`: `description`, `quantity`, `unitPrice`, `total` (resolver-computed), `accountItemId`, `costCodeId`, `sortOrder`
- Relations: `AccountItem`, `CostCode`
- Mutation: `upsertPurchaseOrderLineItems(purchaseOrderId, items)`

**User Interactions:**
- View, add, edit, delete line items
- Sortable rows by `sortOrder`

**Layout Guidance:**
- Tab on PO detail alongside Overview, Invoices, Estimates, Files
- Table: Description | Qty | Unit Price | Total | Account | Cost Code
- Inline editing or flyout per row

**Dependencies:** MAT-1 migration + GraphQL; Enables MAT-5 (shared PO model)

**Notes:** `total` is resolver-computed only (not stored). Mobile PO management is out of scope.

---

### MAT-1-02: Customer PO Detail — Invoices Tab
| | |
|---|---|
| **Work Package** | MAT-1 · Customer PO Entity |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | /purchase-orders/[id] → Invoices tab |

**Purpose:** Show which invoices are tied to this customer PO for audit trail.

**Data & Entities:**
- Reverse listing: invoices referencing this PO
- Single PO on job → auto-select on invoice; multiple POs → user selects

**User Interactions:**
- Read-only list of linked invoices
- Row click → invoice detail

**Layout Guidance:**
- Standard list table: Invoice # | Date | Amount | Status

**Dependencies:** Invoice model must reference PO; MAT-1 migration

---

### MAT-1-03: Customer PO Detail — Estimates/COs Tab
| | |
|---|---|
| **Work Package** | MAT-1 · Customer PO Entity |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | /purchase-orders/[id] → Estimates tab |

**Purpose:** Trace estimates and change orders linked to this PO (multi-PO per job/CO scenario).

**Data & Entities:**
- `PurchaseOrder` → linked `Job` → `EstimateChangeOrder` relationships

**User Interactions:**
- Read-only list of linked estimates/COs
- Row click → estimate/CO detail

**Layout Guidance:**
- Standard list table: Estimate/CO # | Job | Amount | Status

**Dependencies:** MAT-1 migration from `Job.purchaseOrder` string

---

### MAT-1-04: Customer PO Detail — Files Tab
| | |
|---|---|
| **Work Package** | MAT-1 · Customer PO Entity |
| **Platform** | Desktop |
| **Type** | Tab |
| **Location** | /purchase-orders/[id] → Files tab |

**Purpose:** Audit trail — attach and view files (PDF copies of POs, contracts, etc.).

**Data & Entities:**
- Standard file/attachment pattern (not specified in detail in spec)

**User Interactions:**
- Upload, view, download files
- Standard file management CRUD

**Layout Guidance:**
- Tab on PO detail; follow existing file attachment patterns from Jobs/Companies

**Dependencies:** Existing Appello file/attachment infrastructure

**Notes:** No PO notifications at this stage. Permissions: users need appropriate rights to view/create/edit POs.

---

### MAT-3-01: Supplier Detail — Price Comparison View
| | |
|---|---|
| **Work Package** | MAT-3 · Price Book Import |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | Supplier (vendor) detail page → Pricing section |

**Purpose:** Persistent side-by-side old vs new pricing for a supplier so operators see what changed after price book imports.

**Data & Entities:**
- `PriceBookImport` (history), `Material.sku`
- `ManufacturerProduct` + `DistributorPrice`
- Comparison rows: SKU, product name, old price, new price, status (UPDATED/NEW/error)

**User Interactions:**
- Read-heavy view of price changes
- Link to import history (`priceBookImports`)
- Filter/search by SKU or product name

**Layout Guidance:**
- On supplier detail page (not the import wizard)
- Table: SKU | Product | Old Price | New Price | Change % | Status
- Status badges: UPDATED (blue), NEW (green), ERROR (red)

**Dependencies:** MAT-0 (ManufacturerProduct + DistributorPrice); Enables MAT-9

**Notes:** Out of scope: EDI/API feeds, scheduled imports, export. Permission: `material.create` to start import.

---

### MAT-7-01: Transfer Between Locations Form
| | |
|---|---|
| **Work Package** | MAT-7 · Inventory Management |
| **Platform** | Desktop |
| **Type** | Form |
| **Location** | Inventory Location Detail → "Transfer" action |

**Purpose:** Move stock between two inventory locations with an audit trail (Transfer movements).

**Data & Entities:**
- `TransferInput`: `fromLocationId`, `toLocationId`, `materialId`, `quantity`, `notes`
- Creates two linked `InventoryMovement` records (out from source, in to destination)

**User Interactions:**
- Select destination location, material, quantity
- Validation: quantity cannot exceed `quantityOnHand` at source (server-side)
- Submit → `transferBetweenLocations` mutation

**Layout Guidance:**
- Flyout or modal from Location detail
- Fields: From Location (pre-filled), To Location (dropdown), Material (search), Quantity, Notes
- Component: `TransferForm.tsx`

**Dependencies:** MAT-6 (receiving feeds Receive movements); Enables MAT-8 (Return movements)

**Notes:** Movement ledger is append-only; soft-delete only. Permissions: `inventory.view` / `create` / `edit` / `delete`. Out of scope: bin/shelf sub-locations, lot/serial, MUOM conversions.

---

### MAT-7-02: Physical Count Adjustment Form
| | |
|---|---|
| **Work Package** | MAT-7 · Inventory Management |
| **Platform** | Desktop |
| **Type** | Form |
| **Location** | Inventory Location Detail → "Adjust" action |

**Purpose:** Correct on-hand quantity to physical count via signed adjustment.

**Data & Entities:**
- `AdjustmentInput`: `locationId`, `materialId`, `quantity` (signed +/-), `notes`
- Creates `InventoryMovement` type `Adjustment`
- Updates `quantityOnHand` via `InventoryStockLevel` SQL view

**User Interactions:**
- Select material, enter signed quantity (+/-), notes
- Submit → `adjustInventory` mutation

**Layout Guidance:**
- Flyout or modal from Location detail
- Fields: Material (search), Current Qty (display), Adjustment (+/-), New Qty (calculated preview), Notes
- Component: `AdjustmentForm.tsx`

**Dependencies:** `InventoryStockLevel` SQL view; MAT-6 for baseline receives

---

### MAT-7-03: Mobile — QR Stock Check
| | |
|---|---|
| **Work Package** | MAT-7 · Inventory Management |
| **Platform** | Mobile |
| **Type** | Page |
| **Location** | Mobile → Inventory → QR Scan |

**Purpose:** Field users scan a location QR code to view stock levels without navigating the full desktop UI.

**Data & Entities:**
- `InventoryLocation`, `InventoryItem` / `InventoryStockLevel`, `Material`
- Queries: `stockLevels(locationId)`, `inventoryItems(locationId)`

**User Interactions:**
- Scan QR → view stock levels (read-only)
- Pattern follows UIS-15E (QR) referenced in spec

**Layout Guidance:**
- Mobile page: `apps/mobile/src/pages/inventory/`
- QR scanner → Location header + stock level list

**Dependencies:** QR infrastructure (UIS-15E pattern)

**Notes:** Barcode label printing is out of scope.

---

### MAT-8-01: Credit Memo PDF
| | |
|---|---|
| **Work Package** | MAT-8 · Vendor Credits & Returns |
| **Platform** | Desktop |
| **Type** | PDF |
| **Location** | Vendor Credit Detail → Generate/Download |

**Purpose:** Generate a supplier-facing credit memo for AP reconciliation and records.

**Data & Entities:**
- `VendorCredit`: `creditNumber` (VC-####), Supplier (Company), `PurchaseOrder`, optional Job, `reasonId` (PropertyValue), `status`, `amount`, `notes`
- `VendorCreditLineItem`: `purchaseOrderLineItemId`, `description`, `quantity`, `unitPrice`, `total` (computed)
- Reason seeds: Return, Damaged, Overpayment, Short Shipment, Price Adjustment

**User Interactions:**
- Generate and download from credit detail page

**Layout Guidance — PDF Sections:**
- Header: Company logo, Credit Memo #, Date, Supplier info
- Lines table: Description | Qty | Unit Price | Total
- Reason, Notes, Status
- Footer: Total credit amount

**Dependencies:** MAT-5 (Supplier PO), MAT-7 (Return movement when reason is Return)

**Notes:** Out of scope: QBO vendor credit sync, applying credit to future POs, mobile credit entry. On approve with Return reason → outbound `InventoryMovement` type `Return`.

---

## Unscheduled — Forms Track

### UIS-F01-01: Question Add/Edit Flyout
| | |
|---|---|
| **Work Package** | UIS-F01 · Form Builder UX |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Form Builder → Question row → Edit (or + Add Question) |

**Purpose:** Edit or add safety form questions with full configuration including conditional logic labels.

**Data & Entities:**
- `GqlQuestion` inside `IFormTreeQuestion` tree
- `ConditionalQuestionType` config: `continueLabel` / `skipLabel` mapped to human labels (IF YES/NO → SHOW/SKIP)

**User Interactions:**
- Open from builder row (Edit) or toolbar (+ Add Question)
- Configure question text, type, required flag, conditional logic
- Save/cancel

**Layout Guidance:**
- Component: `QuestionnaireAddEditForm.tsx` — flyout
- Fields: Question text, Type selector, Required toggle, Conditional section

**Dependencies:** `QuestionnaireListForm`, `QuestionnaireDragItem`, `FormVersion`

**Notes:** Max nesting: one section level (depth 2). Old versions read-only. Related ticket: Q21030-10425.

---

### UIS-F03-01: HIRA Category/Hazard/Control CRUD Flyouts
| | |
|---|---|
| **Work Package** | UIS-F03 · Risk Assessment (HIRA) |
| **Platform** | Desktop |
| **Type** | Flyout (set of 3) |
| **Location** | Settings → HIRA Library (`hira.tsx`) |

**Purpose:** Admin library for RACategory, RAHazard, RAControl backing structured HIRA on risk assessment questions.

**Data & Entities:**
- `RACategory`: name, description, sortOrder
- `RAHazard`: name, description, severity (1–5), defaultLikelihood (1–5), category link
- `RAControl`: name, description, HoC level, many-to-many hazard link

**User Interactions:**
- **Category flyout**: add/edit/archive, reorder
- **Hazard flyout**: add/edit with name, description, severity, defaultLikelihood
- **Control flyout**: add/edit, link/unlink to hazards

**Layout Guidance:**
- Three-panel page: category sidebar | hazard list | control panel
- `useFlyout` for forms; loading/error/empty states on all panels
- Severity/HoC badges on list items

**Dependencies:** Route + nav with `form: { manage: true }`; Q21030-7275 (data model + admin UI). Wizard HIRA mode (Q21030-7280) consumes this library.

**Notes:** Optional mode: `raConfig.useHIRA`; legacy free-text preserved when off.

---

### UIS-F04-01: Flag Rule Create/Edit Flyout
| | |
|---|---|
| **Work Package** | UIS-F04 · Compliance & Notifications |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Form Compliance Settings → Flag Rules tab → Add/Edit |

**Purpose:** Configure auto-flag rules that evaluate form answers post-submit and create FeedbackFlags.

**Data & Entities:**
- `FlagRule`: linked to form questions; condition types: equals, notEquals, gte, lte, contains
- Actions: FLAG ONLY vs FLAG + NOTIFY
- `FlagRuleInput`, optional `existingRule`

**User Interactions:**
- Build rule: question dropdown, condition builder, action toggle
- Save/cancel
- Orphaned rules if question deleted (warning badge, rule inert)

**Layout Guidance:**
- Flyout from Flag Rules tab
- Fields: Question (dropdown), Condition Type (dropdown), Value, Action (toggle)
- Component: `FlagRuleBuilder.tsx`

**Dependencies:** UIS-F02 (conditional `evaluateCondition()` primitive); `formCompliance.graphql`

---

### UIS-F05-01: Form Submission Detail — Mobile
| | |
|---|---|
| **Work Package** | UIS-F05 · Form Inbox & Reporting |
| **Platform** | Mobile |
| **Type** | Page |
| **Location** | Mobile Form Inbox → Tap card → Full submission detail |

**Purpose:** After opening the mobile form inbox card list, show full submission detail (same data as desktop report).

**Data & Entities:**
- `formSubmissionActivityFeed` records
- Existing `FilledSafetyFormTabTrail` component (spec says no modifications needed)

**User Interactions:**
- Tap card on `/form-inbox` → full-screen detail
- List supports search, filters, pull-to-refresh, infinite scroll

**Layout Guidance:**
- Card list (no split view); `FormInboxMobileCard` component
- Bottom nav: Forms tab
- Offline: cached data + banner; empty state copy specified

**Dependencies:** Q21030-9047; same GraphQL as desktop Form Report

---

### UIS-F07-01: Publish Version — Change Summary
| | |
|---|---|
| **Work Package** | UIS-F07 · Versioning & Change Tracking |
| **Platform** | Desktop |
| **Type** | Modal |
| **Location** | Form Version Management → Publish → Confirmation modal |

**Purpose:** Before publishing a new form version, show what changed between current active and version being published.

**Data & Entities:**
- Compared `SafetyForm` versions
- Summary: "+2 questions, -1 question, 2 modified"
- Optional warning if failed submissions exist on superseded version

**User Interactions:**
- Review change summary → Confirm Publish
- Uses `setActiveFormMutation` (unchanged)

**Layout Guidance:**
- Modal: change summary (added/removed/modified counts), warning if needed, Confirm/Cancel
- Component: `PublishVersionModal.tsx`

**Dependencies:** Q21030-3452; versioning/timeline features in same UIS

**Notes:** For v1, change summary logic may be minimal.

---

### UIS-F08-01: Equipment Picker Modal
| | |
|---|---|
| **Work Package** | UIS-F08 · Equipment-Form Integration |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Modal |
| **Location** | Form fill → Equipment question → Select equipment |

**Purpose:** Runtime equipment selection for EQUIPMENT question type; supports single/multi select with optional customer filtering.

**Data & Entities:**
- `Equipment` list via `getEquipment` / `equipmentList` (optional `companyId`)
- `Answer.value` as JSON array for multi-select
- `AnswerModelMap` for equipment refs
- `parentAnswerId` + `equipmentReferenceId` for recurring child answers

**User Interactions:**
- `ModalList`: radio (single) vs checkboxes (multi)
- Select All when multi; Confirm selection
- Builder toggles: `equipmentIsMultiSelect`, `equipmentFilterByCustomer`, `equipmentRecurringQuestionIds`

**Layout Guidance:**
- "Select Equipment" panel: list rows with equipment meta, optional filter
- Empty state: "No equipment for this customer"

**Dependencies:** Fix `getEquipments()` `categoryId → equipmentCategoryId` bug first; `EquipmentQuestionType` in `packages/ui`

**Notes:** Default single-select for backward compatibility.

---

### UIS-F09-01: Guest Public Blank Form Fill
| | |
|---|---|
| **Work Package** | UIS-F09 · Distribution & External Sharing |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Page |
| **Location** | /public/form/[token] (public URL) |

**Purpose:** Anonymous recipient opens link and completes a new submission from a blank template (not a completed submission PDF).

**Data & Entities:**
- JWT payload: `type: "blank_form"` + `formWrapperId` (vs existing `feedbackId` path)
- `PUBLIC_LINK_SECRET`; creates `Feedback` with `submittedByUserId = null` for guest
- Optional expiry/password

**User Interactions:**
- Guest opens public URL → verify JWT → fill form → submit
- `PublicShareFormModal`: Blank Form / Completed Submission toggle, copy link, expiry, optional password

**Layout Guidance:**
- Public page: `apps/frontend/src/pages/public/form/[token].tsx`
- Clean, branded form fill experience; no auth required

**Dependencies:** `publicLink.ts` API extension; Q21030-3598; Fix `userId: "testUserId"` bug in `PublicShareFormModal`

**Notes:** Same JWT infrastructure as completed submission links; `autoAssociateByCustomer` skipped for anonymous guest.

---

## Unscheduled — Other

### UIS-12-01: Leave Detail Page
| | |
|---|---|
| **Work Package** | UIS-12 · Leave & Timesheet Workflow |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | /workforce/leave/[id] |

**Purpose:** View one LeaveRequest with approval actions.

**Data & Entities:**
- `LeaveRequest`: userId, leaveTypeId, startDate, endDate, totalHours, status, notes, isHalfDay, approvedById, approvedAt

**User Interactions:**
- View leave details
- Approve/reject via `LeaveApproval` (confirm dialog)

**Layout Guidance:**
- Detail page pattern with `PageTitle` / `PageHeading`
- Status badge, employee info, date range, hours breakdown

**Dependencies:** GraphQL Leave resolvers; `workforce___view`; supervisor hierarchy for approval

**Notes:** Hours from `fullDayLeaveDuration`; overlap validation; half-day and weekend rules.

---

### UIS-12-02: Leave Request Create/Edit Flyout
| | |
|---|---|
| **Work Package** | UIS-12 · Leave & Timesheet Workflow |
| **Platform** | Desktop |
| **Type** | Flyout |
| **Location** | Leave Dashboard → + New Request |

**Purpose:** Create/edit leave requests with automatic hours calculation from date range.

**Data & Entities:**
- Same as LeaveRequest + LeaveType list

**User Interactions:**
- Select leave type, date range, half-day toggle, notes
- Auto-calculate hours from date range
- Save/cancel

**Layout Guidance:**
- Standard flyout form pattern
- Fields: Leave Type, Start Date, End Date, Half Day toggle, Notes

---

### UIS-12-03: Leave Calendar
| | |
|---|---|
| **Work Package** | UIS-12 · Leave & Timesheet Workflow |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | /workforce/leave → Calendar view |

**Purpose:** Team leave visibility for scheduling and capacity planning.

**Data & Entities:**
- Query: `getLeaveCalendar(startDate, endDate)`

**User Interactions:**
- View team leave on calendar
- Navigate months
- Click date/entry → leave detail

**Layout Guidance:**
- Visual calendar; color-coded by leave type
- Spec does not provide pixel-level detail beyond "calendar view"

---

### UIS-12-04: Timesheet Questions Admin
| | |
|---|---|
| **Work Package** | UIS-12 · Leave & Timesheet Workflow |
| **Platform** | Desktop |
| **Type** | Settings |
| **Location** | /settings/timesheet-questions |

**Purpose:** Configure pre-submit questions that appear before timesheet submission.

**Data & Entities:**
- `TimesheetQuestion`: question, type (YES_NO | TEXT | MULTIPLE_CHOICE), isRequired, sortOrder, isActive
- Instance-scoped

**User Interactions:**
- Add/edit/delete questions
- Drag-reorder
- Type selection (YES_NO, TEXT, MULTIPLE_CHOICE)
- Active/required toggles

**Layout Guidance:**
- Settings page with draggable question list
- Fields per question: Question text, Type dropdown, Required toggle, Active toggle

**Dependencies:** Submit flow on timesheets — modal before submit if questions configured; skip if none

---

### UIS-12-05: Union Subsidy Accrual Report
| | |
|---|---|
| **Work Package** | UIS-12 · Leave & Timesheet Workflow |
| **Platform** | Desktop |
| **Type** | Page |
| **Location** | /reports/union-subsidy-accrual |

**Purpose:** Period report showing job-level subsidy accrual with CSV export.

**Data & Entities:**
- `Job.subsidyRatePerHour`, `unionHall`
- Computed: accruedSubsidy, budget vs accrued
- Jobs without subsidy rate excluded

**User Interactions:**
- View report by period
- CSV export
- Highlight >100% accrual

**Layout Guidance:**
- Table: Job | Union Hall | Budget | Accrued | % | Status
- >100% highlighted in red/amber

**Dependencies:** Phase 5 in UIS-12; ties to job financial overview KPIs

---

### UIS-18-01: Daily Logs List
| | |
|---|---|
| **Work Package** | UIS-18 · Daily Logs & Field Reports |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Page |
| **Location** | /daily-logs |

**Purpose:** View all daily logs across all jobs with filtering.

**Data & Entities:**
- `DailyLog`: jobId, date, createdById, weatherConditions, temperature, windSpeed, precipitation, workPerformed, materialsUsed, equipmentUsed, visitorLog, safetyObservations, delayReasons, notes, status (Draft|Submitted|Approved), instanceId
- `DailyLogCrewMember`: dailyLogId, userId, hoursWorked — join table linking each crew member to their User record
- `crewCount` and `hoursWorked` are **derived** at query/render time from `DailyLogCrewMember` (not stored as scalars) per User-First rules

**User Interactions:**
- Filter by job, date range, status
- Navigate to log detail
- Search

**Layout Guidance:**
- `/daily-logs` with `DailyLogCard` pattern
- Table/card list: Date | Job | Crew | Hours | Status

---

### UIS-18-02: Daily Log Detail
| | |
|---|---|
| **Work Package** | UIS-18 · Daily Logs & Field Reports |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Page |
| **Location** | /daily-logs/[id] |

**Purpose:** View and edit a full daily log with all sections.

**Data & Entities:**
- Full `DailyLog` model with all fields
- Aggregation sources: timesheets, weather API, job gallery photos, forms, equipment

**User Interactions:**
- Edit fields
- Submit/approve status transitions
- View aggregated data

**Layout Guidance:**
- Sections: Weather, Crew, Work Performed, Materials Used, Equipment Used, Visitor Log, Safety Observations, Delay Reasons, Notes, Photos

---

### UIS-18-03: Create Daily Log
| | |
|---|---|
| **Work Package** | UIS-18 · Daily Logs & Field Reports |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Page |
| **Location** | /daily-logs/create |

**Purpose:** Create new daily log with auto-aggregation from existing data sources.

**Data & Entities:**
- Same as DailyLog model
- `refreshDailyLogAggregation`, `DailyLogAggregation` for auto-population

**User Interactions:**
- Select job, date
- Trigger auto-aggregation (pull from timesheets, weather, photos, forms, equipment)
- Edit/supplement aggregated data
- Save as Draft

**Layout Guidance:**
- Job selector, date picker at top
- Same section layout as detail page
- Auto-populated fields clearly marked

**Dependencies:** Timesheets, weather API, job gallery, forms, equipment data sources

---

### UIS-18-04: Job — Daily Logs Tab
| | |
|---|---|
| **Work Package** | UIS-18 · Daily Logs & Field Reports |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | Tab |
| **Location** | Job Detail → Daily Logs tab |

**Purpose:** View daily logs filtered to a specific job.

**Data & Entities:**
- Same model, filtered by `jobId`

**User Interactions:**
- Date filtering on tab
- Navigate to log detail or create new

**Layout Guidance:**
- Tab on job detail page
- List: Date | Crew | Hours | Status
- "+ New Daily Log" button (pre-fills job)

**Notes:** Coordinate tab order with UIS-25a (PO tab).

---

### UIS-18-05: Daily Log PDF Document
| | |
|---|---|
| **Work Package** | UIS-18 · Daily Logs & Field Reports |
| **Platform** | Both (Desktop + Mobile) |
| **Type** | PDF |
| **Location** | Daily Log Detail → Export/Download |

**Purpose:** GC-ready export for reporting and compliance.

**Data & Entities:**
- `exportDailyLogPdf(id)` mutation/query
- `@useanzen/pdf-worker`

**User Interactions:**
- Preview modal: download, email
- Batch multi-day export option

**Layout Guidance — PDF Sections:**
- Header: Company branding, Job info, Date
- Weather: conditions, temp, wind, precipitation
- Crew: count, hours
- Work Performed: text block
- Materials Used: list
- Safety Observations: text block
- Photos: gallery
- Footer: status, created by, timestamps

---

### UIS-QW-01: Invoice Detail — Duplicate Action
| | |
|---|---|
| **Work Package** | UIS-QW · Quick Wins Batch |
| **Platform** | Desktop |
| **Type** | Page (action bar addition) |
| **Location** | Invoice (JobBill) Detail → Action bar → "Duplicate" |

**Purpose:** One-click invoice duplication for recurring billing patterns.

**Data & Entities:**
- Mutation: `duplicateJobBill`
- Copies: line items, amounts, cost codes, descriptions, `purchaseOrderId`
- Does NOT copy: invoice number, dates (today), approval status

**User Interactions:**
- Click "Duplicate" in action bar → creates new draft → navigates to new invoice

**Layout Guidance:**
- New button in existing action bar (alongside Edit, Delete, etc.)
- Confirmation may not be needed (creates draft, user can discard)

**Dependencies:** UIS-25a — PO FK on `JobBill` must be cloned

---

### UIS-QW-02: Instance Settings — Job Configuration
| | |
|---|---|
| **Work Package** | UIS-QW · Quick Wins Batch |
| **Platform** | Desktop |
| **Type** | Settings |
| **Location** | Instance Settings → Job Configuration (new section) |

**Purpose:** Toggle visibility of job fields per instance (simplify UI for companies that don't use certain fields).

**Data & Entities:**
- `jobFieldVisibility` JSON config per instance
- Fields: plannedStart/End, contractInfo, warrantyDates, retentionPercentage, customFields
- API: `getJobFieldVisibility`, `updateJobFieldVisibility`

**User Interactions:**
- Toggle each field on/off
- Save

**Layout Guidance:**
- Settings form with toggle rows: Field Name | Description | Visible (toggle)
- Admin-only access

---

### UIS-QW-03: Job Detail — Conditional Fields
| | |
|---|---|
| **Work Package** | UIS-QW · Quick Wins Batch |
| **Platform** | Desktop |
| **Type** | Page (conditional rendering) |
| **Location** | Job Detail page |

**Purpose:** Render job fields only if `jobFieldVisibility` is true; hidden fields remain in DB.

**Data & Entities:**
- Reads `jobFieldVisibility` config
- Applies to job detail rendering

**User Interactions:**
- No user interaction — fields simply appear/disappear based on config

**Layout Guidance:**
- Conditional rendering of existing field sections on Job detail
- No visual indicator that fields are hidden (admin sees all in settings)

**Dependencies:** UIS-QW-02 (Job Configuration settings)

---

### UIS-QW-04: Job Employees Timesheet Report — Base Rate Column
| | |
|---|---|
| **Work Package** | UIS-QW · Quick Wins Batch |
| **Platform** | Desktop |
| **Type** | Page (column addition) |
| **Location** | Job Employees Timesheet Report |

**Purpose:** Add "Base Rate" column from employee rate configuration to the timesheet report.

**Data & Entities:**
- Employee rate from rate configuration
- May need query extension if rate not already in dataset

**User Interactions:**
- View new column (default visible)
- Sort by base rate
- CSV export includes new column

**Layout Guidance:**
- New column in existing report table
- Position: after employee name, before hours columns

**Notes:** No API change needed if rate already in dataset; otherwise extend query.

---

## Summary

| Release | Track | Needs Design | Priority |
|---------|-------|:---:|---|
| 1.33 | LEM | 2 | Blocks LEM-2 and LEM-3b implementation |
| 1.33 | WO | 12 | Blocks WO-2 through WO-8 implementation |
| 1.33 | Equipment | 13 | Blocks equipment billing, maintenance, and timesheet features |
| 1.34 | MAT | 9 | Blocks customer PO, inventory, and vendor credit features |
| Unscheduled | Forms | 7 | Required before Forms track work begins |
| Unscheduled | Other | 14 | Required before Leave, Daily Logs, and Quick Wins |
| **Total** | | **57** | |

### Immediate Priorities (Release 1.33 — 27 screens)

The 27 screens in Release 1.33 are the most urgent as they directly block implementation work. Within 1.33:

1. **LEM-2 and LEM-3** (2 screens) — Foundation; blocks everything downstream
2. **WO-2 line item editors** (3 screens) — Data model visualization needed before WO-3 form work
3. **WO-3a, WO-3d** (2 screens) — Form foundation and settings
4. **WO-4** (3 screens) — Detail page tabs and PDF
5. **WO-5 Kanban** (1 screen) — List page view
6. **WO-7** (2 screens) — Conversion flows
7. **WO-8** (1 screen) — Mobile PDF preview
8. **Equipment UIS-15A through 15H** (13 screens) — Billing, maintenance, and timesheet gaps
