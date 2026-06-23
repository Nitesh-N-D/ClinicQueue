# 🏥 ClinicQueue

Free, SMS-based queue management for walk-in clinics, FQHCs, and community
health centers. Built because every existing tool (Waitwhile, QueueBuster) is
$50+/month and designed for retail — not for clinics where patients may not
have a smartphone.

**Live demo:** patients join via web or SMS, get real-time ML-predicted wait
times, and staff manage the whole queue from one simple dashboard — entirely
free to run.

---

## ✨ Features

- **SMS-first** — patients without smartphones can join and get updates by text
- **Real-time queue** — Socket.io powers instant updates for staff and patients
- **ML wait prediction** — rolling average model learns your clinic's actual pace
- **5 languages** — English, Spanish, Hindi, Tamil, French (SMS + web UI)
- **Walk-in + appointment hybrid** — matches how free clinics actually operate
- **Staff dashboard** — call next, mark serving/done/no-show, adjust staff count
- **Waiting room display board** — large-screen view for a TV in the lobby
- **Zero cost to run** — Supabase, Railway, Vercel, and Twilio all have free tiers

---

## 🧱 Tech stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Frontend   | React 18 + Vite + TypeScript + TailwindCSS + Framer Motion |
| Backend    | Node.js + Express + Socket.io + TypeScript |
| Database   | Supabase (PostgreSQL, free tier)     |
| SMS        | Twilio (free trial credit)           |
| Deployment | Render or Railway (backend) + Vercel (frontend) |

---

## 🚀 Local setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd clinicqueue
```

### 2. Set up Supabase (free, ~5 minutes)

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created, go to **SQL Editor** → paste the contents of
   `backend/src/db/schema.sql` → click **Run**
   (this creates the tables and seeds one demo clinic)
3. Go to **Project Settings → API** → copy your **Project URL** and
   **service_role key** (not the anon key — backend needs the service role)

### 3. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env and paste your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

You should see:
```
✅ ClinicQueue API running on http://localhost:3001
```

> **No Twilio yet?** That's fine — leave `SMS_ENABLED=false` in `.env` and
> all SMS messages will print to your terminal instead, so you can test the
> full flow before connecting a real phone number.

### 4. Frontend setup

In a new terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**

- Patient join: `/join`
- Staff dashboard: `/staff` (default PIN: `1234`, set via `STAFF_PIN` in backend `.env`)
- Waiting room display: `/display`

---

## 📱 Enabling real SMS (Twilio)

1. Sign up free at [twilio.com](https://www.twilio.com/try-twilio) — you get
   trial credit, enough for a full demo or small pilot
2. Get a free Twilio phone number from the console
3. In `backend/.env`, set:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+15550000000
   SMS_ENABLED=true
   ```
4. Restart the backend — SMS will now send for real
5. (Optional) Point your Twilio number's webhook to
   `https://your-backend-url/api/sms/incoming` so patients can text
   **HELP** or **LEAVE** to check status or leave the queue

---

## 🔐 Enabling Google sign-in for staff

PIN login works out of the box, but Google sign-in is recommended for real
clinics — it lets an admin control exactly who has access, see who did what,
and revoke access instantly without changing a shared PIN.

### 1. Enable Google as an auth provider in Supabase

1. In your Supabase project, go to **Authentication → Providers → Google**
2. Toggle it on
3. You need a Google OAuth Client ID/Secret:
   - Go to [console.cloud.google.com](https://console.cloud.google.com) →
     **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: copy the callback URL shown in Supabase's
     Google provider settings (looks like
     `https://xxxx.supabase.co/auth/v1/callback`)
   - Copy the generated **Client ID** and **Client Secret** into Supabase

### 2. Configure redirect URLs in Supabase

Go to **Authentication → URL Configuration** and add:
- Site URL: `http://localhost:5173` (and your production URL later)
- Redirect URLs: `http://localhost:5173/staff`, plus your production
  `https://yourdomain.com/staff`

### 3. Add the frontend env vars

In `frontend/.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key   # from Project Settings → API
```

> Note: the **anon key**, not the service role key, goes in the frontend.
> The service role key stays backend-only in `backend/.env`.

### 4. Run the schema update

If you set up the database before this feature existed, re-run
`backend/src/db/schema.sql` in the Supabase SQL editor — it's safe to run
again (`CREATE TABLE IF NOT EXISTS`) and will add the new `staff_members`
and `staff_invites` tables.

### 5. Make yourself the first admin

Before anyone can sign in, someone needs admin access. Two ways:

**Option A — invite yourself before logging in:**
```sql
INSERT INTO staff_invites (clinic_id, email, invited_by, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'you@example.com',
  '00000000-0000-0000-0000-000000000000',
  'admin'
);
```
Then sign in with Google using that email — you're automatically promoted.

**Option B — promote yourself after logging in once:**
1. Sign in with Google on `/staff` (you'll see "not authorized" — that's expected)
2. Go to Supabase → **Authentication → Users** → find your user → copy the UUID
3. Run:
```sql
INSERT INTO staff_members (clinic_id, user_id, email, name, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '<your-user-id>',
  'you@example.com',
  'Your Name',
  'admin'
);
```
4. Refresh `/staff` — you're in.

### 6. Invite the rest of your team

Once you're an admin, click the **team icon** (👥) in the staff dashboard
navbar to invite teammates by email. They'll be auto-approved the moment
they sign in with Google using that exact email address.

### How both auth methods coexist

- If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` aren't set, the staff
  login page shows **PIN-only** — nothing breaks, nothing changes.
- If they are set, the login page leads with **"Continue with Google"** and
  PIN becomes a collapsed fallback option underneath.
- The backend accepts *either* a valid Google session token *or* the
  correct PIN on every staff endpoint and the staff Socket.io connection.

---

## 🗂️ Project structure

```
clinicqueue/
├── backend/
│   └── src/
│       ├── index.ts              # Express + Socket.io server
│       ├── config.ts             # env var loading
│       ├── db/
│       │   ├── supabase.ts       # all database queries
│       │   └── schema.sql        # run once in Supabase SQL editor
│       ├── routes/api.ts         # REST endpoints
│       └── services/
│           ├── queueManager.ts   # core queue business logic
│           ├── waitPredictor.ts  # ML wait-time estimation
│           └── smsService.ts     # Twilio + multilingual templates
├── frontend/
│   └── src/
│       ├── App.tsx               # routing
│       ├── pages/                # Landing, Join, Status, Staff, Display
│       ├── hooks/useSocket.ts    # real-time Socket.io hooks
│       └── lib/api.ts            # typed API client
└── shared/types.ts               # types shared between frontend & backend
```

---

## 🧪 Demo script

1. Open `/display` on a laptop — this is your "waiting room TV"
2. Open `/join` on your phone — join the queue as a patient (use a real
   phone number if SMS is enabled, or any 10 digits if in demo mode)
3. Open `/staff` on another tab → PIN `1234` → click **Call Next Patient**
4. Watch all three screens update instantly: the display board, the
   patient's own status page, and the staff dashboard
5. Mark the patient as **Serving** → **Done** and show the average wait
   time recalculating in real time

---

## 📄 License

MIT — free to use, modify, and deploy for your own clinic or community project.
