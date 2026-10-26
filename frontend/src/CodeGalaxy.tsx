
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    useReactFlow,
    type Edge,
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type GraphNode = {
    id: string;
    type: string;
    name: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
};

export type GraphRelationship = {
    sourceId: string;
    type: string;
    targetId: string;
};

export type CodeGraph = {
    nodes: GraphNode[];
    relationships: GraphRelationship[];
};

type Props = {
    graph: CodeGraph;
    onSelectNode?: (node: GraphNode | null) => void;
    focusNodeId?: string | null;
};

const relationshipColors: Record<string, string> = {
    CONTAINS: "#64748b",
    IMPORTS: "#94a3b8",
    CALLS: "#81b9b5",
    EXTENDS: "#c084fc",
    IMPLEMENTS: "#f472b6",
    REFERENCES: "#60a5fa",
    DEPENDS_ON: "#fbbf24",
    OVERRIDES: "#fb923c",
    DISPATCHES_TO: "#f87171",
};

const nodeColors: Record<string, string> = {
    FILE: "#60a5fa",
    CLASS: "#c084fc",
    INTERFACE: "#f472b6",
    METHOD: "#34d399",
    FUNCTION: "#2dd4bf",
    FIELD: "#fbbf24",
    VARIABLE: "#fb923c",
};

function FocusSelectedNode({
                               focusNodeId,
                               nodes,
                               onFocused,
                           }: {
    focusNodeId?: string | null;
    nodes: Node[];
    onFocused: (nodeId: string) => void;
}) {
    const { getNode, setCenter } = useReactFlow();

    useEffect(() => {
        if (!focusNodeId) return;

        const flowNode = getNode(focusNodeId);
        if (!flowNode) return;

        const width = flowNode.measured?.width ?? 160;
        const height = flowNode.measured?.height ?? 44;

        void setCenter(
            flowNode.position.x + width / 2,
            flowNode.position.y + height / 2,
            { zoom: 1.2, duration: 450 }
        );

        onFocused(focusNodeId);
    }, [focusNodeId, nodes, getNode, setCenter, onFocused]);

    return null;
}

