# Electron Adapter Entrypoint

Status: Accepted  
Date: 2026-07-17

## Context

`@prompt-optimizer/core` previously exported browser domain modules and Electron
renderer proxies from the same package entry. Web and Extension builds therefore
had no explicit platform seam and could retain Electron-only implementations in
their initial dependency graph.

## Decision

- Browser-neutral domain modules remain available from `@prompt-optimizer/core`.
- Electron renderer adapters are exported from `@prompt-optimizer/core/electron`.
- `useAppInitializer` dynamically imports the Electron entry only after runtime
  detection confirms that the Electron bridge is available.
- The Core package emits ESM, CJS, and declarations for both entries.

## Considered Alternatives

- Keep one Core entry: lowest implementation cost, but preserves the platform
  leakage and gives browser builds less control over Electron-only code.
- Introduce runtime plugins: greater extensibility, but unjustified protocol,
  versioning, and security cost for the two platform adapters currently needed.
- Rewrite platform services: rejected because the existing proxy interfaces and
  persistence behavior are already tested and compatible.

## Consequences

- Positive: platform ownership is explicit and Electron adapters load on demand.
- Positive: Web initial assets are smaller without changing data or service interfaces.
- Negative: package builds and Vite aliases must preserve the additional subpath.
- Risk control: repository tests verify the export, build entry, dynamic import,
  and consumer aliases; Core/UI/Web/Extension builds remain required release gates.

## Revisit Triggers

Revisit this decision when third-party runtime adapters are supported, when Core
publishes a public compatibility contract, or when browser-specific Core entries
can provide a materially smaller interface than the current source entry.
