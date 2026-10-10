# Jtracker

Personal job-application tracker. Vite + React + TypeScript (strict),
Sass, Storybook. Public repo: sample data only, never real applications.

## Styles
Follow node_modules/octet-scss/CONVENTIONS.md for all styles.
- Theme lives in src/styles/theme/ (forked from octet's starter-theme).
- Spacing vs layout: the property decides (CONVENTIONS §1). margin/padding/gap
  that's shared or page-level → theme/_theme-spacing.scss; width/height,
  grid/flex, alignment, position that's shared or page-level →
  theme/_theme-layout.scss. One component's own spacing/layout stays in its
  partial.
- No height rules. Height = content line-height + padding, on the 8pt grid.
  Controls share one pattern: 24px line-height (_typography.scss) + 12px
  padding top/bottom (_theme-spacing.scss), so baselines line up across a page.
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
