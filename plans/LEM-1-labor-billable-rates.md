# LEM-1: Labor Billable Rates — Implementation Plan

## Overview

Add a `billableValue` field to `TradeLevelRate` and create a new "Billable Rates" tab in the Employee Agreement Contract detail page. This enables auto-pricing on Work Order labor line items.

**Estimated effort:** 2-3 days  
**Risk:** Low — additive column, no existing behavior changes  
**Spec:** `tm-work-orders-uis/uis-LEM-1-labor-billable-rates.html`

---

## Step 1: Prisma Schema + Migration

### 1a. Add field to schema

**File:** `apps/api/prisma/schema.prisma`  
**Location:** `TradeLevelRate` model (line ~3621, after `baseValue`)

Add `billableValue` directly after `baseValue`:

```prisma
model TradeLevelRate {
  id         String   @id @db.VarChar(21)
  isDeleted  Boolean  @default(false)
  isArchived Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @default(now()) @updatedAt
  baseValue  Decimal  @db.Decimal(10, 2)
  billableValue Decimal? @db.Decimal(10, 2)    // <-- ADD THIS LINE
  // ... rest of relations unchanged
}
```

### 1b. Create migration

Run `pnpm --filter api prisma:migrate` and name it `add_billable_value_to_trade_level_rate`.

The generated SQL should be:

```sql
ALTER TABLE `TradeLevelRate` ADD COLUMN `billableValue` DECIMAL(10, 2) NULL;
```

### 1c. Regenerate Prisma client

Run `pnpm run prisma:generate` after migration.

---

## Step 2: TypeScript Types

**File:** `apps/api/src/types/TradeLevel.types.ts`  
**Location:** `ITradeLevelRate` interface (lines 19-24)

Add `billableValue` to the interface:

```typescript
export interface ITradeLevelRate {
    baseValue: number;
    billableValue?: number;    // <-- ADD THIS LINE
    tradeLevelId: string;
    employeeAgreementContractId: string;
    employeeAgreementRateLabelId: string;
}
```

---

## Step 3: Model Class

**File:** `apps/api/src/models/TradeLevelRate.ts`

### 3a. Add to modelFields (after line ~23, after the `baseValue` field)

```typescript
{
    name: "billableValue",
    type: "float",
    options: {}
}
```

This registers it as an editable field. No `isRequiredOnCreate` — it's optional.

### 3b. Update `duplicateManyItemsForNewContract` (lines ~210-252)

In the `createItem` call inside the loop, add `billableValue`:

```typescript
const newRate = await this.createItem(
    {
        baseValue: currentRate.baseValue.toNumber(),
        billableValue: currentRate.billableValue?.toNumber() ?? null,    // <-- ADD
        employeeAgreementRateLabelId: currentRate.employeeAgreementRateLabelId,
        tradeLevelId: currentRate.tradeLevelId,
        employeeAgreementContractId: newContractId
    },
    currentUserId
);
```

### 3c. No changes needed to `editManyItems`

The existing `editManyItems` method (line ~254) calls the base class `editItem` for each entry. Since `billableValue` is registered in `modelFields`, it will be automatically accepted in edit payloads. No changes needed.

---

## Step 4: GraphQL Resolver

**File:** `apps/api/src/graphql/models/TradeLevelRate.ts`

### 4a. Add `billableValue` to the type definition (after line ~12)

```graphql
type TradeLevelRate {
    id: ID
    baseValue: Float
    billableValue: Float    # <-- ADD THIS LINE
    tradeLevelId: String
    # ... rest unchanged
}
```

### 4b. Add `billableValue` to the `EditTradeLevelRate` input (after line ~29)

```graphql
input EditTradeLevelRate {
    id: ID!
    baseValue: Float
    billableValue: Float    # <-- ADD THIS LINE
}
```

### 4c. No changes to Query or Mutation resolvers

The existing `editManyTradeLevelRates` mutation already passes `args.data` to the model's `editManyItems`. Since we added `billableValue` to modelFields, it flows through automatically.

---

## Step 5: Frontend — BillableRates Tab Component

**Create file:** `apps/frontend/src/components/DetailsPage/EmployeeContract/Tabs/BillableRates.tsx`

