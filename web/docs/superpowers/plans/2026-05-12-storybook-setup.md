# Storybook Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and configure Storybook 8 with `@storybook/nextjs`, wire up Tailwind v4, add a smoke-test story for `MatchCard`, and document the setup in `web/README.md`.

**Architecture:** `storybook init` scaffolds `.storybook/main.ts` and `.storybook/preview.ts`. The preview imports `app/globals.css` so CSS variables and Tailwind utilities are available in every story. Stories are co-located alongside components in CSF3 format.

**Tech Stack:** Storybook 8, `@storybook/nextjs`, `@storybook/addon-essentials`, React 19, Next.js 16, Tailwind v4, TypeScript, pnpm.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.storybook/main.ts` | Framework, addons, story glob |
| Create | `.storybook/preview.ts` | Import globals.css, dark background default |
| Modify | `package.json` | Add `storybook` and `build-storybook` scripts |
| Create | `components/MatchCard.stories.tsx` | Smoke-test story (Upcoming, Live, Finished) |
| Create | `README.md` | Project README with Storybook instructions |

---

### Task 1: Install Storybook

**Files:**
- Modify: `package.json`
- Create: `.storybook/main.ts` (generated)
- Create: `.storybook/preview.ts` (generated)

- [ ] **Step 1: Run the Storybook initialiser**

From the `web/` directory:

```bash
pnpm dlx storybook@latest init --yes
```

Expected output: installs `@storybook/nextjs`, `@storybook/addon-essentials`, scaffolds `.storybook/main.ts` and `.storybook/preview.ts`, adds `storybook` and `build-storybook` scripts to `package.json`. It may also generate a `stories/` sample folder — ignore it for now.

- [ ] **Step 2: Verify scripts were added to `package.json`**

```bash
grep -E '"storybook"|"build-storybook"' package.json
```

Expected:
```
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

If absent, add them manually to the `"scripts"` block in `package.json`:
```json
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

- [ ] **Step 3: Commit**

```bash
git add .storybook package.json pnpm-lock.yaml
git commit -m "chore: install Storybook 8 with @storybook/nextjs"
```

---

### Task 2: Configure `.storybook/main.ts`

**Files:**
- Modify: `.storybook/main.ts`

- [ ] **Step 1: Replace `main.ts` with the correct config**

Open `.storybook/main.ts` and replace its entire contents with:

```ts
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
}

export default config
```

The `stories` glob picks up only co-located component stories. Delete the generated sample folder if present:

```bash
rm -rf stories/
```

- [ ] **Step 2: Commit**

```bash
git add .storybook/main.ts
git rm -r --cached stories/ 2>/dev/null || true
git commit -m "chore: configure Storybook story glob and remove sample stories"
```

---

### Task 3: Configure `.storybook/preview.ts`

**Files:**
- Modify: `.storybook/preview.ts`

- [ ] **Step 1: Replace `preview.ts`**

Open `.storybook/preview.ts` and replace its entire contents with:

```ts
import type { Preview } from '@storybook/nextjs'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'pitch',
      values: [
        { name: 'pitch', value: '#0E1A12' },
        { name: 'light', value: '#F4F7EE' },
      ],
    },
  },
}

export default preview
```

Importing `globals.css` makes Tailwind utilities and all CSS variables (`--ink-*`, `--brand-*`, `--radius-*`, etc.) available in every story. The `backgrounds` preset defaults to the app's dark pitch colour.

- [ ] **Step 2: Commit**

```bash
git add .storybook/preview.ts
git commit -m "chore: import globals.css and set dark background default in Storybook preview"
```

---

### Task 4: Write the MatchCard smoke-test story

**Files:**
- Create: `components/MatchCard.stories.tsx`

- [ ] **Step 1: Create `components/MatchCard.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs'
import { MatchCard } from './MatchCard'

const meta = {
  component: MatchCard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MatchCard>

export default meta
type Story = StoryObj<typeof meta>

const baseMatch = {
  id: '1',
  tournament_id: 't1',
  home_team_id: 'h1',
  away_team_id: 'a1',
  match_time: '2026-05-12T15:00:00Z',
  home_score: 0,
  away_score: 0,
  match_started_at: null,
  match_finished_at: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  home_team: { id: 'h1', tournament_id: 't1', name: 'Rovers FC', created_at: '2026-05-01T00:00:00Z' },
  away_team: { id: 'a1', tournament_id: 't1', name: 'United SC', created_at: '2026-05-01T00:00:00Z' },
}

export const Upcoming: Story = {
  args: {
    match: { ...baseMatch, status: 'scheduled' },
  },
}

export const Live: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'live',
      home_score: 2,
      away_score: 1,
      match_started_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    },
  },
}

export const Finished: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'finished',
      home_score: 3,
      away_score: 2,
      match_finished_at: '2026-05-12T17:00:00Z',
    },
  },
}
```

- [ ] **Step 2: Verify Storybook starts and renders the stories**

```bash
pnpm storybook
```

Open `http://localhost:6006`. The sidebar should show **MatchCard → Upcoming / Live / Finished**. Each story should render on the dark pitch background with lime accents and correct fonts. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add components/MatchCard.stories.tsx
git commit -m "feat: add MatchCard stories (upcoming, live, finished)"
```

---

### Task 5: Create `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `web/README.md`**

```markdown
# Football Manager — Web

Next.js 16 front-end for the Football Manager tournament platform.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) — install with `npm i -g pnpm`

## Install dependencies

```bash
pnpm install
```

## Run the dev server

```bash
pnpm dev
```

Opens at `http://localhost:3000`.

## Run Storybook

```bash
pnpm storybook
```

Opens at `http://localhost:6006`.

Storybook renders UI components in isolation with the app's full design system loaded (fonts, CSS variables, Tailwind utilities). Use it to develop and inspect components without running the full app or needing a database connection.

## Writing a story

Stories live **co-located** next to their component file:

```
components/
  MatchCard.tsx
  MatchCard.stories.tsx   ← story file
```

Use [CSF3](https://storybook.js.org/docs/writing-stories) format with TypeScript:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs'
import { MyComponent } from './MyComponent'

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // props here
  },
}
```

## Run tests

```bash
pnpm test
```

## Build for production

```bash
pnpm build
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with Storybook setup instructions"
```

---

### Task 6: Add `storybook-static/` to `.gitignore`

**Files:**
- Modify: `.gitignore` (or create if absent)

- [ ] **Step 1: Add the entry**

```bash
echo 'storybook-static/' >> .gitignore
```

- [ ] **Step 2: Verify**

```bash
grep 'storybook-static' .gitignore
```

Expected: `storybook-static/`

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore storybook-static build output"
```
