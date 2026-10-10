# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Layout: **single-context**. One `CONTEXT.md` at the repo root. Decisions live in the existing log `docs/decisions.md`, not in `docs/adr/`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the domain glossary.
- **`docs/decisions.md`**: the decision log (a table, newest first). Read entries that touch the area you're about to work in.
- **`docs/ARCHITECTURE.md`**: how the pipeline, storage, safety and auth fit together.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates `CONTEXT.md` lazily when terms actually get resolved.

## Recording decisions

When a skill would write an ADR, add a row to the top of the table in `docs/decisions.md` instead (date, decision, reason), written in Thai to match the existing entries. Don't create `docs/adr/`.

## File structure

```
/
├── CONTEXT.md
├── CLAUDE.md
└── docs/
    ├── decisions.md      ← decision log, newest first
    ├── ARCHITECTURE.md
    └── agents/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an entry in `docs/decisions.md`, surface it explicitly rather than silently overriding:

> _Contradicts the decision on <date> (<decision>), but worth reopening because…_
