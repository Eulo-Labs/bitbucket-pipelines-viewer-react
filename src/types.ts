import React from "react";

/** Parsed import source from definitions.imports */
export interface ImportSource {
  /** The alias used in import references (e.g., "shared-pipelines") */
  name: string;
  /** Raw source string from YAML */
  raw: string;
  /** Parsed source type */
  type: "same-repo" | "cross-repo";
  /** File path (for same-repo) or repo slug */
  repoSlug?: string;
  /** Branch or tag ref (for cross-repo) */
  ref?: string;
  /** File path within repo */
  filePath?: string;
}

/** Result from resolving an import */
export interface ImportResolution {
  source: ImportSource;
  /** The YAML content of the imported file, or null if resolution failed */
  content: string | null;
  /** Error message if resolution failed */
  error?: string;
}

/** An import directive found in a pipeline definition */
export interface PipelineImport {
  /** The pipeline name to import (before the @) */
  pipelineName: string;
  /** The import source alias (after the @) */
  sourceAlias: string;
}

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
  /** If this pipeline is an import, the import metadata */
  importedFrom?: {
    sourceName: string;
    pipelineName: string;
    sourceSpec: ImportSource;
    error?: string;
  };
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
    | "trigger"
    | "import";
  isManual?: boolean;
  /** Import metadata for import-type nodes */
  importInfo?: {
    sourceName: string;
    pipelineName: string;
    sourceSpec: ImportSource;
    error?: string;
  };
}

/** Data attached to each React Flow edge, tracking the pipeline stage index. */
export interface EdgeData {
  stage: number;
}

/** YAML document structure for bitbucket-pipelines.yml files. */
export interface YamlDoc {
  definitions?: {
    imports?: Record<string, string>;
    [key: string]: unknown;
  };
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
  export?: boolean;
}
