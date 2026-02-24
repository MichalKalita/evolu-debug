# Evolu Debug Testing & Refactor Plan

## Goal
Improve testability of the debug tool while keeping real Evolu runtime behavior (no Evolu mocks), and adopt patterns from `@evolu/vue`.

## Constraints
- Do not mock Evolu.
- Tests should run against a real Evolu instance in browser-like runtime.
- Keep internal state routing (no URL router).

## Refactor Steps

### 1) Use typed context keys instead of string inject keys
- [x] Replace string keys (`'evolu'`, `'schema'`) with `InjectionKey`.
- [x] Keep Evolu provided via `@evolu/vue` conventions (`provideEvolu`, `useEvolu`).
- [x] Add dedicated schema key (e.g. `SchemaContext`) for schema injection.

### 2) Move logic out of components into pure modules
Create:
- [x] `src/lib/utils.ts` (consolidated helper module)
  - [x] `formatCell`
  - [x] binary detection
  - [x] HEX preview + byte size format
  - [x] `formatSchemaType`
  - [x] union/literal/brand/optional formatting
  - [x] alphabetical sorting
  - [x] split `application` vs `evolu_` tables

This keeps Vue SFCs thin and makes unit tests deterministic.

### 3) Shift data loading to composables with @evolu/vue
- [x] In components, use `useEvolu()` and `useQuery()` for reactive query data.
- [x] Reduce manual `onMounted + loadQuery` where possible.
- [x] Keep explicit loading/error states where UX needs them.

### 4) Split large UI component
Break `TableDetail.vue` into smaller parts:
- [x] `TableDetailHeader` (title + view switch)
- [x] `TableDataGrid`
- [x] `TableSchemaGrid`

This lowers complexity and improves focused testing.

## Automated Test Strategy (No Evolu Mocking)

### Runtime
- [ ] Use browser-capable tests (Vitest browser mode + Playwright provider) for real `@evolu/web` behavior.
- [ ] Use unique db names per test to isolate storage.
- [ ] Seed data via real Evolu operations (`insert`/`update`), not mocks.

### Test Targets

#### Tables component
- [ ] Loads table list from real DB.
- [ ] Alphabetical sorting.
- [ ] `Application Tables` first, `Evolu Tables` second.
- [ ] Emits `select-table`.
- [ ] Emits `tables-loaded` with expected order.
- [ ] Error state rendering.

#### Table detail component
- [ ] Loads rows for selected table.
- [ ] Reloads after table change.
- [ ] Data tab renders rows/columns.
- [ ] Binary rendering: `0x<20 HEX chars> (<N> B)`.
- [ ] Schema tab renders schema from injected app schema.
- [ ] Union formatting (e.g. `"low" | "high"`).
- [ ] Data Type inference (`string`, `bytes`, `mixed(...)`, `no data`).

#### App shell
- [x] Toggle open/close.
- [x] Initial table selection after `tables-loaded`.
- [x] Internal state navigation between tables (no URL).
- [x] Reset state on close.

### Utility unit tests
Add direct tests for pure helpers:
- [x] schema formatter behavior (union, literal, brand, optional, fallback)
- [x] binary formatter behavior
- [x] table categorization and sorting rules

## Execution Order
1. [x] Introduce typed context keys + wiring.
2. [x] Extract formatter/categorization helpers.
3. [x] Refactor components to use helpers and `@evolu/vue` composables.
4. [x] Add utility unit tests.
5. [ ] Add browser component tests with real Evolu.
6. [ ] Stabilize CI execution and cleanup hooks.
