import yaml from "js-yaml";
import dagre from "dagre";
import React from "react";
import { Node, Edge, Position } from "reactflow";
import { token } from "@atlaskit/tokens";
import {
  PipelineVariable,
  PipelineStep,
  PipelineDefinition,
  StepNodeData,
  EdgeData,
  YamlDoc,
  ImportSource,
  PipelineImport,
} from "./types";

/**
 * Parse a raw import source string from `definitions.imports` into an {@link ImportSource}.
 *
 * Formats:
 * - No `:` → same-repo filepath (e.g., `.bitbucket/shared.yml`)
 * - One `:` → `repo:ref` format (uses default `bitbucket-pipelines.yml`)
 * - Two `:` → `repo:ref:filepath` format
 *
 * @param name - The alias name for this import source.
 * @param raw - The raw source string from YAML.
 * @returns A parsed {@link ImportSource} object.
 */
export const parseImportSource = (name: string, raw: string): ImportSource => {
  const parts = raw.split(":");
  if (parts.length === 1) {
    // Same-repo filepath: e.g., ".bitbucket/shared-pipelines.yml"
    return {
      name,
      raw,
      type: "same-repo",
      filePath: raw,
    };
  } else if (parts.length === 2) {
    // Cross-repo: "repo:ref" (default filepath)
    return {
      name,
      raw,
      type: "cross-repo",
      repoSlug: parts[0],
      ref: parts[1],
      filePath: "bitbucket-pipelines.yml",
    };
  } else {
    // Cross-repo with custom filepath: "repo:ref:filepath"
    return {
      name,
      raw,
      type: "cross-repo",
      repoSlug: parts[0],
      ref: parts[1],
      filePath: parts.slice(2).join(":"),
    };
  }
};

/**
 * Parse an import directive string of the form `"pipeline-name@source-alias"`.
 *
 * @param value - The import directive string.
 * @returns A {@link PipelineImport} object, or `null` if the string is not a valid import directive.
 */
export const parseImportDirective = (value: string): PipelineImport | null => {
  if (!value || typeof value !== "string") return null;
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) return null;
  return {
    pipelineName: value.substring(0, atIndex),
    sourceAlias: value.substring(atIndex + 1),
  };
};

/**
 * Extract all import sources from a raw YAML string.
 *
 * Parses the `definitions.imports` section of a bitbucket-pipelines.yml file
 * and returns an array of {@link ImportSource} objects.
 *
 * @param content - Raw YAML string.
 * @returns An array of parsed import sources, or empty array if none found.
 */
export const parseImportSources = (content: string): ImportSource[] => {
  try {
    const doc = yaml.load(content) as YamlDoc;
    if (!doc?.definitions?.imports) return [];
    return Object.entries(doc.definitions.imports).map(([name, raw]) =>
      parseImportSource(name, raw),
    );
  } catch {
    return [];
  }
};

/**
 * Check if a pipeline step array entry is an import directive.
 *
 * Import directives in Bitbucket Pipelines look like:
 * ```yaml
 * - import: pipeline-name@source-alias
 * ```
 *
 * @param entry - A pipeline step entry from the YAML.
 * @returns The import directive string if this is an import entry, or null.
 */
const getImportDirective = (
  entry: PipelineStep | Record<string, unknown>,
): string | null => {
  if (
    entry &&
    typeof entry === "object" &&
    "import" in entry &&
    typeof (entry as Record<string, unknown>).import === "string"
  ) {
    return (entry as Record<string, unknown>).import as string;
  }
  return null;
};

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

/**
 * Parse a raw `bitbucket-pipelines.yml` string into an array of {@link PipelineDefinition} objects.
 *
 * Handles default, branch, pull-request, custom, and tag pipelines as well as
 * global options, images, variables, and schedule triggers.
 *
 * @param content - Raw YAML string of a bitbucket-pipelines.yml file.
 * @returns An array of parsed pipeline definitions, or an empty array if parsing fails.
 */
