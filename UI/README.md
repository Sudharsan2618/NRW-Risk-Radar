# SWARION - Sales Automation. Reimagined (Next.js)

Next.js 14 (App Router, TypeScript) port of the Agamx Design System + Milo CRM prototype.

## Stack

- **Next.js 14** (App Router, React Server Components)
- **TypeScript** strict mode
- **Design tokens** as CSS variables in `app/globals.css` (Figtree + JetBrains Mono from Google Fonts)
- No CSS framework — inline styles + tokens, matching the original design system

Recommended additions for full SaaS:
- **Auth / multi-tenancy** — Clerk
- **Database / ORM** — Supabase (Postgres) + Prisma
- **Billing** — Stripe
- **AI (Milo assistant)** — Anthropic SDK
- **Background jobs** — Inngest
- **Deploy** — Vercel

## Run

```bash
cd milo-app
npm install
npm run dev
```

Open <http://localhost:3000> — redirects to `/dashboard`.

## Routes

| Path              | Component                                |
|-------------------|-------------------------------------------|
| `/dashboard`      | Task list with sections, add/check/delete |
| `/settings`       | Profile, notifications, members, billing… |
| `/account-intel`  | Market Radar → Account Intelligence       |

Sidebar items that are not yet wired (Reminders, Ask Milo, Sequences, etc.) currently route to `/dashboard`. Add new routes under `app/<route>/page.tsx` and map them in `app/AppShell.tsx`.

## Structure

```
milo-app/
├── app/
│   ├── layout.tsx              Root HTML shell
│   ├── globals.css             All design tokens + base styles
│   ├── AppShell.tsx            AppBar + Sidebar + main, wires routing
│   ├── page.tsx                Redirect → /dashboard
│   ├── dashboard/page.tsx
│   ├── settings/page.tsx
│   └── account-intel/page.tsx
├── components/
│   ├── ui/                     Design system (reusable)
│   │   ├── Button.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Toggle.tsx
│   │   ├── Card.tsx
│   │   └── Tabs.tsx
│   └── milo/                   Product surfaces
│       ├── AppBar.tsx
│       ├── Sidebar.tsx
│       ├── DashboardView.tsx
│       ├── SettingsView.tsx
│       └── AccountIntelView.tsx
└── public/
    └── logo.png
```

## Design tokens

All colors, spacing, type, radius, and shadows are CSS variables in `app/globals.css`. Reference them in any component via `var(--color-brand)`, `var(--space-4)`, etc. Source of truth — change once, applies everywhere.
