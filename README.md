# Acads Intel

**Your whole semester, in one clean app, running on your laptop.**

Add your courses. Track your grades. Dump your lecture slides, handouts, and past papers into folders. Write your study plan. See every exam and deadline ahead of you. Hand any of it to your favorite AI chat when you want help.

Everything stays on your machine. No accounts, no cloud, no one else sees any of it.

---

## What it does for you

**Dashboard.** The first thing you see when you open it. Upcoming exams and deadlines sorted by date, every course at a glance, weighted grades updated live.

**Courses.** One page per course. Set up the grading scheme your professor actually uses (e.g. 20% quiz + 30% midsem + 50% endsem — or whatever). Enter marks as you get them. Your percentage updates automatically.

**Resources.** Upload your slides, notes, past papers, handouts. Drag them into folders. Reorder them. Preview PDFs and images right in the app without downloading anything. PowerPoint and Word files are supported too.

**Calendar.** Month view with every exam and deadline, color-coded.

**Notice board.** Per course. Auto-pulls course-related emails from Gmail using sender/subject filters you set, accepts manual paste of WhatsApp exports or `.eml` files, and uses Gemini to compile any subset of them into a single consolidated notice. Tick checkboxes to pick which notices feed the compile, then star the result to keep it — saved notices stay around (collapsible) while the live output is replaced on each new compile. Optional — works only if you connect Gmail and/or paste content yourself.

**Dark mode.** Obviously.

---

## Getting started

You need [Node.js](https://nodejs.org) installed (version 20 or newer). Then:

```bash
git clone https://github.com/aryanjain1891/acads-intel.git
cd acads-intel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **+ Add Course**.

That's it. Your data lives in `data/` and `content/` folders inside the project — all created automatically as you use the app.

### Optional: AI transcription of your PDFs

Drop a PDF of lecture notes and the app can transcribe it to searchable text — useful for feeding to an AI chat later. It uses Google's [Gemini API](https://aistudio.google.com/apikey), which has a generous free tier.

Get a key, then:

```bash
cp .env.example .env.local
# paste your key into .env.local
```

Skip this and every other feature still works — you just won't get auto-transcription.

### Optional: Connect Gmail for the notice board

The per-course notice board can auto-fetch course emails from your Gmail using sender/subject filters you set. Setup is one-time and runs entirely on your laptop.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create a project (or pick an existing one) → enable the **Gmail API**.
2. Go to **APIs & Services → Credentials** → **Create credentials → OAuth client ID** → application type **Web application**.
3. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`.
4. The first time you go through OAuth, Google will warn that the app is unverified — that's expected for a personal local app. Click "Advanced" → "Go to (unsafe)".
5. Copy the **Client ID** and **Client Secret** into Acads Intel → Settings → Gmail. Restart the dev server.
6. Click **Connect Gmail** → consent → done.
7. On any course page, click **⚙ Match patterns** to set sender substrings (e.g. `nalanda@bits-pilani.ac.in`), subject keywords (e.g. `CS F211`), and an optional start date. Then **↻ Refresh from Gmail** pulls matching messages into the notice board.
8. Tick checkboxes next to the notices you want to compile, write a prompt (or leave blank for the default), click **Compile** — Gemini returns one consolidated notice with a title and markdown body. Click **⭐ Save** to keep it permanently; the live output is otherwise replaced on the next compile.

The app requests only the read-only Gmail scope. Your refresh token sits in `data/google-auth.json` (gitignored). Disconnect anytime from Settings.

### Optional: Better PowerPoint previews

PowerPoint and Word files are previewable in the app out of the box. If you want slightly higher-fidelity previews, install [LibreOffice](https://www.libreoffice.org/download/) and the app will use it to convert to PDF on upload. Completely optional — the built-in previews work fine without it.

```bash
# macOS
brew install --cask libreoffice

# Ubuntu/Debian
sudo apt install libreoffice
```

---

## Where your stuff lives

Everything sits as normal files inside the project folder:

- `data/` — small JSON files for courses, exams, scores, deadlines, notices, saved notices
- `content/` — your uploaded PDFs, slides, notes, handouts

Back up the whole project folder and you've backed up everything. Delete it and it's all gone. No database, no cloud sync, nothing hidden.

---

## Works with any AI tool

Every "Ask an AI" button copies a plain-English prompt to your clipboard. Paste it into:

- **Claude** (web or desktop) — attach files from your `content/` folder
- **ChatGPT** — upload files and paste the prompt
- **Cursor / Windsurf / VS Code** — paste in a chat panel, `@`-mention the files
- **Anything else** — it's just text, it works everywhere

The app doesn't talk to any AI service directly (except optional Gemini for PDF OCR). Your conversations stay in whatever tool you prefer.

---

## For developers

<details>
<summary>Tech stack and internals</summary>

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. File-based storage — no database. Runs as a local dev server; intended for one person on one machine.

```
app/         Next.js pages and API routes
components/  shared UI
lib/         storage, AI helpers, Gmail OAuth, types
data/        JSON for courses, exams, scores, deadlines, resources, notices, oauth tokens
content/     uploaded files
```

All personal data directories (`data/`, `content/`) are gitignored.

</details>

## License

MIT
