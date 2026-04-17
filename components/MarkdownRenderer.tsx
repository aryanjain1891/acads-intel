"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { Components } from "react-markdown";

function sanitizeMermaid(chart: string): string {
  let s = chart;

  // Strip stray HTML tags in labels (<br/>, <b>, <div style='...'>, etc.) FIRST
  s = s.replace(/<[^>]+>/g, " ");
  // Collapse multiple spaces inside labels
  s = s.replace(/"\s+([^"]+?)\s+"/g, (_m, inner) => `"${inner.replace(/\s+/g, " ").trim()}"`);

  // Remove `direction TB/LR/BT/RL/TD` lines (inside subgraphs these break parsing)
  s = s.replace(/^\s*direction\s+(TB|BT|LR|RL|TD)\s*$/gm, "");

  // Strip `style` and `classDef` directives (often cause parse issues)
  s = s.replace(/^\s*style\s+\S+.*$/gm, "");
  s = s.replace(/^\s*classDef\s+.*$/gm, "");
  s = s.replace(/^\s*linkStyle\s+.*$/gm, "");

  // Convert `A -- "label" --> B` to `A -->|"label"| B`
  s = s.replace(/--\s*"([^"]+)"\s*-->/g, '-->|"$1"|');
  // Convert `A -- label --> B` (unquoted) to pipe form for ANY label (not just dashes)
  s = s.replace(/--\s+([^-|>\n"]+?)\s+-->/g, (_m, label) => `-->|"${label.trim()}"|`);

  // Normalize all node shape syntaxes to safe bracket-quoted form `X["label"]`
  // (("text"))  double-circle -> ["text"]
  s = s.replace(/(\b\w+)\(\(\s*"([^"]*)"\s*\)\)/g, '$1["$2"]');
  // (("text"))  unquoted
  s = s.replace(/(\b\w+)\(\(([^()]+)\)\)/g, '$1["$2"]');
  // >("text")  flag shape -> ["text"]
  s = s.replace(/(\b\w+)>\s*"([^"]*)"\s*\]/g, '$1["$2"]');
  // ("text")  rounded
  s = s.replace(/(\b\w+)\(\s*"([^"]*)"\s*\)/g, '$1["$2"]');
  // (unquoted text)  rounded
  s = s.replace(/(\b\w+)\(([^()\n]+)\)/g, '$1["$2"]');
  // {unquoted}  rhombus - keep only simple one-word labels
  s = s.replace(/(\b\w+)\{([^{}"\n]+)\}/g, (_m, id, text) => {
    return `${id}{"${text.trim()}"}`;
  });

  // Fix subgraph with spaces in identifier: `subgraph Foo Bar` -> `subgraph sgN ["Foo Bar"]`
  let sgCounter = 0;
  s = s.replace(/^(\s*)subgraph\s+([^\[\n]+?)\s*$/gm, (_m, indent, name) => {
    const trimmed = name.trim();
    if (/\s/.test(trimmed)) {
      return `${indent}subgraph sg${sgCounter++} ["${trimmed}"]`;
    }
    return `${indent}subgraph ${trimmed}`;
  });

  // Remove trailing semicolons (inconsistent support)
  s = s.replace(/;\s*$/gm, "");

  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, "\n\n");

  return s;
}

function stripEdgeLabels(chart: string): string {
  // Remove edge labels as a last-resort retry
  return chart.replace(/-->\|[^|]*\|/g, "-->").replace(/--\s+"[^"]*"\s+-->/g, "-->");
}

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  const render = useCallback(async () => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#1a1a2e",
        primaryColor: "#6366f1",
        primaryTextColor: "#e2e8f0",
        primaryBorderColor: "#4f46e5",
        lineColor: "#64748b",
        secondaryColor: "#1e293b",
        tertiaryColor: "#0f172a",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "14px",
      },
    });

    const sanitized = sanitizeMermaid(chart);
    const attempts = [sanitized, stripEdgeLabels(sanitized), chart];

    for (const source of attempts) {
      try {
        await mermaid.parse(source);
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, source);
        setSvg(rendered);
        return;
      } catch { /* try next */ }
    }
    setFailed(true);
  }, [chart]);

  useEffect(() => { render(); }, [render]);

  if (failed) {
    return (
      <SyntaxHighlighter
        style={oneDark}
        language="text"
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: "0.5rem", fontSize: "0.85rem", lineHeight: 1.6 }}
      >
        {chart}
      </SyntaxHighlighter>
    );
  }

  if (!svg) {
    return <div className="py-4 text-center text-sm text-muted">Rendering diagram...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="md-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");
    const isInline = !className && !codeString.includes("\n");

    if (isInline) {
      return (
        <code className="md-inline-code" {...props}>
          {children}
        </code>
      );
    }

    if (match?.[1] === "mermaid") {
      return <MermaidBlock chart={codeString} />;
    }

    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match?.[1] || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0.5rem",
          fontSize: "0.85rem",
          lineHeight: 1.6,
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    );
  },
  table({ children }) {
    return (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="md-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