export const parsePipelines = (
  content: string,
  resolvedImports?: Map<string, string>,
): PipelineDefinition[] => {
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

    // Parse import sources from definitions.imports
    const importSources: Map<string, ImportSource> = new Map();
    if (doc.definitions?.imports) {
      Object.entries(doc.definitions.imports).forEach(([name, raw]) => {
        importSources.set(name, parseImportSource(name, raw));
      });
    }

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

    /**
     * Try to resolve an import directive within a steps array.
     *
     * If the steps array contains a single import directive, resolve it
     * using the resolvedImports map and the importSources. Returns:
     * - The resolved pipeline steps + importedFrom metadata if successful
     * - Empty steps + importedFrom with error if resolution fails
     * - null if the steps array is not an import directive
     */
    const tryResolveImport = (
      stepsOrImport: PipelineStep[] | unknown,
    ): {
      steps: PipelineStep[];
      variables: PipelineVariable[];
      importedFrom: PipelineDefinition["importedFrom"];
    } | null => {
      // Check if this is an import directive (single-element array or direct object)
      // Bitbucket format: `import: pipeline-name@source-alias`
      if (!Array.isArray(stepsOrImport)) {
        // Could be a direct import object: { import: "name@source" }
        const directive = getImportDirective(
          stepsOrImport as Record<string, unknown>,
        );
        if (directive) {
          return resolveImportDirective(directive);
        }
        return null;
      }

      // Check each entry in the steps array for import directives
      for (const entry of stepsOrImport) {
        const directive = getImportDirective(entry as Record<string, unknown>);
        if (directive) {
          return resolveImportDirective(directive);
        }
      }

      return null;
    };

    const resolveImportDirective = (
      directive: string,
    ): {
      steps: PipelineStep[];
      variables: PipelineVariable[];
      importedFrom: PipelineDefinition["importedFrom"];
    } => {
      const parsed = parseImportDirective(directive);
      if (!parsed) {
        return {
          steps: [],
          variables: [],
          importedFrom: {
            sourceName: "unknown",
            pipelineName: directive,
            sourceSpec: {
              name: "unknown",
              raw: directive,
              type: "same-repo",
            },
            error: `Invalid import directive: "${directive}"`,
          },
        };
      }

      const { pipelineName, sourceAlias } = parsed;
      const sourceSpec = importSources.get(sourceAlias);

      if (!sourceSpec) {
        return {
          steps: [],
          variables: [],
          importedFrom: {
            sourceName: sourceAlias,
            pipelineName,
            sourceSpec: {
              name: sourceAlias,
              raw: sourceAlias,
              type: "same-repo",
            },
            error: `Import source "${sourceAlias}" not found in definitions.imports`,
          },
        };
      }

      // Try to resolve the imported content
      const importedContent = resolvedImports?.get(sourceAlias);
      if (!importedContent) {
        return {
          steps: [],
          variables: [],
          importedFrom: {
            sourceName: sourceAlias,
            pipelineName,
            sourceSpec,
            error: resolvedImports
              ? `Could not resolve import from "${sourceAlias}"`
              : "No resolver provided",
          },
        };
      }

      // Parse the imported YAML and extract the named pipeline
      try {
        const importedDoc = yaml.load(importedContent) as YamlDoc;
        if (!importedDoc?.pipelines?.custom?.[pipelineName]) {
          // Also check other pipeline types
          const allPipelines: Record<string, PipelineStep[]> = {};
          if (importedDoc?.pipelines) {
            if (importedDoc.pipelines.default) {
              allPipelines["default"] = importedDoc.pipelines.default;
            }
            if (importedDoc.pipelines.branches) {
              Object.entries(importedDoc.pipelines.branches).forEach(
                ([k, v]) => {
                  allPipelines[k] = v;
                },
              );
            }
            if (importedDoc.pipelines.custom) {
              Object.entries(importedDoc.pipelines.custom).forEach(([k, v]) => {
                allPipelines[k] = v;
              });
            }
            if (importedDoc.pipelines.tags) {
              Object.entries(importedDoc.pipelines.tags).forEach(([k, v]) => {
                allPipelines[k] = v;
              });
            }
            if (importedDoc.pipelines["pull-requests"]) {
              Object.entries(importedDoc.pipelines["pull-requests"]).forEach(
                ([k, v]) => {
                  allPipelines[k] = v;
                },
              );
            }
          }

          if (allPipelines[pipelineName]) {
            const { variables, steps } = extractVariablesAndSteps(
              allPipelines[pipelineName],
            );
            return {
              steps,
              variables,
              importedFrom: {
                sourceName: sourceAlias,
                pipelineName,
                sourceSpec,
              },
            };
          }

          return {
            steps: [],
            variables: [],
            importedFrom: {
              sourceName: sourceAlias,
              pipelineName,
              sourceSpec,
              error: `Pipeline "${pipelineName}" not found in imported source "${sourceAlias}"`,
            },
          };
        }

        const importedSteps = importedDoc.pipelines.custom[pipelineName];
        const { variables, steps } = extractVariablesAndSteps(importedSteps);
        return {
          steps,
          variables,
          importedFrom: {
            sourceName: sourceAlias,
            pipelineName,
            sourceSpec,
          },
        };
      } catch (parseErr) {
        return {
          steps: [],
          variables: [],
          importedFrom: {
            sourceName: sourceAlias,
            pipelineName,
            sourceSpec,
            error: `Failed to parse imported YAML from "${sourceAlias}": ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          },
        };
      }
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

    /**
     * Process a pipeline entry, checking for import directives first.
     * Returns a PipelineDefinition with import metadata if applicable.
     */
    const processPipelineEntry = (
      id: string,
      name: string,
      stepsOrImport: PipelineStep[],
      triggerType: PipelineDefinition["triggerType"],
      triggerPattern?: string,
      scheduleKey?: string,
    ): PipelineDefinition => {
      // Check for import directives
      const importResult = tryResolveImport(stepsOrImport);
      if (importResult) {
        return {
          id,
          name,
          steps: importResult.steps,
          triggerType,
          triggerPattern,
          ...(importResult.variables.length > 0
            ? { variables: importResult.variables }
            : {}),
          ...(Object.keys(globalOptions).length > 0
            ? { options: globalOptions }
            : {}),
          ...(globalImage ? { image: globalImage } : {}),
          schedules: scheduleKey ? schedulesByPipeline[scheduleKey] : undefined,
          importedFrom: importResult.importedFrom,
        };
      }

      // Normal pipeline (no import)
      const { variables, steps } = extractVariablesAndSteps(stepsOrImport);
      return {
        id,
        name,
        steps,
        triggerType,
        triggerPattern,
        ...(variables.length > 0 ? { variables } : {}),
        ...(Object.keys(globalOptions).length > 0
          ? { options: globalOptions }
          : {}),
        ...(globalImage ? { image: globalImage } : {}),
        schedules: scheduleKey ? schedulesByPipeline[scheduleKey] : undefined,
      };
    };

    if (doc.pipelines.default) {
      pipelines.push(
        processPipelineEntry(
          "default",
          "Default",
          doc.pipelines.default,
          "default",
          undefined,
          "default",
        ),
      );
    }

    if (doc.pipelines.branches) {
      Object.entries(doc.pipelines.branches).forEach(([branchName, steps]) => {
        pipelines.push(
          processPipelineEntry(
            `branch-${branchName}`,
            `Branch: ${branchName}`,
            steps,
            "branch",
            branchName,
            `branches.${branchName}`,
          ),
        );
      });
    }

    if (doc.pipelines["pull-requests"]) {
      Object.entries(doc.pipelines["pull-requests"]).forEach(
        ([pattern, steps]) => {
          pipelines.push(
            processPipelineEntry(
              `pr-${pattern}`,
              `Pull Request: ${pattern}`,
              steps,
              "pull-request",
              pattern,
              `pull-requests.${pattern}`,
            ),
          );
        },
      );
    }

    if (doc.pipelines.custom) {
      Object.entries(doc.pipelines.custom).forEach(([customName, steps]) => {
        pipelines.push(
          processPipelineEntry(
            `custom-${customName}`,
            `Custom: ${customName}`,
            steps,
            "custom",
            customName,
            `custom.${customName}`,
          ),
        );
      });
    }

    if (doc.pipelines.tags) {
      Object.entries(doc.pipelines.tags).forEach(([tagName, steps]) => {
        pipelines.push(
          processPipelineEntry(
            `tag-${tagName}`,
            `Tag: ${tagName}`,
            steps,
            "tag",
            tagName,
            `tags.${tagName}`,
          ),
        );
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
  size?: string,
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
        position: "relative" as const,
      },
    },
    size &&
      React.createElement(
        "span",
        {
          style: {
            position: "absolute" as const,
            top: "-6px",
            right: "-8px",
            fontSize: "9px",
            lineHeight: "14px",
            background: "#DCDFE4",
            color: "#222",
            padding: "0 5px",
            borderRadius: "4px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            border: `1px solid ${token("color.border", "#DFE1E6")}`,
          },
        },
        size,
      ),
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
            textAlign: "center",
            fontFamily: "monospace",
            lineHeight: "1.2",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          },
        },
        imageStr,
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
/**
 * Build a label for an import boundary badge node.
 */
const buildImportBadgeLabel = (
  sourceName: string,
  pipelineName: string,
): React.ReactNode => {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "2px",
        width: "100%",
      },
    },
    React.createElement(
      "span",
      {
        style: {
          fontSize: "9px",
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.5px",
          color: token("color.text.accent.purple", "#403294"),
        },
      },
      "Imported",
    ),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "11px",
          fontWeight: 500,
          color: token("color.text.accent.purple", "#403294"),
        },
      },
      `${pipelineName}`,
    ),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "9px",
          color: token("color.text.subtle", "#626F86"),
          fontFamily: "monospace",
        },
      },
      `from: ${sourceName}`,
    ),
  );
};

/**
 * Build a label for an unresolved import error node.
 */
const buildImportErrorLabel = (
  pipelineName: string,
  sourceName: string,
  error: string,
  sourceRaw?: string,
): React.ReactNode => {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "4px",
        width: "100%",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "4px",
        },
      },
      React.createElement(
        "span",
        { style: { fontSize: "14px" } },
        "\u26A0", // warning triangle
      ),
      React.createElement(
        "span",
        {
          style: {
            fontSize: "11px",
            fontWeight: 600,
          },
        },
        `Import: ${pipelineName}`,
      ),
    ),
    React.createElement(
      "span",
      {
        style: {
          fontSize: "10px",
          color: token("color.text.warning", "#974F0C"),
          textAlign: "center" as const,
        },
      },
      error,
    ),
    sourceRaw &&
      React.createElement(
        "span",
        {
          style: {
            fontSize: "9px",
            color: token("color.text.subtle", "#626F86"),
            fontFamily: "monospace",
            textAlign: "center" as const,
          },
        },
        sourceRaw,
      ),
  );
};

export const transformStepsToGraph = (
  pipeline: PipelineDefinition,
): { nodes: Node[]; edges: Edge[] } => {
  const { steps, importedFrom } = pipeline;
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

  // Handle unresolved/errored imports — show a single placeholder node
  if (importedFrom && importedFrom.error) {
    const importNodeId = `import-error-${nodeIdCounter++}`;
    nodes.push({
      id: importNodeId,
      data: {
        label: buildImportErrorLabel(
          importedFrom.pipelineName,
          importedFrom.sourceName,
          importedFrom.error,
          importedFrom.sourceSpec.raw,
        ),
        stepType: "import",
        importInfo: importedFrom,
      } as StepNodeData,
      position: { x: 0, y: 0 },
      style: {
        border: `2px dashed ${token("color.border.warning", "#F5CD47")}`,
        borderRadius: "8px",
        padding: "12px 16px",
        background: token("color.background.warning", "#FFF7D6"),
        color: token("color.text.warning", "#974F0C"),
        width: 260,
        minHeight: 60,
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

    previousNodeIds.forEach((prevId) => {
      edges.push({
        id: `e-${prevId}-${importNodeId}`,
        source: prevId,
        target: importNodeId,
        type: "step",
        animated: false,
        data: { stage: stageCounter } as EdgeData,
      });
    });
    stageCounter++;
    previousNodeIds = [importNodeId];
  } else if (importedFrom && !importedFrom.error && steps.length > 0) {
    // Resolved import — add an import badge node before the steps
    const badgeNodeId = `import-badge-${nodeIdCounter++}`;
    nodes.push({
      id: badgeNodeId,
      data: {
        label: buildImportBadgeLabel(
          importedFrom.sourceName,
          importedFrom.pipelineName,
        ),
        stepType: "import",
        importInfo: importedFrom,
      } as StepNodeData,
      position: { x: 0, y: 0 },
      style: {
        border: `2px dashed ${token("color.border.accent.purple", "#8270DB")}`,
        borderRadius: "8px",
        padding: "8px 12px",
        background: token("color.background.accent.purple.subtlest", "#F3F0FF"),
        color: token("color.text.accent.purple", "#403294"),
        width: 220,
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

    previousNodeIds.forEach((prevId) => {
      edges.push({
        id: `e-${prevId}-${badgeNodeId}`,
        source: prevId,
        target: badgeNodeId,
        type: "step",
        animated: false,
        data: { stage: stageCounter } as EdgeData,
      });
    });
    stageCounter++;
    previousNodeIds = [badgeNodeId];
  }

  const unwrapStep = (step: PipelineStep): PipelineStep => {
    const merged: PipelineStep = {};
    let current: PipelineStep | undefined = step;
    while (current) {
      for (const key of Object.keys(current)) {
        if (key !== "step" && merged[key] === undefined) {
          (merged as Record<string, unknown>)[key] = current[key];
        }
      }
      current = current.step;
    }
    return merged;
  };

  // Determine if this pipeline's steps are from an import (for styling)
  const isImported = !!importedFrom && !importedFrom.error;

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
              subStep.size as string | undefined,
            ),
            rawStep: subStep,
            stepType,
            isManual,
          } as StepNodeData,
          position: { x: 0, y: 0 },
          style: {
            border: isManual
              ? `2px dashed ${token("color.border.accent.blue", "#0052CC")}`
              : isImported
                ? `1px solid ${token("color.border.accent.purple", "#8270DB")}`
                : `1px solid ${token("color.border.success", "#4CBA61")}`,
            borderRadius: "4px",
            padding: "8px 12px",
            background: isManual
              ? token("color.background.accent.blue.subtle", "#E9F2FF")
              : isImported
                ? token("color.background.accent.purple.subtlest", "#F3F0FF")
                : token("color.background.success", "#D3F1A7"),
            color: isManual
              ? token("color.text.accent.blue", "#0052CC")
              : isImported
                ? token("color.text.accent.purple", "#403294")
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
            actualStep.size as string | undefined,
          ),
          rawStep: actualStep,
          stepType,
          isManual,
        } as StepNodeData,
        position: { x: 0, y: 0 },
        style: {
          border: isManual
            ? `2px dashed ${token("color.border.accent.blue", "#0052CC")}`
            : isImported
              ? `1px solid ${token("color.border.accent.purple", "#8270DB")}`
              : `1px solid ${token("color.border.success", "#4CBA61")}`,
          borderRadius: "4px",
          padding: "8px 12px",
          background: isManual
            ? token("color.background.accent.blue.subtle", "#E9F2FF")
            : isImported
              ? token("color.background.accent.purple.subtlest", "#F3F0FF")
              : token("color.background.success", "#D3F1A7"),
          color: isManual
            ? token("color.text.accent.blue", "#0052CC")
            : isImported
              ? token("color.text.accent.purple", "#403294")
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