This component is a **simplified version of `WageRates.tsx`**. Key differences:

| WageRates.tsx | BillableRates.tsx |
|---|---|
| Edits individual `EmployeeAgreementRateLineItem.baseValue` per cell | Edits `TradeLevelRate.billableValue` per cell |
| Rows = line items (isLineItem=true), Columns = trade levels | Rows = "Cost Rate" (read-only) + "Billable Rate" (editable) + "Margin", Columns = trade levels |
| Calls `upsertManyEmployeeAgreementRateLineItems` + `editManyTradeLevelRates` on save | Calls only `editManyTradeLevelRates` on save |
| Shows `WageRateTimeSheetChanges` modal on save | No timesheet impact modal needed |
| Has `CopyWageRatesForm` per tab | No "Copy From" button per tab |

### Component structure

```
BillableRates.tsx
├── Header: WageRegion selector + Search + Edit button
├── TabGroup (one tab per rateType where isLineItem=false)
│   └── Table per tab
│       ├── Header row: trade level names as columns
│       ├── "Cost Rate" row: TradeLevelRate.baseValue (read-only, gray)
│       ├── "Billable Rate" row: TradeLevelRate.billableValue (CurrencyInput, editable)
│       └── "Margin" row: computed (billable - cost) / cost * 100
└── ExitPageWarning footer (when editing)
```

### GraphQL query to use

Reuse the same `employeeAgreementContract` query pattern from WageRates but add `billableValue` to the TradeLevelRates selection:

```graphql
query EmployeeAgreementContractBillableRates(
    $id: ID!
    $wageRegionId: ID
    $includeHiddenTrades: Boolean
) {
    employeeAgreementContract(id: $id) {
        id
        isActiveContract
        effectiveDate
        EmployeeAgreement {
            EmployeeAgreementRateLabels(wageRegionId: $wageRegionId) {
                id
                name
                isLineItem
            }
        }
        TradeLevelRates(
            wageRegionId: $wageRegionId
            includeHiddenTrades: $includeHiddenTrades
        ) {
            id
            baseValue
            billableValue
            employeeAgreementRateLabelId
            TradeLevel {
                id
                name
                orderNo
            }
        }
    }
}
```

Note: We don't need `EmployeeAgreementRateLineItems` or `isEmployerExpense` — this tab works at the TradeLevelRate level only.

### State shape

```typescript
// Form values keyed by TradeLevelRate.id
interface IBillableRateFormValues {
    billableValue: string;     // The editable billable rate
    baseValue: number;         // Read-only cost rate for display
}

const { formValues, setFormValues, dirtyFormValues, setDirtyFormValues } = useForm<
    Record<string, IBillableRateFormValues>
>({});
```

### Save handler

```typescript
const onSubmit = () => {
    const changes = Object.entries(dirtyFormValues)
        .filter(([id]) => {
            const original = data.employeeAgreementContract.TradeLevelRates
                .find(tlr => tlr.id === id);
            const newVal = dirtyFormValues[id]?.billableValue;
            return original?.billableValue !== Number(newVal?.replace(/[,]/g, ""));
        });

    editManyTradeLevelRates({
        variables: {
            data: changes.map(([id, value]) => ({
                id,
                billableValue: value.billableValue
                    ? Number(value.billableValue.replace(/[,]/g, ""))
                    : null
            }))
        }
    }).then((res) => {
        if (res.errors) {
            notify.error("Error saving billable rates");
        } else {
            notify.success("Billable rates saved successfully");
            setIsEdit(false);
            setDirtyFormValues({});
        }
    });
};
```

### Margin calculation

```typescript
const getMargin = (baseValue: number, billableValue: number | null): number | null => {
    if (billableValue == null || baseValue === 0) return null;
    return ((billableValue - baseValue) / baseValue) * 100;
};
```

### Key patterns to follow from WageRates.tsx

