# QMS Tracker — RubberForm Recycled Products

Quality Management System for tracking equipment, work orders, maintenance schedules, projects, and AI-powered email scanning at RubberForm Recycled Products LLC.

## Features

- **Equipment Registry** — Track all plant equipment with status, location, serial numbers, and open work order counts
- **Work Orders** — Create, assign, track, and complete work orders with priority levels and due dates
- **Maintenance Schedules** — Recurring maintenance schedules (daily/weekly/monthly/quarterly/annual) with overdue alerts
- **Maintenance Log** — History of all maintenance performed on equipment
- **Projects** — Track capital projects, equipment purchases, upgrades, and installations with budgets and due dates
- **AI Email Scanner** — Automatically scans Microsoft 365 email, Teams, and SharePoint for maintenance-related content using Claude AI, then suggests work orders, maintenance logs, or project creation
- **MS Forms Integration** — Auto-creates work orders from SharePoint/MS Forms submissions
- **Smart Equipment Detection** — AI distinguishes between parts and parent equipment; auto-creates equipment records on suggestion approval
- **Notifications** — Email and SMS (via carrier email gateway) notifications for work order assignments, status changes, AI suggestions, and overdue maintenance
- **Cross-linking** — All related records are hyperlinked — navigate from equipment to work orders, work orders to equipment, and everywhere in between
- **Recurring Maintenance** — Convert any work order into a recurring maintenance schedule with one click
- **Role-based Access** — Admin and operator roles with appropriate permissions

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth v5 (credentials provider, JWT sessions)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Microsoft 365:** MS Graph API for email/Teams/SharePoint scanning and email sending
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Deployment:** Railway (or any Node.js host)

## Architecture

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated pages (equipment, work orders, projects, etc.)
│   ├── api/                  # API routes (REST endpoints)
│   │   ├── equipment/        # Equipment CRUD
│   │   ├── work-orders/      # Work order CRUD + notification triggers
│   │   ├── projects/         # Project CRUD
│   │   ├── schedules/        # Maintenance schedule CRUD
│   │   ├── maintenance/      # Maintenance log CRUD
│   │   ├── suggestions/      # AI suggestion approval/rejection
│   │   ├── notifications/    # Notification list, mark read, unread count
│   │   ├── users/            # User management + notification preferences
│   │   ├── m365/             # Microsoft 365 OAuth + scanning
│   │   └── cron/             # Cron endpoints (maintenance checks, M365 polling)
│   └── login/                # Login page
├── components/               # React components (forms, cards, sidebar, etc.)
├── lib/
│   ├── ai/                   # Claude AI message analysis
│   ├── m365/                 # MS Graph client, scan orchestrator, encryption
│   └── notifications/        # Email templates, carrier gateways, notification service
└── middleware.ts              # Auth middleware
```

### AI Scanning Flow

1. User triggers scan or cron job polls automatically
2. **Poll** — Fetch new emails via MS Graph delta API + Teams channels + SharePoint lists
3. **Pre-filter** — Keyword matching filters obvious non-maintenance content
4. **Analyze** — Claude AI analyzes each message against the equipment registry
5. **Suggest** — AI creates suggestions: work orders, maintenance logs, status updates, projects, or flags for review
6. **Review** — Admins review suggestions, approve or reject
7. **Create** — Approved suggestions create actual records; unknown equipment is auto-registered

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `https://your-app.railway.app`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude AI |
| `AZURE_AD_CLIENT_ID` | For M365 | Azure AD app registration client ID |
| `AZURE_AD_CLIENT_SECRET` | For M365 | Azure AD app registration client secret |
| `AZURE_AD_TENANT_ID` | For M365 | Azure AD tenant ID |
| `M365_ENCRYPTION_KEY` | For M365 | 32-byte hex key for token encryption (`openssl rand -hex 32`) |
| `CRON_SECRET` | Optional | Secret for securing cron endpoints |
| `NEXT_PUBLIC_APP_URL` | Optional | Public app URL (fallback for NEXTAUTH_URL) |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Anthropic API key (for AI scanning)
- Azure AD app registration (for Microsoft 365 integration)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run database migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed the database with demo data
npm run db:seed

# Start dev server
npm run dev
```

### Initial Admin

The seed no longer creates default credentials. Provision the first admin
directly in the database (or via a one-off script) and create additional
users from the Users page after signing in.

### Railway Deployment

1. Create a new Railway project
2. Add a PostgreSQL service
3. Add environment variables (see table above)
4. Deploy from GitHub — Railway auto-detects Next.js
5. Run `npx prisma migrate deploy` in the Railway shell
6. Optionally seed: `npm run db:seed`

## Microsoft 365 Setup

1. Register an app in Azure AD (portal.azure.com > App registrations)
2. Add redirect URI: `{YOUR_APP_URL}/api/m365/callback`
3. Grant API permissions: `Mail.Read`, `Mail.Send`, `User.Read`, `Team.ReadBasic.All`, `ChannelMessage.Read.All`, `Sites.Read.All`, `Files.Read.All`
4. For SharePoint scanning, also grant application permissions: `Sites.Read.All`
5. Set the env vars (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`)
6. In the app, go to "My Email Scanner" and connect your M365 account

> **Note:** After updating to include `Mail.Send` permission, existing users must disconnect and reconnect their M365 account to grant the new permission.

## Notifications

Notifications are delivered via:
- **In-app** — Bell icon in sidebar shows unread count, notifications page lists all
- **Email** — Sent via MS Graph `sendMail` API from the connected M365 mailbox
- **SMS** — Sent via carrier email-to-SMS gateways (e.g. `5551234567@vtext.com` for Verizon) — no Twilio required

Configure preferences at Settings > Notification Preferences.

### Maintenance Due Cron

Set up a cron job to call `GET /api/cron/check-maintenance` daily with the `Authorization: Bearer {CRON_SECRET}` header to check for overdue maintenance and notify admins.
