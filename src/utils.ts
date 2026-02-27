import yaml from "js-yaml";
import dagre from "dagre";
import React from "react";
import { Node, Edge, Position } from "reactflow";
import { token } from "@atlaskit/tokens";

/** A variable declaration within a pipeline, optionally with a default value and allowed values. */
export interface PipelineVariable {
  name: string;
  default?: string;
  allowedValues?: string[];
  "allowed-values"?: string[];
}

/** A single step (or parallel/stage wrapper) within a Bitbucket Pipeline definition. */
export interface PipelineStep {
  name?: string;
  trigger?: "manual" | "automatic" | string;
  image?: string | { name: string };
  script?: unknown[];
  pipe?: string;
  variables?: PipelineVariable[];
  step?: PipelineStep;
  parallel?: PipelineStep[];
  [key: string]: unknown;
}

/** A fully parsed pipeline with its steps, trigger info, variables, and global options. */
export interface PipelineDefinition {
  id: string;
  name: string;
  steps: PipelineStep[];
  variables?: PipelineVariable[];
  options?: Record<string, unknown>;
  image?: string;
  triggerType?: "default" | "branch" | "pull-request" | "tag" | "custom";
  triggerPattern?: string;
  schedules?: { cron: string }[];
}

/** Data attached to each React Flow node representing a pipeline step. */
export interface StepNodeData {
  label: React.ReactNode;
  rawStep?: PipelineStep;
  yamlSnippet?: string;
  stepType:
  | "start"
  | "end"
  | "parallel"
  | "pipe"
  | "script"
  | "step"
  | "trigger";
  isManual?: boolean;
}

/** Data attached to each React Flow edge, tracking the pipeline stage index. */
export interface EdgeData {
  stage: number;
}

const deriveStepType = (step: PipelineStep): StepNodeData["stepType"] => {
  if (step.script) {
    // Check if any script entry is a pipe reference
    const scripts = Array.isArray(step.script) ? step.script : [];
    const hasPipe = scripts.some(
      (s: unknown) => typeof s === "object" && s !== null && "pipe" in s,
    );
    if (hasPipe) return "pipe";
    return "script";
  }
  return "step";
};

export interface YamlDoc {
  pipelines?: {
    default?: PipelineStep[];
    branches?: Record<string, PipelineStep[]>;
    "pull-requests"?: Record<string, PipelineStep[]>;
    custom?: Record<string, PipelineStep[]>;
    tags?: Record<string, PipelineStep[]>;
  };
  options?: Record<string, unknown>;
  image?: string | { name: string };
  triggers?: Array<{ schedule?: { pipeline?: string; cron?: string } }>;
}

/**
 * Parse a raw `bitbucket-pipelines.yml` string into an array of {@link PipelineDefinition} objects.
 *
 * Handles default, branch, pull-request, custom, and tag pipelines as well as
 * global options, images, variables, and schedule triggers.
 *
 * @param content - Raw YAML string of a bitbucket-pipelines.yml file.
 * @returns An array of parsed pipeline definitions, or an empty array if parsing fails.
 */
