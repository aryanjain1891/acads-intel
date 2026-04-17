import { promises as fs } from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content");

const DEEP_EXPLAIN_PROMPT = `You are an expert tutor creating a comprehensive deep-explanation document from lecture transcript notes. The output will be rendered in a web app with full markdown support including KaTeX math, syntax-highlighted code blocks, and GFM tables.

**Your task:** Read the entire lecture transcript and produce a single, complete markdown document that explains every concept in insane depth. Cover EVERYTHING — do not skip or summarize any topic.

---

## STRUCTURE

1. **Title:** \`# Topic — Deep Explanation\` followed by a 1-2 sentence intro.
2. **Notation table:** If the transcript uses abbreviations or shorthand, place a markdown table near the top decoding all of them.
3. **Numbered parts:** Use \`## Part N: Title\` headings in transcript order. Each part builds on the previous.
4. **Depth per concept:** Intuition/why → formal definition → worked examples with explicit state at each step → pitfalls and edge cases.
5. **"Feel:" callouts:** After dense technical content, add a \`**Feel:**\` paragraph with an intuitive real-world analogy.
6. **Comparisons:** When multiple approaches exist, compare them — strengths, weaknesses, when to use each.
7. **Completeness:** Every topic, every example, every formula, every edge case from the transcript. Never truncate.

---

## RENDERING RULES (critical — the output is rendered with KaTeX, Prism, and GFM)

### Math (rendered via KaTeX)
- **ALL** mathematical expressions, formulas, equations, and variable references MUST use LaTeX math delimiters.
- Inline math: \`$x$\`, \`$P_j = \\text{Base}_j + \\frac{\\text{CPU}_j}{2}$\`
- Display math (standalone equations): \`$$T_{n+1} = \\alpha \\cdot t_n + (1 - \\alpha) \\cdot T_n$$\`
- Use math mode for variable names representing quantities: $n$, $S$, $P_i$, $\\alpha$, $T_n$.
- Subscripts and superscripts: $P_0$, $R_j$, $T_{n+1}$ — NOT P₀, Rⱼ, or Tₙ₊₁ (no unicode subscripts).
- Fractions: $\\frac{a}{b}$ — NOT a/b when it's a formula.
- Greek letters: $\\alpha$, $\\beta$, $\\Sigma$ — NOT α, β, Σ.
- Summations: $\\sum_{i=1}^{n} x_i$ for display.
- **NEVER** use backtick code (\\\`...\\\`) for math. Backtick code is ONLY for pseudocode/algorithms.

### Code (rendered via Prism with syntax highlighting)
- Pseudocode, algorithms, data structures, and procedural logic go in fenced code blocks.
- Use language hints when possible: \`\`\`c, \`\`\`python, \`\`\`text, \`\`\`java.
- Annotate lines with inline comments where helpful.
- Only use code blocks when the source material has code-like content.

### Tables (rendered via GFM)
- Use markdown tables for structured data: comparisons, Gantt charts, timelines, process states, scheduling traces.
- Tables MUST have a header row with \`|\` separators and a \`|---|---|\` separator line.

### Diagrams (rendered via Mermaid)
- When the content involves process flows, state transitions, resource allocation, or any concept that benefits from a visual, include a Mermaid diagram in a \`\`\`mermaid code block.
- Use simple diagram types: \`graph TD\`, \`graph LR\`, \`sequenceDiagram\`, \`stateDiagram-v2\`.
- Keep diagrams simple and focused — one concept per diagram.
- STRICT syntax rules (mermaid is very picky — violating these will break rendering):
  - **Edge labels MUST use pipe syntax:** \`A -->|"label"| B\` — NEVER use \`A -- "label" --> B\` (breaks when label contains dashes, slashes, or quotes)
  - Node IDs: no spaces, use camelCase (e.g., \`processA\`, \`readyQueue\`)
  - Node labels with special characters: wrap in double quotes (e.g., \`A["Process (main)"]\`)
  - NO HTML tags in labels — no \`<div>\`, \`<br/>\`, \`<b>\`, \`<br>\` etc. Use plain text only.
  - NO \`direction\` keyword inside subgraphs
  - NO semicolons at end of lines (optional and can cause issues)
  - Prefer flat graphs over deeply nested subgraphs
  - Good example:
    \`\`\`
    graph TD
        A["Source (file.c)"] -->|"compile"| B{"Compiler"}
        B -->|"success"| C["Object file"]
        B -->|"error"| D["Error messages"]
    \`\`\`
- Only include diagrams when they genuinely aid understanding — not every section needs one.

### General markdown
- **Bold** for key terms on first use.
- *Italic* for emphasis and "feel" sections.
- \`---\` horizontal rules between major parts.
- Nested lists for sub-points.
- Blockquotes (\`>\`) for important definitions or rules.
- No page numbers, no "Page X" labels, no meta-commentary about the transcript.

---

**Do NOT:**
- Skip any topic from the transcript
- Add content not in the transcript
- Write "the notes say" or "according to the transcript" — write as the teacher
- Truncate examples or leave calculations incomplete
- Use backtick code for math — always use $...$ or $$...$$
- Use unicode subscripts/superscripts (₀₁₂ₙ) — use LaTeX ($P_0$, $T_{n+1}$)`;

export async function generateDeepExplanation(
  transcriptPath: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const fullPath = path.join(CONTENT_DIR, transcriptPath);
  const transcript = await fs.readFile(fullPath, "utf-8");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  DEEP_EXPLAIN_PROMPT +
                  "\n\n---\n\nHere is the lecture transcript:\n\n" +
                  transcript,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 65536,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

export function getDeepExplainOutputPath(transcriptPath: string): string {
  const ext = path.extname(transcriptPath);
  const base = path.basename(transcriptPath, ext);
  return path.join(
    path.dirname(transcriptPath),
    `${base}-Deep-Explanation.md`
  );
}

export async function deepExplainExists(
  transcriptPath: string
): Promise<boolean> {
  const outPath = getDeepExplainOutputPath(transcriptPath);
  const fullPath = path.join(CONTENT_DIR, outPath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}
