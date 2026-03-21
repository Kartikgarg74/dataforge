# Codebase Decision

## Active App

The root workspace is the single source of truth for active development.

- Active package manifest: package.json (root)
- Active application code: src/ (root)
- Active Next.js config: next.config.ts (root)

## Duplicate App Status

The duplicate my-app/ tree has been removed from the active repository layout.

## Why This Decision Was Made

- Root src/ is a strict superset of functionality.
- The former my-app/src tree had no unique feature files not already present in root src/.
- Keeping two active trees causes drift and slows delivery.

## Next Cleanup Step

Continue all development in the root workspace only.
