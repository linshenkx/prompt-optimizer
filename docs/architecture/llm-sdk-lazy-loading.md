# LLM SDK Lazy Loading

Status: Accepted  
Date: 2026-07-17

## Context

The browser application needs Provider metadata during startup, but it does not
need the OpenAI, Anthropic, or Google Gen AI network clients until a user sends a
request or explicitly refreshes a remote model list. Static SDK imports made the
three clients part of the initial dependency graph even though the Registry only
used synchronous metadata at startup.

The measured Web initial bundle was 812.1 KiB gzip. The Provider/SDK chunk alone
was 110.7 KiB gzip and was module-preloaded before the application became usable.

## Decision

- Keep `TextAdapterRegistry` synchronous so Provider and model metadata remain
  immediately available to managers and settings views.
- Load the OpenAI, Anthropic, and Google Gen AI constructors inside their Adapter
  request paths through a shared retryable loader.
- Coalesce concurrent imports, retain a successful module, and clear a rejected
  promise so a transient chunk failure can be retried.
- Reuse the Google loader for both text and image Adapters.
- Preserve all existing Adapter interfaces and error behavior. The first request
  for a given SDK pays one additional local chunk load; subsequent requests reuse
  the same module.

## Considered Alternatives

Scores are equally weighted from 1 (least favorable) to 5 (most favorable).
For cost, risk, difficulty, and time efficiency, a higher score means cheaper,
safer, easier, or faster.

| Alternative | Effect | Cost | Risk | Difficulty | Time efficiency | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Lazy-load SDKs inside Adapters | 5 | 4 | 4 | 4 | 5 | 22 |
| Make the Provider Registry asynchronous | 5 | 2 | 2 | 2 | 2 | 13 |
| Add a separate browser Core entry | 4 | 3 | 3 | 3 | 3 | 16 |

An asynchronous Registry could split every Provider Adapter, but it would widen
the interface change across model migration, defaults, UI settings, and tests.
A browser Core entry remains useful for future platform isolation, but it does
not by itself prevent SDK imports once the Registry is used.

## Consequences

- Positive: measured Web initial total falls from 812.1 to 721.4 KiB gzip
  (90.7 KiB, 11.2%). Initial JavaScript falls from 787.8 to 697.1 KiB gzip.
- Positive: startup still constructs the Registry and exposes all static Provider
  metadata without waiting on an SDK network chunk.
- Positive: the loader module centralizes concurrency and retry behavior.
- Negative: the first real request for each SDK performs one extra same-origin
  chunk fetch before the remote API request.
- Risk control: Core tests cover loader coalescing/retry and Adapter behavior;
  repository tests guard against static SDK imports; the Web bundle budget and
  browser route smoke tests remain release gates.

## Revisit Triggers

Revisit the Registry interface only if Adapter metadata itself becomes a material
startup cost, if third-party runtime Adapters are introduced, or if field data
shows that first-request chunk latency outweighs the startup reduction.
