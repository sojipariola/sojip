"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import { DiagramEdge, DiagramNode, NODE_KINDS } from "@/lib/blueprint-api";

interface Props {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  onChange: (nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  locked: boolean;
  onNodeDoubleClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

function BlueprintNode({ data }: NodeProps) {
  const kindMeta =
    NODE_KINDS.find((k) => k.id === data.kind) || NODE_KINDS[7];
  const techStack: string[] = Array.isArray(data.tech_stack)
    ? data.tech_stack
    : [];
  const description: string | null = data.description || null;

  return (
    <div className="group relative">
      <div
        className="rounded-lg shadow-sm border-2 bg-white px-3 py-2 min-w-[140px] transition group-hover:shadow-md"
        style={{ borderColor: kindMeta.color }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-300"
        />
        <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
          {kindMeta.label}
        </div>
        <div className="text-sm font-medium text-slate-900 mt-0.5">
          {data.label}
        </div>
        {techStack.length > 0 && (
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            {techStack.join(" · ")}
          </div>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-slate-300"
        />
      </div>

      {/* Hover tooltip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-50
                   opacity-0 group-hover:opacity-100 transition pointer-events-none
                   bg-slate-900 text-white text-xs rounded-lg px-3 py-2 w-56 shadow-lg"
      >
        <p className="font-semibold text-[11px] mb-1">{kindMeta.label}</p>
        <p className="text-slate-300 text-[11px] leading-relaxed mb-1">
          {kindMeta.tooltip}
        </p>
        {description && (
          <p className="text-slate-400 text-[10px] leading-relaxed italic mt-1 pt-1 border-t border-slate-700">
            {description}
          </p>
        )}
        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700">
            {techStack.map((t) => (
              <span
                key={t}
                className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-200"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-2 italic">
          Double-click to edit
        </p>
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full
                     w-0 h-0 border-l-4 border-r-4 border-t-4
                     border-l-transparent border-r-transparent border-t-slate-900"
        />
      </div>
    </div>
  );
}

const nodeTypes = { blueprint: BlueprintNode };

export function BlueprintCanvas({
  nodes,
  edges,
  onChange,
  locked,
  onNodeDoubleClick,
  onEdgeClick,
}: Props) {
  const initialNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "blueprint",
        position: n.position,
        data: {
          label: n.label,
          kind: n.kind,
          tech_stack: n.tech_stack,
          description: n.description,
        },
      })),
    [nodes]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label:
          e.label ||
          (e.method || e.path
            ? `${e.method || ""} ${e.path || ""}`.trim()
            : undefined),
        type: "smoothstep",
        animated: e.kind === "event",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      })),
    [edges]
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  function persist(nextNodes: Node[], nextEdges: Edge[]) {
    const mappedNodes: DiagramNode[] = nextNodes.map((n) => ({
      id: n.id,
      label: String(n.data?.label || "Untitled"),
      kind: String(n.data?.kind || "backend"),
      description: (n.data?.description as string | null) ?? null,
      tech_stack: (n.data?.tech_stack as string[]) || [],
      position: n.position,
    }));
    const mappedEdges: DiagramEdge[] = nextEdges.map((e) => {
      // Find the original edge to preserve its metadata
      const original = edges.find((orig) => orig.id === e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: (e.label as string | null) ?? original?.label ?? null,
        kind: original?.kind || "data_flow",
        method: original?.method ?? null,
        path: original?.path ?? null,
      };
    });
    onChange(mappedNodes, mappedEdges);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      if (!connection.source || !connection.target) return;

      const newEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        label: null,
        kind: "data_flow",
        method: null,
        path: null,
      };

      setFlowEdges((eds) => addEdge(connection, eds));
      persist(flowNodes, [...flowEdges, newEdge as any]);
    },
    [locked, flowEdges, flowNodes, setFlowEdges]
  );

  function handleNodesChange(changes: any) {
    onNodesChange(changes);
    const hasPositionChange = changes.some(
      (c: any) => c.type === "position" && c.dragging === false
    );
    if (hasPositionChange) {
      setTimeout(() => persist(flowNodes, flowEdges), 100);
    }
  }

  return (
    <div className="h-[600px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node.id)}
        onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const kindMeta =
              NODE_KINDS.find((k) => k.id === n.data?.kind) || NODE_KINDS[7];
            return kindMeta.color;
          }}
          maskColor="rgba(255,255,255,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
