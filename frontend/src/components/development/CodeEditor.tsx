"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import js from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import ts from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import r from "react-syntax-highlighter/dist/esm/languages/prism/r";
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import { toast } from "sonner";

import { FileContents, saveFileContents } from "@/lib/github-api";

// Register languages once
SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("typescript", ts);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("r", r);
SyntaxHighlighter.registerLanguage("docker", docker);

interface Props {
  owner: string;
  repo: string;
  file: FileContents | null;
  loading: boolean;
  onSaved?: () => void;
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    r: "r",
  };
  // Dockerfile has no extension
  if (path.endsWith("Dockerfile")) return "docker";
  return map[ext] || "text";
}

export function CodeEditor({
  owner,
  repo,
  file,
  loading,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset edit state when the file changes
  useEffect(() => {
    setEditing(false);
    setDraft(file?.content || "");
    setDirty(false);
  }, [file?.path, file?.sha]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileCode2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Select a file from the tree to view its contents.
          </p>
        </div>
      </div>
    );
  }

  const language = detectLanguage(file.path);

  function startEdit() {
    setDraft(file?.content || "");
    setEditing(true);
    setDirty(false);
  }

  function cancelEdit() {
    if (dirty && !confirm("Discard your changes?")) return;
    setDraft(file?.content || "");
    setEditing(false);
    setDirty(false);
  }

  async function save() {
    if (!file) return;
    if (draft === file.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const result = await saveFileContents(owner, repo, {
        path: file.path,
        content: draft,
        message: "Update " + file.path + " from SOJIP",
        sha: file.sha,
      });
      toast.success("Committed to GitHub", {
        description: "Commit " + (result.commit_sha || "").slice(0, 7),
      });
      setEditing(false);
      setDirty(false);
      onSaved?.();
    } catch (e) {
      toast.error("Could not save", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  const displayContent = editing ? draft : file.content;

  return (
    <div className="h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-mono text-slate-700 truncate">
            {file.path}
          </span>
          {dirty && (
            <span className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold shrink-0">
              Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!editing ? (
            <>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(file.content);
                  toast.success("File copied to clipboard");
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition"
                title="Copy file contents"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={file.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition"
                title="View on GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 ml-2 px-3 py-1.5 text-xs font-medium text-terracotta-600 hover:text-terracotta-700 hover:bg-terracotta-50 rounded-lg transition"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-terracotta-600 text-white hover:bg-terracotta-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Commit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(e.target.value !== file.content);
            }}
            className="w-full h-full p-4 text-xs font-mono text-slate-900 bg-white focus:outline-none resize-none"
            spellCheck={false}
          />
        ) : (
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              margin: 0,
              padding: "1rem",
              fontSize: "0.75rem",
              background: "transparent",
              minHeight: "100%",
            }}
            showLineNumbers
            wrapLongLines
          >
            {displayContent}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
