# Rental Compass

Rental Compass is a personal rental-hunting workspace for tracking apartment and house listings from first interest to final decision. It combines a visual pipeline board, a map view, side-by-side comparison, and detailed property pages so you can manage your shortlist without bouncing between spreadsheets and chat threads.

## What the app does

- Track properties through a structured pipeline: Interested, Contacted, Viewing Scheduled, Deciding, and Archived.
- Add and edit property details such as rent, deposit, utilities, notes, viewing dates, and listing links.
- Use an inspection checklist per property to keep viewings and move-in tasks organized.
- View properties on a Google Maps interface with optional nearby-place overlays and user-location support.
- Compare up to three properties at once to review costs, stage, and inspection progress.
- Manage profile settings, avatar uploads, and account details through a Supabase-backed auth flow.

## Tech stack

- React 19 with TypeScript
- TanStack Router and TanStack Start for routing and app shell
- TanStack Query for data fetching and caching
- Tailwind CSS and a custom UI layer built around Radix-style primitives
- Supabase Auth, Postgres, and Storage
- Google Maps JavaScript API for mapping and place data
- Vite for local development and production builds

## Project structure

- src/routes: file-based routes for the board, map, compare, property details, auth, and profile screens
- src/components: reusable UI and feature components, including the property board, photo manager, and map widgets
- src/lib: API helpers, profile management, photo handling, mapping utilities, and error handling
- src/integrations: Supabase and Lovable connector integrations
- supabase/migrations: database schema and migration SQL

## Prerequisites

- Node.js 20+
- npm or bun
- A Supabase project
- A Google Maps API key with Maps JavaScript API enabled

## Environment variables

Create a local environment file named .env or .env.local with values similar to:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY=your-google-maps-key
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID=your-tracking-id
```

The app expects these values to be available at runtime for Supabase auth and Google Maps.

## Getting started

1. Install dependencies:

```bash
npm install
```

or, if you prefer Bun:

```bash
bun install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local URL shown by Vite/TanStack Start in your browser.

## Build

To build for production:

```bash
npm run build
```

## Notes

- The route tree is generated automatically. Avoid editing generated files by hand.
- The Supabase schema and storage buckets are expected to exist before the app can work fully.
- The current app is designed for a signed-in user experience and stores property data per account.
