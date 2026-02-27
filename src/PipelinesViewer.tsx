import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  useNodesState,
  useEdgesState,
  Node,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import "./PipelinesViewer.css";
import { token } from "@atlaskit/tokens";
import { parsePipelines, transformStepsToGraph } from "./utils";
import {
  PipelineDefinition,
  StepNodeData,
  PipelineVariable,
  EdgeData,
} from "./types";
import StepDetailPanel from "./StepDetailPanel";
import FullSourceOverlay from "./FullSourceOverlay";
import VariablesPanel from "./VariablesPanel";
import OptionsPanel from "./OptionsPanel";
import ImagePanel from "./ImagePanel";

/** Props for the {@link PipelinesViewer} component. */
export interface PipelinesViewerProps {
  /** Raw YAML content of the bitbucket-pipelines.yml file */
  content: string;
  /** Container height (default: "800px") */
  height?: string;
  /** Error callback — called when parsing fails or no pipelines found */
  onError?: (error: string) => void;
}

const FullscreenIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Northwest arrow */}
    <polyline points="9 3 3 3 3 9" />
    <line x1="3" y1="3" x2="10" y2="10" />
    {/* Southeast arrow */}
    <polyline points="15 21 21 21 21 15" />
    <line x1="21" y1="21" x2="14" y2="14" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Pointing inward to center from NW */}
    <polyline points="3 10 10 10 10 3" />
    <line x1="10" y1="10" x2="3" y2="3" />
    {/* Pointing inward to center from SE */}
    <polyline points="21 14 14 14 14 21" />
    <line x1="14" y1="14" x2="21" y2="21" />
  </svg>
);

const CodeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const PlayIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <polygon points="6 3 20 12 6 21" />
  </svg>
);

const StopIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const PipelinesViewerContent: React.FC<PipelinesViewerProps> = ({
  content,
  height = "800px",
  onError,
}) => {
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    null,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullSourceOpen, setIsFullSourceOpen] = useState(false);
  const { fitView } = useReactFlow();

  const [selectedNode, setSelectedNode] = useState<Node<StepNodeData> | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoPlayedRef = useRef(false);

  // Staged edge animation state
  const [animatingStage, setAnimatingStage] = useState<number | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyStartNodeDropdown = useCallback(
    (
      nodesToUpdate: Node[],
      currentMapPipelines: PipelineDefinition[],
      currentSelectedId: string | null,
      variables: PipelineVariable[],
    ) => {
      return nodesToUpdate.map((n) => {
        if (n.id === "start") {
          return {
            ...n,
            data: {
              ...n.data,
              label: (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "calc(100% + 12px)",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: token(
                        "color.background.accent.blue.subtlest",
                        "#E9F2FF",
                      ),
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${token("color.border.accent.blue", "#85B8FF")}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: token(
                          "color.text.accent.blue",
                          "#0055CC",
                        ),
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Start Condition
                    </span>
                    <select
                      aria-label="Start condition"
                      className="nodrag nopan"
                      value={currentSelectedId || ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedPipelineId(e.target.value);
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: `1px solid ${token("color.border.input", "#dfe1e6")}`,
                        background: token("elevation.surface", "#fff"),
                        fontSize: "12px",
                        fontWeight: 500,
                        color: token("color.text", "#172B4D"),
                        cursor: "pointer",
                        minWidth: "140px",
                        outline: "none",
                        height: "28px",
                      }}
                    >
                      {currentMapPipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {variables.length > 0 && (
                    <div
                      className="nodrag nopan"
                      style={{
                        position: "absolute",
                        left: "calc(100% + 10px)",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      <VariablesPanel variables={variables} />
                    </div>
                  )}
                </div>
              ),
            },
          };
        }
        return n;
      });
    },
    [setSelectedPipelineId],
  );

  // Automatically fit view when entering/exiting fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ duration: 400, padding: 0.4 });
    }, 300);
    return () => clearTimeout(timer);
  }, [isFullscreen, fitView]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<StepNodeData>) => {
      const stepType = node.data?.stepType;
      if (stepType === "start" || stepType === "end") return;
      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    },
    [],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`,
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Parse content and initialise graph
  useEffect(() => {
    hasAutoPlayedRef.current = false;
    try {
      const parsed = parsePipelines(content);
      setPipelines(parsed);

      if (parsed.length > 0) {
        const defaultPipe = parsed.find((p) => p.id === "default") ?? parsed[0];
        const pipeId = defaultPipe.id;
        setSelectedPipelineId(pipeId);

        const { nodes: newNodes, edges: newEdges } =
          transformStepsToGraph(defaultPipe);
        setNodes(
          applyStartNodeDropdown(
            newNodes,
            parsed,
            pipeId,
            defaultPipe.variables ?? [],
          ),
        );
        setEdges(newEdges);
      } else {
        setSelectedPipelineId(null);
        setNodes([]);
        setEdges([]);
        onError?.("No pipelines found in this file.");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to parse pipeline YAML";
      onError?.(msg);
    }
  }, [content, setNodes, setEdges, onError, applyStartNodeDropdown]);

  // --- Staged animation logic ---
  const maxStage = useMemo(() => {
    let max = -1;
    edges.forEach((e) => {
      const stage = (e.data as EdgeData | undefined)?.stage;
      if (stage !== undefined && stage > max) max = stage;
    });
    return max;
  }, [edges]);

  const stopAnimation = useCallback(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    setAnimatingStage(null);
  }, []);

  const startAnimation = useCallback(() => {
    stopAnimation();
    if (maxStage < 0) return;
    setAnimatingStage(0);
    hasAutoPlayedRef.current = true;
  }, [maxStage, stopAnimation]);

  // Auto-play animation once on initial load
  useEffect(() => {
    if (!hasAutoPlayedRef.current && maxStage >= 0) {
      const timer = setTimeout(() => {
        if (!hasAutoPlayedRef.current) {
          startAnimation();
        }
      }, 1000); // Delay to allow fitView to complete
      return () => clearTimeout(timer);
    }
  }, [maxStage, startAnimation]);

  useEffect(() => {
    // Re-transform graph when user selects a different pipeline from the dropdown
    if (selectedPipelineId && pipelines.length > 0) {
      const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
      if (pipeline) {
        const { nodes: newNodes, edges: newEdges } =
          transformStepsToGraph(pipeline);
        setNodes(
          applyStartNodeDropdown(
            newNodes,
            pipelines,
            selectedPipelineId,
            pipeline.variables ?? [],
          ),
        );
        setEdges(newEdges);
      }
    }
    // Clear detail panel when pipeline changes
    setSelectedNode(null);
    // Reset animation when pipeline changes
    stopAnimation();
  }, [
    selectedPipelineId,
    pipelines,
    setNodes,
    setEdges,
    stopAnimation,
    setSelectedNode,
    applyStartNodeDropdown,
  ]);

  // Advance the animation stage on a timer
  useEffect(() => {
    if (animatingStage === null) return;
    if (animatingStage > maxStage) {
      // Hold for a moment then reset
      const timeout = setTimeout(() => {
        stopAnimation();
      }, 1200);
      return () => clearTimeout(timeout);
    }
    const timer = setTimeout(() => {
      setAnimatingStage((prev) => (prev !== null ? prev + 1 : null));
    }, 800);
    return () => clearTimeout(timer);
  }, [animatingStage, maxStage, stopAnimation]);

  // Apply animation styling to edges based on current stage
  useEffect(() => {
    if (animatingStage === null) {
      // Reset all edges to non-animated
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          animated: false,
          style: undefined,
        })),
      );
      return;
    }
    setEdges((eds) =>
      eds.map((e) => {
        const stage = (e.data as EdgeData | undefined)?.stage ?? -1;
        const isActive = stage <= animatingStage;
        return {
          ...e,
          animated: isActive,
          style: isActive ? { stroke: "#0052CC", strokeWidth: 2.5 } : undefined,
        };
      }),
    );
  }, [animatingStage, setEdges]);

  const currentOptions = useMemo(() => {
    if (!selectedPipelineId || pipelines.length === 0) return null;
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    return pipeline?.options ?? null;
  }, [selectedPipelineId, pipelines]);

  const currentGlobalImage = useMemo(() => {
    if (!selectedPipelineId || pipelines.length === 0) return null;
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    return pipeline?.image ?? null;
  }, [selectedPipelineId, pipelines]);

  if (pipelines.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: token("color.text", "#172B4D"),
        }}
      >
        <h3>No pipelines found in this file.</h3>
        <p>Please check if the file is a valid bitbucket-pipelines.yml file.</p>
        <pre
          style={{
            textAlign: "left",
            background: token("color.background.neutral", "#f4f5f7"),
            color: token("color.text", "#172B4D"),
            padding: "10px",
            borderRadius: "4px",
            overflow: "auto",
            maxHeight: "400px",
          }}
        >
          {content.slice(0, 1000)}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: isFullscreen ? "100vh" : height,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: token("color.text", "#172B4D"),
        background: token("elevation.surface", "#fff"),
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.4, includeHiddenNodes: false }}
          defaultEdgeOptions={{ type: "step" }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          attributionPosition="bottom-right"
        >
          <Background color={token("color.border", "#aaa")} gap={16} />
          <Controls position="top-right" showInteractive={false}>
            <ControlButton
              onClick={toggleFullScreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </ControlButton>
            <ControlButton
              onClick={() => setIsFullSourceOpen(true)}
              title="Show source"
              aria-label="Show source"
            >
              <CodeIcon />
            </ControlButton>
            <ControlButton
              onClick={animatingStage !== null ? stopAnimation : startAnimation}
              title={
                animatingStage !== null ? "Stop animation" : "Animate flow"
              }
              aria-label={
                animatingStage !== null ? "Stop animation" : "Animate flow"
              }
            >
              {animatingStage !== null ? <StopIcon /> : <PlayIcon />}
            </ControlButton>
          </Controls>
          {((currentOptions && Object.keys(currentOptions).length > 0) ||
            currentGlobalImage) && (
            <Panel
              position="top-left"
              style={{ marginTop: "10px", marginLeft: "10px" }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                {currentGlobalImage && (
                  <ImagePanel image={currentGlobalImage} defaultExpanded />
                )}
                {currentOptions && Object.keys(currentOptions).length > 0 && (
                  <OptionsPanel options={currentOptions} />
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>
        {selectedNode && selectedNode.data && (
          <StepDetailPanel
            data={selectedNode.data}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {isFullSourceOpen && (
          <FullSourceOverlay
            content={content}
            onClose={() => setIsFullSourceOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

const PipelinesViewer: React.FC<PipelinesViewerProps> = (props) => (
  <ReactFlowProvider>
    <PipelinesViewerContent {...props} />
  </ReactFlowProvider>
);

export default PipelinesViewer;
