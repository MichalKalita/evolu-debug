# TODO

## Rule: Test During Implementation

- [ ] For every feature item below: implement it and immediately add/update tests in the same step.
- [ ] Do not batch testing at the end of a section.
- [ ] After each feature+test pair, run relevant tests before moving on.

## Step-by-Step Plan (Feature + Test Pairs)

### 1) Data Toolbar

- [x] Implement toolbar container above `TableDataGrid` (`search`, `filters`, `result count`, `clear`).
- [x] Add/adjust browser test for toolbar rendering in `Data` view.
- [x] Run: `npm run test:browser -- --run src/components/TableDetail.browser.spec.ts`

### 2) Global Search

- [ ] Implement fulltext search across visible columns.
- [ ] Add unit tests for search matching in `src/lib/utils.spec.ts`.
- [ ] Add browser test verifying row set changes with search input.
- [ ] Run: `npm run test:unit -- --run` and targeted browser test.

### 3) Quick Filters

- [ ] Implement quick filters (`isDeleted`, `isCompleted`, `categoryId`, etc.).
- [ ] Add unit tests for filter predicate logic.
- [ ] Add browser test for filter application and clear behavior.
- [ ] Run: `npm run test:unit -- --run` and targeted browser test.

### 4) Sorting

- [ ] Implement header click sorting in `TableDataGrid.vue`.
- [ ] Implement tri-state sort (`ASC` -> `DESC` -> `none`).
- [ ] Add sort indicators in header.
- [ ] Set default sort (`createdAt DESC`, fallback `id ASC`).
- [ ] Ensure stable comparison for `null`, `string`, `number`, and bytes.
- [ ] Add unit tests for compare/sort logic.
- [ ] Add browser test for header sorting behavior.
- [ ] Run: `npm run test:unit -- --run` and targeted browser test.

### 5) Row Selection

- [ ] Add row checkbox selection.
- [ ] Add header checkbox for select all visible rows.
- [ ] Ensure checkbox click does not open row edit.
- [ ] Add browser test for single select, select-all, and non-edit checkbox clicks.
- [ ] Run: targeted browser test.

### 6) Bulk Actions

- [ ] Add sticky bulk action bar with selected count.
- [ ] Implement `Delete selected` (soft delete with `isDeleted = 1`).
- [ ] Optionally add `Export selected JSON`.
- [ ] Wire bulk actions in `TableDetail.vue` via `evolu.update(...)`.
- [ ] Reset selected rows after successful bulk action.
- [ ] Add browser test for bulk delete flow.
- [ ] Run: targeted browser test.

### 7) Regression and Final Verification

- [ ] Confirm row click-to-edit still works after selection/filter/sort changes.
- [ ] Update affected browser tests if interaction order changed.
- [ ] Run full suite:
  - [ ] `npm run type-check`
  - [ ] `npm run test:unit -- --run`
  - [ ] `npm run test:browser -- --run`
