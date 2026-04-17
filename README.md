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

**Study plans.** A Markdown notebook per course — write out your plan for the term, topic breakdowns, anything you want to keep next to the course.

**Assignments.** Create a folder per assignment. Open it in Finder/Explorer or any editor.

**AI helpers.** Every course page has one-click prompts — "help me prep for my exam", "summarize the modules", "solve these past papers". Click, paste into Claude/ChatGPT/Cursor/whatever, attach your files, done. The app doesn't lock you into any one tool.

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

That's it. Your data lives in `data/`, `content/`, and `assignments/` folders inside the project — all created automatically as you use the app.

### Optional: AI transcription of your PDFs

Drop a PDF of lecture notes and the app can transcribe it to searchable text — useful for feeding to an AI chat later. It uses Google's [Gemini API](https://aistudio.google.com/apikey), which has a generous free tier.

Get a key, then:

```bash
cp .env.example .env.local
# paste your key into .env.local
```

Skip this and every other feature still works — you just won't get auto-transcription.

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

- `data/` — small JSON files for courses, exams, scores, deadlines
- `content/` — your uploaded PDFs, slides, notes, study plans
- `assignments/` — one folder per assignment, yours to organize

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
lib/         storage, AI helpers, types
data/        JSON for courses, exams, scores, deadlines, resources metadata
content/     uploaded files
assignments/ assignment workspaces
```

All personal data directories (`data/`, `content/`, `assignments/`) are gitignored.

</details>

## License

MIT