export default function CodeGalaxy({
                                       graph,
                                       onSelectNode,
                                       focusNodeId,
                                   }: Props) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set()
    );
    const [showAll, setShowAll] = useState(false);
    const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [visibleRelationshipTypes, setVisibleRelationshipTypes] = useState<Set<string>>(
        () => new Set([
            "CONTAINS", "IMPORTS", "CALLS", "EXTENDS", "IMPLEMENTS",
            "REFERENCES", "DEPENDS_ON", "OVERRIDES", "DISPATCHES_TO",
        ])
    );

    const availableRelationshipTypes = useMemo(
        () => Array.from(new Set(graph.relationships.map((relationship) => relationship.type))).sort(),
        [graph.relationships]
    );

    const filteredRelationships = useMemo(
        () => graph.relationships.filter((relationship) => visibleRelationshipTypes.has(relationship.type)),
        [graph.relationships, visibleRelationshipTypes]
    );

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) return [];

        return graph.nodes
            .filter(
                (node) =>
                    node.name.toLowerCase().includes(query) ||
                    node.filePath.toLowerCase().includes(query)
            )
            .slice(0, 10);
    }, [graph.nodes, searchQuery]);

    const handleSearchSelect = (node: GraphNode) => {
        setShowAll(true);
        setSelectedNodeId(node.id);
        setExpandedIds((previous) => new Set(previous).add(node.id));
        setPendingFocusId(node.id);
        onSelectNode?.(node);
        setSearchQuery(node.name);
        setSearchOpen(false);
    };

    const visibleGraphNodes = useMemo(() => {
        if (showAll) return graph.nodes;

        const visibleIds = new Set<string>();

        graph.nodes.forEach((node) => {
            if (["FILE", "CLASS", "INTERFACE"].includes(node.type)) {
                visibleIds.add(node.id);
            }
        });

        expandedIds.forEach((id) => {
            visibleIds.add(id);

            filteredRelationships.forEach((relationship) => {
                if (relationship.sourceId === id) {
                    visibleIds.add(relationship.targetId);
                }

                if (relationship.targetId === id) {
                    visibleIds.add(relationship.sourceId);
                }
            });
        });

        return graph.nodes.filter((node) => visibleIds.has(node.id));
    }, [graph, filteredRelationships, expandedIds, showAll]);

    const activeNodeId = focusNodeId ?? selectedNodeId ?? null;

    const { nodes, edges } = useMemo(() => {
        const visibleIds = new Set(
            visibleGraphNodes.map((node) => node.id)
        );

        const connectedNodeIds = new Set<string>();

        if (activeNodeId) {
            connectedNodeIds.add(activeNodeId);

            filteredRelationships.forEach((relationship) => {
                if (relationship.sourceId === activeNodeId) {
                    connectedNodeIds.add(relationship.targetId);
                }

                if (relationship.targetId === activeNodeId) {
                    connectedNodeIds.add(relationship.sourceId);
                }
            });
        }

        const hasConnectedSelection = connectedNodeIds.size > 1;
        const query = searchQuery.trim().toLowerCase();

        const flowNodes: Node[] = visibleGraphNodes.map((node, index) => {
            const angle = index * 2.39996;
            const radius = 100 + Math.sqrt(index) * 75;
            const accent = nodeColors[node.type] ?? "#8493a8";

            const isSelected = node.id === activeNodeId;
            const isConnected = connectedNodeIds.has(node.id);
            const isUnrelated =
                hasConnectedSelection && !isConnected;

            const isSearchMatch =
                query.length > 0 &&
                (node.name.toLowerCase().includes(query) ||
                    node.filePath.toLowerCase().includes(query));

            const isDimmed =
                isUnrelated ||
                (query.length > 0 && !isSearchMatch && !isSelected);

            return {
                id: node.id,
                position: {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                },
                data: { label: node.name },
                style: {
                    background: isSelected
                        ? "#263b50"
                        : isSearchMatch
                            ? `${accent}20`
                            : "#151c27",
                    color: "#dce3ec",
                    border: isSelected
                        ? "2px solid #ffffff"
                        : isSearchMatch
                            ? `2px solid ${accent}`
                            : `1px solid ${accent}90`,
                    borderRadius: 9,
                    padding: 10,
                    fontSize: 11,
                    width: 160,
                    boxShadow: isSelected
                        ? "0 0 20px #ffffff66"
                        : isSearchMatch
                            ? `0 0 16px ${accent}66`
                            : `0 3px 12px ${accent}18`,
                    opacity: isDimmed ? 0.2 : 1,
                    transition:
                        "opacity 200ms ease, box-shadow 200ms ease, background 200ms ease",
                },
            };
        });

        const flowEdges: Edge[] = filteredRelationships
            .filter(
                (relationship) =>
                    visibleIds.has(relationship.sourceId) &&
                    visibleIds.has(relationship.targetId)
            )
            .map((relationship) => {
                const isCall = relationship.type === "CALLS";
                const isInheritance = relationship.type === "EXTENDS" || relationship.type === "IMPLEMENTS";
                const isOverride = relationship.type === "OVERRIDES";
                const isDispatch = relationship.type === "DISPATCHES_TO";
                const relationshipColor = relationshipColors[relationship.type] ?? "#465363";

                const isConnectedEdge =
                    !!activeNodeId &&
                    (relationship.sourceId === activeNodeId ||
                        relationship.targetId === activeNodeId);

                const isDimmedEdge =
                    hasConnectedSelection && !isConnectedEdge;

                return {
                    id: `edge-${relationship.sourceId}-${relationship.type}-${relationship.targetId}`,
                    source: relationship.sourceId,
                    target: relationship.targetId,
                    label: relationship.type,
                    type: "default",
                    animated: false,
                    style: {
                        stroke: isConnectedEdge ? "#ffffff" : relationshipColor,
                        strokeWidth: isConnectedEdge ? 2.5 : isCall || isOverride || isDispatch ? 1.8 : isInheritance ? 1.4 : 1,
                        strokeDasharray: isDispatch ? "6 4" : isOverride ? "3 3" : undefined,
                        opacity: isDimmedEdge ? 0.08 : 0.82,
                    },
                    labelStyle: {
                        fill: isConnectedEdge ? "#ffffff" : "#9ba9ba",
                        fontSize: 9,
                    },
                    labelBgStyle: {
                        fill: "#111923",
                        fillOpacity: 0.9,
                    },
                };
            });

        return { nodes: flowNodes, edges: flowEdges };
    }, [
        visibleGraphNodes,
        filteredRelationships,
        activeNodeId,
        searchQuery,
    ]);

    const handleNodeClick = (_event: MouseEvent, flowNode: Node) => {
        const selected = graph.nodes.find(
            (node) => node.id === flowNode.id
        );

        if (!selected) return;

        setSelectedNodeId(selected.id);
        onSelectNode?.(selected);

        setExpandedIds((previous) => {
            const next = new Set(previous);
            next.add(selected.id);
            return next;
        });
    };

    const handleReset = () => {
        setExpandedIds(new Set());
        setShowAll(false);
        setPendingFocusId(null);
        setSelectedNodeId(null);
        setSearchQuery("");
        setSearchOpen(false);
        setVisibleRelationshipTypes(new Set(availableRelationshipTypes));

        onSelectNode?.(null);
    };

    const handleShowAll = () => {
        setShowAll((previous) => !previous);
    };

    const handleFocusComplete = (nodeId: string) => {
        setPendingFocusId((current) =>
            current === nodeId ? null : current
        );
    };

    useEffect(() => {
        if (!focusNodeId) return;

        const exists = graph.nodes.some(
            (node) => node.id === focusNodeId
        );

        if (!exists) return;

        setSelectedNodeId(focusNodeId);
        setExpandedIds((previous) =>
            new Set(previous).add(focusNodeId)
        );
        setPendingFocusId(focusNodeId);
    }, [focusNodeId, graph.nodes]);

    const visiblePercent = graph.nodes.length
        ? Math.min(100, (nodes.length / graph.nodes.length) * 100)
        : 0;

    return (
        <div>
            <div
                style={{
                    position: "relative",
                    marginBottom: 14,
                    maxWidth: 480,
                }}
            >
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => {
                        window.setTimeout(() => setSearchOpen(false), 150);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setSearchOpen(false);
                        } else if (
                            event.key === "Enter" &&
                            searchResults.length > 0
                        ) {
                            handleSearchSelect(searchResults[0]);
                        }
                    }}
                    placeholder="Search classes, methods, files..."
                    aria-label="Search code graph"
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: "1px solid #344357",
                        background: "#111923",
                        color: "#e2e8f0",
                        fontSize: 12,
                        outline: "none",
                    }}
                />

                {searchOpen && searchQuery.trim() !== "" && (
                    <div
                        style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            right: 0,
                            zIndex: 20,
                            maxHeight: 300,
                            overflowY: "auto",
                            border: "1px solid #344357",
                            borderRadius: 10,
                            background: "#111923",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        {searchResults.length > 0 ? (
                            searchResults.map((node) => (
                                <button
                                    key={node.id}
                                    type="button"
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        handleSearchSelect(node);
                                    }}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        padding: "10px 12px",
                                        border: "none",
                                        borderBottom: "1px solid #263343",
                                        background: "transparent",
                                        color: "#dce3ec",
                                        textAlign: "left",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span
                                            style={{
                                                color:
                                                    nodeColors[node.type] ??
                                                    "#8493a8",
                                                marginRight: 8,
                                            }}
                                        >
                                            ●
                                        </span>
                                        {node.name}
                                        <span
                                            style={{
                                                float: "right",
                                                color: "#8190a4",
                                                fontSize: 10,
                                            }}
                                        >
                                            {node.type}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 4,
                                            color: "#8190a4",
                                            fontSize: 10,
                                            overflowWrap: "anywhere",
                                        }}
                                    >
                                        {node.filePath}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div
                                style={{
                                    padding: 12,
                                    color: "#8190a4",
                                    fontSize: 12,
                                }}
                            >
                                No matching nodes found.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 14,
                    marginBottom: 14,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        alignItems: "center",
                    }}
                >
                    {[
                        ["Classes", "#c084fc"],
                        ["Interfaces", "#f472b6"],
                        ["Methods", "#34d399"],
                        ["Files", "#60a5fa"],
                        ["Fields", "#fbbf24"],
                    ].map(([label, color]) => (
                        <div
                            key={label}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                color,
                                fontSize: 12,
                                fontWeight: 500,
                            }}
                        >
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: color,
                                    boxShadow: `0 0 8px ${color}66`,
                                    flexShrink: 0,
                                }}
                            />
                            {label}
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        style={buttonStyle}
                        onClick={handleReset}
                    >
                        ↺ Reset view
                    </button>

                    <button
                        type="button"
                        style={{
                            ...buttonStyle,
                            background: showAll ? "#163b3c" : "#172432",
                            borderColor: showAll ? "#2dd4bf" : "#344357",
                            color: showAll ? "#7ee7db" : "#cbd5e1",
                        }}
                        onClick={handleShowAll}
                    >
                        {showAll ? "Show overview" : "Show all nodes"}
                    </button>
                </div>
            </div>


            {availableRelationshipTypes.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 14,
                        padding: "10px 12px",
                        border: "1px solid #263548",
                        borderRadius: 10,
                        background: "rgba(13, 19, 28, 0.72)",
                    }}
                >
                    <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, marginRight: 4 }}>
                        RELATIONSHIPS
                    </span>
                    {availableRelationshipTypes.map((type) => {
                        const active = visibleRelationshipTypes.has(type);
                        const color = relationshipColors[type] ?? "#8493a8";
                        return (
                            <button
                                key={type}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setVisibleRelationshipTypes((previous) => {
                                    const next = new Set(previous);
                                    if (next.has(type)) next.delete(type);
                                    else next.add(type);
                                    return next;
                                })}
                                style={{
                                    ...buttonStyle,
                                    padding: "5px 8px",
                                    fontSize: 10,
                                    color: active ? color : "#64748b",
                                    borderColor: active ? `${color}99` : "#263343",
                                    background: active ? `${color}14` : "#111923",
                                    opacity: active ? 1 : 0.72,
                                }}
                            >
                                {active ? "●" : "○"} {type.replace(/_/g, " ")}
                            </button>
                        );
                    })}
                    <span style={{ color: "#64748b", fontSize: 10, marginLeft: "auto" }}>
                        {filteredRelationships.length} / {graph.relationships.length} edges
                    </span>
                </div>
            )}

            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: 650,
                    overflow: "hidden",
                    border: "1px solid #263548",
                    borderRadius: 16,
                    background:
                        "radial-gradient(ellipse at 48% 42%, #172638 0%, #0e151f 58%, #0b1018 100%)",
                }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodeClick={handleNodeClick}
                    fitView
                    minZoom={0.05}
                    maxZoom={2}
                    colorMode="dark"
                >
                    <FocusSelectedNode
                        focusNodeId={pendingFocusId}
                        nodes={nodes}
                        onFocused={handleFocusComplete}
                    />

                    <Background color="#344255" gap={24} size={1} />
                    <Controls />

                    <div
                        style={{
                            position: "absolute",
                            zIndex: 5,
                            right: 14,
                            bottom: 14,
                            width: 230,
                            padding: 12,
                            border: "1px solid #303c4b",
                            borderRadius: 12,
                            background: "rgba(13, 19, 28, 0.94)",
                            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
                            backdropFilter: "blur(12px)",
                            pointerEvents: "auto",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 10,
                            }}
                        >
                            <span
                                style={{
                                    color: "#cbd5e1",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                }}
                            >
                                GRAPH OVERVIEW
                            </span>

                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    color: "#7dd3c7",
                                    fontSize: 9,
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "#2dd4bf",
                                        boxShadow: "0 0 8px #2dd4bf",
                                    }}
                                />
                                LIVE
                            </span>
                        </div>

                        <MiniMap
                            position="bottom-right"
                            pannable
                            zoomable
                            nodeColor={(flowNode) => {
                                const original = graph.nodes.find(
                                    (item) => item.id === flowNode.id
                                );

                                return original
                                    ? nodeColors[original.type] ?? "#8493a8"
                                    : "#8493a8";
                            }}
                            nodeStrokeColor={() => "#0b1018"}
                            maskColor="rgba(5, 10, 17, 0.72)"
                            style={{
                                position: "relative",
                                right: "auto",
                                bottom: "auto",
                                width: 204,
                                height: 116,
                                margin: 0,
                                background: "#111923",
                                border: "1px solid #303c4b",
                                borderRadius: 6,
                                cursor: "grab",
                                pointerEvents: "auto",
                            }}
                        />

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: 10,
                                color: "#91a0b4",
                                fontSize: 10,
                            }}
                        >
                            <span>Visible nodes</span>
                            <span
                                style={{
                                    color: "#dce6f2",
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {nodes.length} / {graph.nodes.length}
                            </span>
                        </div>

                        <div
                            style={{
                                height: 3,
                                marginTop: 7,
                                borderRadius: 10,
                                background: "#263343",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${visiblePercent}%`,
                                    height: "100%",
                                    borderRadius: 10,
                                    background:
                                        "linear-gradient(90deg, #2dd4bf, #60a5fa)",
                                    transition: "width 250ms ease",
                                }}
                            />
                        </div>
                    </div>
                </ReactFlow>
            </div>

            <p
                style={{
                    margin: "12px 2px 0",
                    color: "#8190a4",
                    fontSize: 11,
                    lineHeight: 1.6,
                }}
            >
                Click a node to inspect it and expand its connections. Use
                the minimap to navigate the graph, or select a connected
                item in the inspector to jump directly to it.
            </p>
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    padding: "7px 11px",
    borderRadius: 8,
    border: "1px solid #344357",
    background: "#172432",
    color: "#cbd5e1",
    fontSize: 11,
    cursor: "pointer",
    transition: "all 150ms ease",
};
