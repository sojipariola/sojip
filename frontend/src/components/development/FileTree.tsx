"use client";

import { useMemo, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import clsx from "clsx";

import { TreeEntry } from "@/lib/github-api";

interface Props {
  entries: TreeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  loading?: boolean;
}

type TreeNode = {
  name: string;
  path: string;
  type: "blob" | "tree";
  children: TreeNode[];
};

/**
 * Build a nested tree from the flat list returned by GitHub.
 */
function buildTree(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Sort so directories come first, then files alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  const lookup: Record<string, TreeNode> = {};

  for (const entry of sorted) {
    const parts = entry.path.split("/");
    const name = parts[parts.length - 1];
    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type,
      children: [],
    };
    lookup[entry.path] = node;

    if (parts.length === 1) {
      // Top level
      root.push(node);
    } else {
      // Find parent
      const parentPath = parts.slice(0, -1).join("/");
      const parent = lookup[parentPath];
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not in lookup (rare — should be resolved because sorted
        // puts parents before children)
        root.push(node);
      }
    }
  }

  return root;
}

export function FileTree({ entries, selectedPath, onSelect, loading }: Props) {
  const tree = useMemo(() => buildTree(entries), [entries]);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-4 bg-slate-100 rounded animate-pulse"
            style={{ width: (60 + i * 8) + "%" }}
          />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-400">
        No files yet.
      </div>
    );
  }

  return (
    <div className="py-2 text-sm">
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = node.path === selectedPath;
  const isFolder = node.type === "tree";

  function handleClick() {
    if (isFolder) {
      setExpanded((e) => !e);
    } else {
      onSelect(node.path);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          "w-full flex items-center gap-1.5 pr-3 py-1 rounded transition text-left",
          isSelected && "bg-terracotta-50 text-terracotta-900",
          !isSelected && "hover:bg-slate-50"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isFolder ? (
          <>
            <ChevronRight
              className={clsx(
                "w-3.5 h-3.5 text-slate-400 shrink-0 transition",
                expanded && "rotate-90"
              )}
            />
            {expanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </>
        )}
        <span
          className={clsx(
            "truncate text-xs font-mono",
            isSelected ? "text-terracotta-900 font-medium" : "text-slate-700"
          )}
        >
          {node.name}
        </span>
      </button>

      {isFolder && expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
