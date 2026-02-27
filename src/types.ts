import React from "react";

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

/** YAML document structure for bitbucket-pipelines.yml files. */
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
