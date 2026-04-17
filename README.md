# Acads Intel

Your whole semester, in one clean app — running on your laptop.

Add your courses. Track your grades as the term goes on. Upload your lecture notes and handouts. Plan what you need to study. See every exam and deadline coming up, on a calendar. Hand your notes to your AI coding assistant when you want help understanding something.

Everything stays on your machine. No accounts, no cloud, no one else sees any of it.

## What you can do with it

**See what's next.** The dashboard shows upcoming exams and deadlines sorted by date, so you always know what's this week, what's next week, and what to stop worrying about.

**Track every grade.** Set up your own grading components for each course — quizzes, midsem, project, whatever your prof uses, with their real weightages. Enter marks as you get them and see your weighted percentage update live.

**Keep your notes organized.** Upload slides, handouts, past papers, and your own notes. Sort them into folders. Drag to reorder. Preview PDFs and images inline without downloading.

**Plan your studying.** Each course gets its own Markdown notebook — write out your study plan, topic breakdowns, or anything else you want to keep with the course.

**Let AI help you study.** If you use Cursor, one click hands your course notes to the AI with a ready-made prompt: "help me prep for the exam", "explain this lecture in depth", "solve these past papers", and so on.

**Calendar view.** Month-at-a-glance of every exam and deadline, color-coded.

**Dark mode.** Of course.

## Getting started

You'll need [Node.js](https://nodejs.org) installed. Then:

```bash
git clone https://github.com/aryanjain1891/acads-intel.git
cd acads-intel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first time you open it, you'll see a welcome screen. Click **+ Add Course** and you're off.

### Optional: AI-powered PDF transcription

If you upload PDF lecture notes and want the app to auto-extract the text (so you can search it and feed it to an AI later), add a free [Gemini API key](https://aistudio.google.com/app/apikey):

```bash
cp .env.example .env.local
# open .env.local and paste your key
```

### Optional: PowerPoint and Word support

To automatically convert `.pptx`, `.docx`, and other Office files to PDF when you upload them, install LibreOffice:

```bash
# macOS
brew install --cask libreoffice

# Ubuntu / Debian
sudo apt install libreoffice
```

If you skip this, PPTX and DOCX uploads still work — they just won't render inline.

## Where your stuff lives

Everything is saved in plain files inside the project folder — JSON for structured data, your actual PDFs and notes sitting on disk exactly as you uploaded them. Delete the folder and it's all gone. Copy the folder and you've backed it up.

## For developers

<details>
<summary>Tech details</summary>

Built with Next.js 16, React 19, TypeScript, and Tailwind. File-based storage — no database to set up. Runs as a local dev server; intended for one person on one machine.

```
data/           JSON for courses, exams, scores, deadlines, resources metadata
content/        uploaded files (handouts, resources, study plans)
assignments/    assignment workspace folders
```

All three directories are created on first use and are gitignored.

</details>

## License

MIT
