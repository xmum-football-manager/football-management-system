# Storybook Setup Design

**Date:** 2026-05-12
**Status:** Approved

## Overview

Add Storybook 8 to the `web/` Next.js 16 / React 19 project using the `@storybook/nextjs` framework adapter. Stories live co-located next to their component files. A `web/README.md` documents how to run and write stories.

## Architecture

**Framework:** `@storybook/nextjs`
- Mocks `next/image`, `next/link`, `next/navigation` automatically.
- Uses the project's existing `postcss.config.mjs`, so Tailwind v4 processes without additional configuration.

**Builder:** Webpack 5 (bundled with `@storybook/nextjs`; no separate install needed).

**Config files generated:**
- `.storybook/main.ts` — framework, addons, story glob pattern
- `.storybook/preview.ts` — global decorators, imports `app/globals.css` for Tailwind

## Story Structure

Stories are co-located alongside components:

```
components/
  MatchCard.tsx
  MatchCard.stories.tsx
  TournamentCardItem.tsx
  TournamentCardItem.stories.tsx
  ...
```

Story glob in `main.ts`:
```
"../components/**/*.stories.@(ts|tsx)"
```

## Story Format

CSF3 with TypeScript:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs'
import { MatchCard } from './MatchCard'

const meta = {
  component: MatchCard,
} satisfies Meta<typeof MatchCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // props here
  },
}
```

## Package Scripts

Added to `package.json`:
```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

## README

A `web/README.md` is created (project had none) with sections covering:
1. Prerequisites
2. Install dependencies
3. Run the dev server
4. Run Storybook
5. Where stories live
6. How to write a new story (short CSF3 example)

## Compatibility Note

`@storybook/nextjs` officially targets Next.js 14/15. Next.js 16.2.4 is newer than its stated support range. In practice the framework adapter runs Next.js through a compatibility shim and is expected to work. If an incompatibility surfaces, the fallback is to switch the builder to `@storybook/react-vite` and manually import Tailwind + stub Next.js APIs.

## Out of Scope

- Storybook interactions addon / play functions
- Chromatic / visual regression CI
- MSW for API mocking in stories
- Stories for app/ route files