export const parsePipelines = (content: string): PipelineDefinition[] => {
  try {
    const doc = yaml.load(content) as YamlDoc;
    if (!doc || !doc.pipelines) {
      return [];
    }

    const pipelines: PipelineDefinition[] = [];
    const globalOptions = doc.options || {};
    const globalImage =
      typeof doc.image === "string"
        ? doc.image
        : typeof doc.image === "object" && doc.image !== null
          ? doc.image.name
          : null;

    const extractVariablesAndSteps = (allEntries: PipelineStep[]) => {
      const variables: PipelineVariable[] = [];
      const filteredSteps: PipelineStep[] = [];

      allEntries.forEach((entry: PipelineStep) => {
        if (entry.variables && Array.isArray(entry.variables)) {
          entry.variables.forEach((v: PipelineVariable) => {
            variables.push({
              name: v.name,
              default: v.default,
              allowedValues: v["allowed-values"],
            });
          });
        } else {
          filteredSteps.push(entry);
        }
      });
      return { variables, steps: filteredSteps };
    };

    const schedulesByPipeline: Record<string, { cron: string }[]> = {};
    if (doc.triggers) {
      doc.triggers.forEach((t) => {
        if (t.schedule && t.schedule.pipeline) {
          const pipelineKey = t.schedule.pipeline;
          if (!schedulesByPipeline[pipelineKey]) {
            schedulesByPipeline[pipelineKey] = [];
          }
          if (t.schedule.cron) {
            schedulesByPipeline[pipelineKey].push({ cron: t.schedule.cron });
          }
        }
      });
    }

    if (doc.pipelines.default) {
      const { variables, steps } = extractVariablesAndSteps(
        doc.pipelines.default,
      );
      pipelines.push({
        id: "default",
        name: "Default",
        steps,
        triggerType: "default",
        ...(variables.length > 0 ? { variables } : {}),
        ...(Object.keys(globalOptions).length > 0
          ? { options: globalOptions }
          : {}),
        ...(globalImage ? { image: globalImage } : {}),
        schedules: schedulesByPipeline["default"],
      });
    }

    if (doc.pipelines.branches) {
      Object.entries(doc.pipelines.branches).forEach(([branchName, steps]) => {
        const { variables, steps: filteredSteps } =
          extractVariablesAndSteps(steps);
        pipelines.push({
          id: `branch-${branchName}`,
          name: `Branch: ${branchName}`,
          steps: filteredSteps,
          triggerType: "branch",
          triggerPattern: branchName,
          ...(variables.length > 0 ? { variables } : {}),
          ...(Object.keys(globalOptions).length > 0
            ? { options: globalOptions }
            : {}),
          ...(globalImage ? { image: globalImage } : {}),
          schedules: schedulesByPipeline[`branches.${branchName}`],
        });
      });
    }

    if (doc.pipelines["pull-requests"]) {
      Object.entries(doc.pipelines["pull-requests"]).forEach(
        ([pattern, steps]) => {
          const { variables, steps: filteredSteps } =
            extractVariablesAndSteps(steps);
          pipelines.push({
            id: `pr-${pattern}`,
            name: `Pull Request: ${pattern}`,
            steps: filteredSteps,
            triggerType: "pull-request",
            triggerPattern: pattern,
            ...(variables.length > 0 ? { variables } : {}),
            ...(Object.keys(globalOptions).length > 0
              ? { options: globalOptions }
              : {}),
            ...(globalImage ? { image: globalImage } : {}),
            schedules: schedulesByPipeline[`pull-requests.${pattern}`],
          });
        },
      );
    }

    if (doc.pipelines.custom) {
      Object.entries(doc.pipelines.custom).forEach(([customName, steps]) => {
        const { variables, steps: filteredSteps } =
          extractVariablesAndSteps(steps);
        pipelines.push({
          id: `custom-${customName}`,
          name: `Custom: ${customName}`,
          steps: filteredSteps,
          triggerType: "custom",
          triggerPattern: customName,
          ...(variables.length > 0 ? { variables } : {}),
          ...(Object.keys(globalOptions).length > 0
            ? { options: globalOptions }
            : {}),
          ...(globalImage ? { image: globalImage } : {}),
          schedules: schedulesByPipeline[`custom.${customName}`],
        });
      });
    }

    if (doc.pipelines.tags) {
      Object.entries(doc.pipelines.tags).forEach(([tagName, steps]) => {
        const { variables, steps: filteredSteps } =
          extractVariablesAndSteps(steps);
        pipelines.push({
          id: `tag-${tagName}`,
          name: `Tag: ${tagName}`,
          steps: filteredSteps,
          triggerType: "tag",
          triggerPattern: tagName,
          ...(variables.length > 0 ? { variables } : {}),
          ...(Object.keys(globalOptions).length > 0
            ? { options: globalOptions }
            : {}),
          ...(globalImage ? { image: globalImage } : {}),
          schedules: schedulesByPipeline[`tags.${tagName}`],
        });
      });
    }

    return pipelines;
  } catch (e) {
    console.error("Error parsing YAML:", e);
    return [];
  }
};

// Estimated dimensions for layout calculation
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 40;

const estimateNodeSize = (label: React.ReactNode) => {
  if (typeof label !== "string" || !label) return { width: 32, height: 32 };

  const charWidth = 8; // rough estimate for 12px font
  const paddingH = 32; // 16px on each side

  // Calculate how many lines it might take if it wraps
  // Standardizing on DEFAULT_NODE_WIDTH (200) for width
  const availableTextWidth = DEFAULT_NODE_WIDTH - paddingH;
  const lines = Math.ceil((label.length * charWidth) / availableTextWidth);

  // Height = padding + (lines * lineHeight)
  const estimatedHeight = Math.max(DEFAULT_NODE_HEIGHT, lines * 18 + 20);

  return { width: DEFAULT_NODE_WIDTH, height: estimatedHeight };
};

