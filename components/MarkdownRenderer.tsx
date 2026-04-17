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
  // Convert `A -- "label" --> B` to `A -->|"label"| B` (more robust with special chars)
  s = s.replace(/--\s*"([^"]+)"\s*-->/g, '-->|"$1"|');
  // Convert `A -- label --> B` (unquoted) to `A -->|"label"| B` for labels containing dashes/slashes
  s = s.replace(/--\s+([^-|>\n"]+?)\s+-->/g, (match, label) => {
    if (/[-/]/.test(label)) return `-->|"${label.trim()}"|`;
    return match;
  });
  // Strip stray HTML tags in labels (<br/>, <b>, etc.)
  s = s.replace(/<[^>]+>/g, " ");
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

    const attempts = [
      sanitizeMermaid(chart),
      stripEdgeLabels(sanitizeMermaid(chart)),
      chart,
    ];

    for (const source of attempts) {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, source);
        if (!rendered.includes("Syntax error") && !rendered.includes("error-icon")) {
          setSvg(rendered);
          return;
        }
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
