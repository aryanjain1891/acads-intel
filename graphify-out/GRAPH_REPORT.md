# Graph Report - .  (2026-04-11)

## Corpus Check
- Corpus is ~17,567 words - fits in a single context window. You may not need a graph.

## Summary
- 140 nodes · 172 edges · 22 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `4-2 Acads Project` - 22 edges
2. `Storage Layout Structure` - 7 edges
3. `handleConfirmDelete()` - 6 edges
4. `Resources Feature` - 6 edges
5. `apiFetch()` - 5 edges
6. `Exam & Deadline Tracking Feature` - 5 edges
7. `Next.js 16 (App Router)` - 5 edges
8. `GET()` - 4 edges
9. `POST()` - 4 edges
10. `convertToPdf()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Globe/World Icon (SVG)` --conceptually_related_to--> `4-2 Acads Project`  [INFERRED]
  public/globe.svg → README.md
- `Window/Browser Icon (SVG)` --conceptually_related_to--> `4-2 Acads Project`  [INFERRED]
  public/window.svg → README.md
- `File/Document Icon (SVG)` --conceptually_related_to--> `Resources Feature`  [INFERRED]
  public/file.svg → README.md
- `Next.js Logo (SVG)` --conceptually_related_to--> `Next.js 16 (App Router)`  [INFERRED]
  public/next.svg → README.md
- `Vercel Logo (SVG)` --conceptually_related_to--> `Next.js 16 (App Router)`  [INFERRED]
  public/vercel.svg → README.md

## Communities

### Community 0 - "Course Page UI"
Cohesion: 0.06
Nodes (0): 

### Community 1 - "AI & OCR Pipeline"
Cohesion: 0.18
Nodes (10): deepExplainExists(), getDeepExplainOutputPath(), GET(), getContentTypeFromExtension(), getFileTypeFromExtension(), getTranscriptPath(), POST(), PUT() (+2 more)

### Community 2 - "API Client Layer"
Cohesion: 0.21
Nodes (5): apiDelete(), apiFetch(), apiPost(), apiPostForm(), apiPut()

### Community 3 - "File Storage Engine"
Cohesion: 0.18
Nodes (3): convertToPdf(), findSoffice(), saveUpload()

### Community 4 - "Course & Resource Management"
Cohesion: 0.22
Nodes (10): File/Document Icon (SVG), Course Management Feature, courses.json Data File, @dnd-kit (Drag and Drop), exams.json Data File, PYQ Management Feature, resource-folders.json Data File, Resources Feature (+2 more)

### Community 5 - "App Core & Architecture"
Cohesion: 0.28
Nodes (9): Globe/World Icon (SVG), 4-2 Acads Project, Assignments Feature, Dark Mode Feature, File-based Storage (JSON + Disk), Local-First Architecture Rationale, Study Plans Feature, Tailwind CSS 4 (+1 more)

### Community 6 - "Delete Operations"
Cohesion: 0.33
Nodes (6): doDeleteDeadline(), doDeleteExam(), doDeleteHandout(), doDeleteResource(), doDeleteScore(), handleConfirmDelete()

### Community 7 - "Calendar & Score Tracking"
Cohesion: 0.33
Nodes (6): Calendar Feature, Dashboard Feature, deadlines.json Data File, Exam & Deadline Tracking Feature, Score Tracker Feature, scores.json Data File

### Community 8 - "Frontend Tech Stack"
Cohesion: 0.4
Nodes (5): Next.js Logo (SVG), Next.js 16 (App Router), React 19, TypeScript, Vercel Logo (SVG)

### Community 9 - "Dialog & Modal Components"
Cohesion: 0.5
Nodes (0): 

### Community 10 - "Prompt Button"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Markdown Renderer"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Folder Management"
Cohesion: 1.0
Nodes (2): createFolder(), moveSelectedToFolder()

### Community 13 - "Sortable Item"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Course CRUD"
Cohesion: 1.0
Nodes (2): addCourse(), reload()

### Community 15 - "Tabs Component"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Cursor Button"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "AI Integration"
Cohesion: 1.0
Nodes (2): AI Integration Feature, Gemini API (PDF OCR)

### Community 18 - "Handouts Data"
Cohesion: 1.0
Nodes (2): Handouts Feature, handouts.json Data File

### Community 19 - "PDF Conversion"
Cohesion: 1.0
Nodes (2): LibreOffice (Office to PDF), PPTX to PDF Conversion Feature

### Community 20 - "Next Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Next Config"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **9 isolated node(s):** `Dark Mode Feature`, `Tailwind CSS 4`, `Gemini API (PDF OCR)`, `LibreOffice (Office to PDF)`, `File/Document Icon (SVG)` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Prompt Button`** (2 nodes): `PromptButton.tsx`, `copy()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Markdown Renderer`** (2 nodes): `MarkdownRenderer.tsx`, `MermaidBlock()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Folder Management`** (2 nodes): `createFolder()`, `moveSelectedToFolder()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sortable Item`** (2 nodes): `SortableItem.tsx`, `SortableItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Course CRUD`** (2 nodes): `addCourse()`, `reload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tabs Component`** (2 nodes): `Tabs.tsx`, `Tabs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cursor Button`** (2 nodes): `CursorButton.tsx`, `copy()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Integration`** (2 nodes): `AI Integration Feature`, `Gemini API (PDF OCR)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Handouts Data`** (2 nodes): `Handouts Feature`, `handouts.json Data File`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Conversion`** (2 nodes): `LibreOffice (Office to PDF)`, `PPTX to PDF Conversion Feature`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4-2 Acads Project` connect `App Core & Architecture` to `Course & Resource Management`, `Calendar & Score Tracking`, `Frontend Tech Stack`, `AI Integration`, `Handouts Data`, `PDF Conversion`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `Resources Feature` connect `Course & Resource Management` to `App Core & Architecture`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Next.js 16 (App Router)` connect `Frontend Tech Stack` to `App Core & Architecture`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `4-2 Acads Project` (e.g. with `Globe/World Icon (SVG)` and `Window/Browser Icon (SVG)`) actually correct?**
  _`4-2 Acads Project` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Resources Feature` (e.g. with `@dnd-kit (Drag and Drop)` and `resources.json Data File`) actually correct?**
  _`Resources Feature` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Dark Mode Feature`, `Tailwind CSS 4`, `Gemini API (PDF OCR)` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Course Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._