/**
 * Apply a dagre auto-layout to a set of React Flow nodes and edges.
 *
 * @param nodes - React Flow nodes to lay out.
 * @param edges - React Flow edges connecting the nodes.
 * @param direction - Layout direction: `"TB"` (top-to-bottom) or `"LR"` (left-to-right). Defaults to `"TB"`.
 * @returns The same nodes and edges with updated positions.
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
) => {
  // Create a fresh graph each time so nodes don't carry over between renders
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction, ranksep: 60, nodesep: 40 });

  nodes.forEach((node) => {
    // Use the measurements from style or estimated dimensions
    let width = DEFAULT_NODE_WIDTH;
    let height = DEFAULT_NODE_HEIGHT;

    if (node.style?.width && typeof node.style.width === "number") {
      width = node.style.width;
    } else if (node.data?.label) {
      const estimated = estimateNodeSize(node.data.label);
      width = estimated.width;
      height = estimated.height;
    }

    if (node.style?.height && typeof node.style.height === "number") {
      height = node.style.height;
    }

    dagreGraph.setNode(node.id, { width, height });

    // Store these on the node so we can use them for positioning logic below
    const extNode = node as Node & {
      _layoutWidth?: number;
      _layoutHeight?: number;
    };
    extNode._layoutWidth = width;
    extNode._layoutHeight = height;
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    const extNode = node as Node & {
      _layoutWidth?: number;
      _layoutHeight?: number;
    };
    const width = extNode._layoutWidth || DEFAULT_NODE_WIDTH;
    const height = extNode._layoutHeight || DEFAULT_NODE_HEIGHT;

    node.position = {
      x: nodeWithPosition.x - width / 2,
      y: nodeWithPosition.y - height / 2,
    };

    return node;
  });

  return { nodes, edges };
};

const resolveImageString = (image: unknown): string | null => {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (typeof image === "object" && image !== null && "name" in image) {
    return String((image as { name: unknown }).name);
  }
  return null;
};

const buildNodeLabel = (
  name: string,
  image: unknown,
  isManual?: boolean,
): React.ReactNode => {
  const imageStr = resolveImageString(image);
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "stretch",
        width: "100%",
        gap: "4px",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        },
      },
      isManual &&
      React.createElement(
        "span",
        {
          style: {
            fontSize: "9px",
            background: token(
              "color.background.accent.blue.subtle",
              "#E9F2FF",
            ),
            color: token("color.text.accent.blue", "#0052CC"),
            padding: "2px 4px",
            borderRadius: "10px",
            border: `1px solid ${token("color.border.accent.blue", "#0052CC")}`,
            fontWeight: "bold",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          },
        },
        "Manual",
      ),
      React.createElement("div", { style: { fontWeight: "500" } }, name),
    ),
    imageStr &&
    React.createElement(
      "div",
      {
        style: {
          fontSize: "9px",
          color: token("color.text.subtle", "#626F86"),
          textAlign: "left",
          fontFamily: "monospace",
          lineHeight: "1.2",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        },
      },
      `image: ${imageStr}`,
    ),
  );
};

/**
 * Convert a {@link PipelineDefinition} into React Flow nodes and edges suitable for rendering.
 *
 * Creates a start (trigger) node, one node per step (handling parallel steps), an end node,
 * and connecting edges with stage indices for animation. The result is auto-laid out via dagre.
 *
 * @param pipeline - The pipeline definition to transform.
 * @returns An object containing `nodes` and `edges` arrays for React Flow.
 */
