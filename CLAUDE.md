# Jtracker

Personal job-application tracker. Vite + React + TypeScript (strict),
Sass, Storybook. Public repo: sample data only, never real applications.

## Styles
Follow node_modules/octet-scss/CONVENTIONS.md for all styles.
- Theme lives in src/styles/theme/ (forked from octet's starter-theme).
- src/styles/theme/_theme-spacing.scss holds the distance between and around
  things: margin, padding, gap.
- src/styles/theme/_theme-layout.scss holds the size and arrangement of things:
  width/height, grid/flex, alignment, position, the app shell.
- Component partials keep only how things look: color, type, borders, radius,
  shadow, motion.
- Component partials: src/styles/components/, one BEM block each.

## App rules
- UI talks to data only through src/storage/StorageAdapter.
- Age and follow-up-due are calculated (src/lib/derive.ts), never stored.
  Follow-up due = status Applied AND no followedUpDate AND age >= setting.
- `today` is computed once in App and passed down; stories use a fixed date.
- Accessibility: WCAG AA. Native elements first; ARIA only where needed.

## Change discipline
- Don't commit. Show what changed and suggest a commit message; I review
  every diff in Git Tower.
- Typecheck, lint, Vite build and Storybook build must pass.
- Ask before adding a dependency, token, mixin or new spacing file.