- **Wage region selector:** Copy the `CustomCombobox` with `useSearchCore`, `queryResultLabel="WageRegion"`, `wildCard` props (lines 359-373)
- **Search field:** Copy the `TextFromControl` with `IconSearch` (lines 375-383)
- **Edit button:** Copy the conditional rendering based on `isActiveContract` or future effectiveDate (lines 385-403)
- **Table structure:** Copy the `<table>` with `border-separate`, sticky left column, and `cellClasses` pattern (lines 476-641)
- **CurrencyInput:** Use with `decimalPlaces={2}` (not 3 like WageRates)
- **ExitPageWarning:** Copy the footer pattern but without the `WageRateTimeSheetChanges` modal — just call `onSubmit` directly (lines 648-668)
- **Empty state:** Copy the `XCircleIcon` + `ErrorPage` pattern for when no rate types exist (lines 412-434)

### Style conventions from CLAUDE.md

- Use `FC` arrow function pattern
- Use `ClassNames` from `@useanzen/shared-utils` for dynamic className
- No trailing commas
- 4-space indentation, double quotes
- Place `gql` queries/mutations at bottom of file
- Use `CurrencyInput` from `@useanzen/ui` (not raw input)
- Import icons from `@useanzen/ui` (`IconEdit`, `IconSearch`)

---

## Step 6: Register the Tab

**File:** `apps/frontend/src/components/DetailsPage/EmployeeContract/index.tsx`

### 6a. Add import

```typescript
import BillableRates from "./Tabs/BillableRates";
```

### 6b. Add tab to array (after Wage Rates tab, before Travel & Board)

```typescript
{
    label: "Billable Rates",
    component: <BillableRates />,
    param: "billable-rates",
    permission: hasPermissions(
        { EmployeeAgreementContract: { view: true } },
        permissions
    )
}
```

---

## Step 7: Update copyDefaultWageTable (if applicable)

Search for the `copyDefaultWageTable` mutation implementation. It may be in:
- `apps/api/src/models/TradeLevelRate.ts`
- `apps/api/src/models/EmployeeAgreementContract.ts`
- Or called via a GraphQL mutation that delegates to a model

Ensure that when wage rates are copied from the default region to another region, `billableValue` is included in the copy operation alongside `baseValue`.

---

## Verification Checklist

After implementation, verify:

- [ ] `billableValue` column exists in database after migration
- [ ] GraphQL playground: `tradeLevelRate(id: "...")` returns `billableValue`
- [ ] GraphQL playground: `editManyTradeLevelRates` accepts `billableValue` in payload
- [ ] Billable Rates tab appears after Wage Rates tab on an Employee Agreement Contract
- [ ] Rate types (Wages, Benefits, etc.) appear as sub-tabs
- [ ] Cost Rate row shows read-only values matching Wage Rates tab totals
- [ ] Billable Rate row is empty (null) for unconfigured rates
- [ ] Edit mode enables CurrencyInput fields on Billable Rate row
- [ ] Save calls `editManyTradeLevelRates` with only changed values
- [ ] Margin row shows correct % with green/red color coding
- [ ] Wage region selector filters rates correctly
- [ ] Trade classification search filters columns
- [ ] ExitPageWarning shows correct change count
- [ ] Cancel reverts all changes
- [ ] Creating a new contract from an existing one carries billableValue
- [ ] Existing Wage Rates tab is completely unaffected
- [ ] Tab only visible with correct permissions
- [ ] Edit button only visible on active/future contracts

---

## Files Summary

| Action | File | What to do |
|--------|------|------------|
| MODIFY | `apps/api/prisma/schema.prisma` | Add `billableValue Decimal? @db.Decimal(10, 2)` to TradeLevelRate |
| CREATE | `apps/api/prisma/migrations/.../migration.sql` | `ALTER TABLE TradeLevelRate ADD COLUMN billableValue DECIMAL(10,2) NULL` |
| MODIFY | `apps/api/src/types/TradeLevel.types.ts` | Add `billableValue?: number` to ITradeLevelRate |
| MODIFY | `apps/api/src/models/TradeLevelRate.ts` | Add to modelFields + update duplicateManyItemsForNewContract |
| MODIFY | `apps/api/src/graphql/models/TradeLevelRate.ts` | Add billableValue to type + EditTradeLevelRate input |
| CREATE | `apps/frontend/src/components/DetailsPage/EmployeeContract/Tabs/BillableRates.tsx` | New tab component |
| MODIFY | `apps/frontend/src/components/DetailsPage/EmployeeContract/index.tsx` | Register new tab |