export const transformStepsToGraph = (
  pipeline: PipelineDefinition,
): { nodes: Node[]; edges: Edge[] } => {
  const { steps } = pipeline;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let nodeIdCounter = 0;
  let stageCounter = 0;

  // Start node (simple dot)
  const startNodeId = "start";

  nodes.push({
    id: startNodeId,
    data: {
      label: "",
      stepType: "start",
    } as StepNodeData,
    position: { x: 0, y: 0 },
    type: "input",
    focusable: false,
    style: {
      background: token("color.background.neutral.bold", "#444"),
      border: "none",
      borderRadius: "50%",
      width: 24,
      height: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      minWidth: "24px",
    },
  });

  let previousNodeIds: string[] = [startNodeId];

  // Recursively unwrap steps that are referenced via YAML anchors
  const unwrapStep = (step: PipelineStep): PipelineStep => {
    let current = step;
    while (current.step) {
      current = current.step;
    }
    return current;
  };

  const processStep = (step: PipelineStep) => {
    if (step.parallel) {
      // Parallel step
      const currentParallelIds: string[] = [];
      step.parallel.forEach((subStepItem: PipelineStep) => {
        const subStep = unwrapStep(subStepItem);

        const nodeId = `step-${nodeIdCounter++}`;
        const stepType = deriveStepType(subStep);
        const isManual = subStep.trigger === "manual";

        nodes.push({
          id: nodeId,
          data: {
            label: buildNodeLabel(
              subStep.name || "Parallel Step",
              subStep.image,
              isManual,
            ),
            rawStep: subStep,
            stepType,
            isManual,
          } as StepNodeData,
          position: { x: 0, y: 0 },
          style: {
            border: isManual
              ? `2px dashed ${token("color.border.accent.blue", "#0052CC")}`
              : `1px solid ${token("color.border.success", "#4CBA61")}`,
            borderRadius: "4px",
            padding: "8px 12px",
            background: isManual
              ? token("color.background.accent.blue.subtle", "#E9F2FF")
              : token("color.background.success", "#D3F1A7"),
            color: isManual
              ? token("color.text.accent.blue", "#0052CC")
              : token("color.text.success", "#216E4E"),
            width: DEFAULT_NODE_WIDTH,
            minHeight: 40,
            fontSize: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            whiteSpace: "normal",
            wordBreak: "break-word",
          },
        });
        currentParallelIds.push(nodeId);

        // Connect from all previous nodes to this node
        previousNodeIds.forEach((prevId) => {
          edges.push({
            id: `e-${prevId}-${nodeId}`,
            source: prevId,
            target: nodeId,
            type: "step",
            animated: false,
            data: { stage: stageCounter } as EdgeData,
          });
        });
      });
      // After parallel block, the next step connects to ALL these parallel steps
      previousNodeIds = currentParallelIds;
      stageCounter++;
    } else {
      const actualStep = unwrapStep(step);

      const nodeId = `step-${nodeIdCounter++}`;
      const stepType = deriveStepType(actualStep);
      const isManual = actualStep.trigger === "manual";

      nodes.push({
        id: nodeId,
        data: {
          label: buildNodeLabel(
            actualStep.name || "Step",
            actualStep.image,
            isManual,
          ),
          rawStep: actualStep,
          stepType,
          isManual,
        } as StepNodeData,
        position: { x: 0, y: 0 },
        style: {
          border: isManual
            ? `2px dashed ${token("color.border.accent.blue", "#0052CC")}`
            : `1px solid ${token("color.border.success", "#4CBA61")}`,
          borderRadius: "4px",
          padding: "8px 12px",
          background: isManual
            ? token("color.background.accent.blue.subtle", "#E9F2FF")
            : token("color.background.success", "#D3F1A7"),
          color: isManual
            ? token("color.text.accent.blue", "#0052CC")
            : token("color.text.success", "#216E4E"),
          width: DEFAULT_NODE_WIDTH,
          minHeight: 40,
          fontSize: "12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          cursor: "pointer",
          whiteSpace: "normal",
          wordBreak: "break-word",
        },
      });

      // Connect from all previous nodes
      previousNodeIds.forEach((prevId) => {
        edges.push({
          id: `e-${prevId}-${nodeId}`,
          source: prevId,
          target: nodeId,
          type: "step",
          animated: false,
          data: { stage: stageCounter } as EdgeData,
        });
      });
      stageCounter++;

      previousNodeIds = [nodeId];
    }
  };

  steps.forEach(processStep);

  // End node
  const endNodeId = "end";
  nodes.push({
    id: endNodeId,
    data: {
      label: React.createElement("div", {
        style: {
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: token("color.background.neutral.bold", "#444"),
        },
      }),
      stepType: "end",
    } as StepNodeData,
    position: { x: 0, y: 0 },
    type: "output",
    ariaLabel: "Pipeline end",
    style: {
      background: token("color.background.neutral", "#EBECF0"),
      border: `2px solid ${token("color.background.neutral.bold", "#444")}`,
      borderRadius: "50%",
      width: 24,
      height: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    },
  });

  previousNodeIds.forEach((prevId) => {
    edges.push({
      id: `e-${prevId}-${endNodeId}`,
      source: prevId,
      target: endNodeId,
      type: "step",
      animated: false,
      data: { stage: stageCounter } as EdgeData,
    });
  });

  return getLayoutedElements(nodes, edges, "TB");
};
