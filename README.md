# IT Services ERP SaaS

Production-ready ERP system for IT service companies.

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **State**: Zustand
- **Backend**: Supabase (Auth, DB, Storage, Realtime)
- **Routing**: React Router

## Project Structure
See `ARCHITECTURAL_BLUEPRINT.md` (in system artifacts) or refer to the `src/modules` directory for the feature-based structure.

## Quick Start
1. `npm install`
2. Copy `.env.example` to `.env` and add your Supabase credentials.
3. `npm run dev`

## Modules
- **CRM**: Lead and contact management.
- **Projects**: Project tracking and milestones.
- **Tasks**: Granular task management.
- **Billing**: Invoicing and payments.
- **Time Tracking**: Timesheets and productivity logs.
- **Reports**: Business intelligence and analytics.
- **Client Portal**: Dedicated interface for your customers.
- **Admin**: System-wide settings.
