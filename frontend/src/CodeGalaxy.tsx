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

type GraphNode = {
    id: string;
    type: string;
    name: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
};

type GraphRelationship = {
    sourceId: string;
    type: string;
    targetId: string;
};

type CodeGraph = {
    nodes: GraphNode[];
    relationships: GraphRelationship[];
};

type Props = {
    graph: CodeGraph;
    onSelectNode?: (node: GraphNode) => void;
    focusNodeId?: string | null;
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

        const width =
            typeof flowNode.measured?.width === "number"
                ? flowNode.measured.width
                : 160;

        const height =
            typeof flowNode.measured?.height === "number"
                ? flowNode.measured.height
                : 44;

        void setCenter(
            flowNode.position.x + width / 2,
            flowNode.position.y + height / 2,
            {
                zoom: 1.2,
                duration: 450,
            }
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

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);

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
        setExpandedIds((previous) => {
            const next = new Set(previous);
            next.add(node.id);
            return next;
        });
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

            graph.relationships.forEach((relationship) => {
                if (relationship.sourceId === id) {
                    visibleIds.add(relationship.targetId);
                }

                if (relationship.targetId === id) {
                    visibleIds.add(relationship.sourceId);
                }
            });
        });

        return graph.nodes.filter((node) => visibleIds.has(node.id));
    }, [graph, expandedIds, showAll]);

    const { nodes, edges } = useMemo(() => {
        const visibleIds = new Set(
            visibleGraphNodes.map((node) => node.id)
        );

        const flowNodes: Node[] = visibleGraphNodes.map((node, index) => {
            const angle = index * 2.39996;
            const radius = 100 + Math.sqrt(index) * 75;
            const accent = nodeColors[node.type] ?? "#8493a8";

            return {
                id: node.id,
                position: {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                },
                data: {
                    label: node.name,
                },
                style: {
                    background: "#151c27",
                    color: "#dce3ec",
                    border: `1px solid ${accent}90`,
                    borderRadius: 9,
                    padding: 10,
                    fontSize: 11,
                    width: 160,
                    boxShadow: `0 3px 12px ${accent}18`,
                },
            };
        });

        const flowEdges: Edge[] = graph.relationships
            .filter(
                (relationship) =>
                    visibleIds.has(relationship.sourceId) &&
                    visibleIds.has(relationship.targetId)
            )
            .map((relationship, index) => {
                const isCall = relationship.type === "CALLS";
                const isInheritance =
                    relationship.type === "EXTENDS" ||
                    relationship.type === "IMPLEMENTS";

                return {
                    id: `edge-${index}`,
                    source: relationship.sourceId,
                    target: relationship.targetId,
                    label: relationship.type,
                    type: "default",
                    animated: isCall,
                    style: {
                        stroke: isCall
                            ? "#81b9b5"
                            : isInheritance
                                ? "#c084fc"
                                : "#465363",
                        strokeWidth: isCall ? 1.6 : 1,
                        opacity: 0.75,
                    },
                    labelStyle: {
                        fill: "#9ba9ba",
                        fontSize: 9,
                    },
                    labelBgStyle: {
                        fill: "#111923",
                        fillOpacity: 0.9,
                    },
                };
            });

        return {
            nodes: flowNodes,
            edges: flowEdges,
        };
    }, [visibleGraphNodes, graph.relationships]);

    const handleNodeClick = (_event: MouseEvent, flowNode: Node) => {
        const selected = graph.nodes.find(
            (node) => node.id === flowNode.id
        );

        if (!selected) return;

        onSelectNode?.(selected);

        setExpandedIds((previous) => {
            const next = new Set(previous);

            if (next.has(selected.id)) {
                next.delete(selected.id);
            } else {
                next.add(selected.id);
            }

            return next;
        });
    };

    const handleReset = () => {
        setExpandedIds(new Set());
        setShowAll(false);
        setPendingFocusId(null);
        setSearchQuery("");
        setSearchOpen(false);
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

        setExpandedIds((previous) => {
            const next = new Set(previous);
            next.add(focusNodeId);
            return next;
        });

        setPendingFocusId(focusNodeId);
    }, [focusNodeId, graph.nodes]);

    const visiblePercent = graph.nodes.length
        ? Math.min(100, (nodes.length / graph.nodes.length) * 100)
        : 0;

    return (
        <div>
            {/* Graph search */}
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
                        // Delay closing so a result can receive its click.
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

            {/* Existing legend and graph controls */}
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

                    <Background
                        color="#344255"
                        gap={24}
                        size={1}
                    />

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
                            nodeColor={(node) => {
                                const original = graph.nodes.find(
                                    (item) => item.id === node.id
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