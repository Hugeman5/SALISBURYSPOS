# Salisburys POS

This is a Next.js Point of Sale application, in the style of Lightspeed, for the South African market.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Seeding Data

To seed the Firestore database with initial data (users, settings, menu items), run:

```bash
npm run seed
```

Make sure your `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set correctly before running the seed script.
