import { describe, it, expect, vi } from "vitest";
import {
  parsePipelines,
  transformStepsToGraph,
  getLayoutedElements,
  parseImportSource,
  parseImportDirective,
  parseImportSources,
} from "./utils";
import { PipelineDefinition } from "./types";

describe("parsePipelines", () => {
  it("should return empty array for invalid YAML", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parsePipelines("invalid: yaml: :")).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("should return empty array when pipelines key is missing", () => {
    expect(parsePipelines("options:\n  docker: true")).toEqual([]);
  });

  it("should parse default pipeline", () => {
    const yamlStr = `
pipelines:
  default:
    - step:
        name: Build
        script:
          - pnpm install
          - pnpm build
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("default");
    expect(result[0].name).toBe("Default");
    expect(result[0].steps).toHaveLength(1);
    expect(result[0].steps[0].step?.name).toBe("Build");
    expect(result[0].triggerType).toBe("default");
  });

  it("should parse branch pipelines", () => {
    const yamlStr = `
pipelines:
  branches:
    main:
      - step:
          name: Deploy
          script:
            - echo "Deploying"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("branch-main");
    expect(result[0].name).toBe("Branch: main");
    expect(result[0].steps).toHaveLength(1);
    expect(result[0].triggerType).toBe("branch");
    expect(result[0].triggerPattern).toBe("main");
  });

  it("should parse pull-requests pipelines", () => {
    const yamlStr = `
pipelines:
  pull-requests:
    '**':
      - step:
          script:
            - echo "PR testing"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pr-**");
    expect(result[0].name).toBe("Pull Request: **");
    expect(result[0].triggerType).toBe("pull-request");
    expect(result[0].triggerPattern).toBe("**");
  });

  it("should parse custom pipelines", () => {
    const yamlStr = `
pipelines:
  custom:
    sonar:
      - step:
          script:
            - echo "Sonar"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("custom-sonar");
    expect(result[0].triggerType).toBe("custom");
    expect(result[0].triggerPattern).toBe("sonar");
  });

  it("should parse tag pipelines", () => {
    const yamlStr = `
pipelines:
  tags:
    release-*:
      - step:
          script:
            - echo "Tag"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tag-release-*");
    expect(result[0].triggerType).toBe("tag");
    expect(result[0].triggerPattern).toBe("release-*");
  });

  it("should extract variables correctly", () => {
    const yamlStr = `
pipelines:
  custom:
    my-custom-pipeline:
      - variables:
          - name: MY_VAR
            default: value
          - name: OTHER_VAR
            allowed-values:
              - a
              - b
      - step:
          script:
            - echo "Custom"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].variables).toHaveLength(2);
    expect(result[0].variables?.[0].name).toBe("MY_VAR");
    expect(result[0].variables?.[0].default).toBe("value");
    expect(result[0].variables?.[1].name).toBe("OTHER_VAR");
    expect(result[0].variables?.[1].allowedValues).toEqual(["a", "b"]);
    expect(result[0].steps).toHaveLength(1);
  });

  it("should extract global options and image", () => {
    const yamlStr = `
image: node:18
options:
  docker: true
pipelines:
  default:
    - step:
        script:
          - echo "Hello"
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].image).toBe("node:18");
    expect(result[0].options).toEqual({ docker: true });
  });

  it("should parse schedule triggers", () => {
    const yamlStr = `
pipelines:
  custom:
    nightly:
      - step:
          script:
            - echo "Nightly build"
triggers:
  - schedule:
      cron: "0 0 * * *"
      pipeline: custom.nightly
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].schedules).toHaveLength(1);
    expect(result[0].schedules?.[0].cron).toBe("0 0 * * *");
  });
});

describe("transformStepsToGraph", () => {
  const makePipeline = (
    steps: PipelineDefinition["steps"],
  ): PipelineDefinition => ({
    id: "default",
    name: "Default",
    steps,
    triggerType: "default",
  });

  it("should create start and end nodes for an empty pipeline", () => {
    const { nodes, edges } = transformStepsToGraph(makePipeline([]));
    expect(nodes).toHaveLength(2); // start + end
    expect(nodes[0].id).toBe("start");
    expect(nodes[1].id).toBe("end");
    expect(edges).toHaveLength(1); // start -> end
  });

  it("should create a node for each step plus start and end", () => {
    const { nodes, edges } = transformStepsToGraph(
      makePipeline([
        { step: { name: "Build", script: ["npm install"] } },
        { step: { name: "Test", script: ["npm test"] } },
      ]),
    );
    // start + 2 steps + end = 4
    expect(nodes).toHaveLength(4);
    // start->Build, Build->Test, Test->end = 3
    expect(edges).toHaveLength(3);
  });

  it("should handle parallel steps", () => {
    const { nodes, edges } = transformStepsToGraph(
      makePipeline([
        {
          parallel: [
            { step: { name: "Lint", script: ["npm run lint"] } },
            { step: { name: "Test", script: ["npm test"] } },
          ],
        },
      ]),
    );
    // start + 2 parallel + end = 4
    expect(nodes).toHaveLength(4);
    // start->Lint, start->Test, Lint->end, Test->end = 4
    expect(edges).toHaveLength(4);
  });

  it("should mark manual steps", () => {
    const { nodes } = transformStepsToGraph(
      makePipeline([
        { step: { name: "Deploy", trigger: "manual", script: ["deploy"] } },
      ]),
    );
    const deployNode = nodes.find((n) => n.data.isManual);
    expect(deployNode).toBeDefined();
    expect(deployNode!.data.stepType).toBe("script");
  });

  it("should detect pipe step type", () => {
    const { nodes } = transformStepsToGraph(
      makePipeline([
        {
          step: {
            name: "Deploy Pipe",
            script: [{ pipe: "atlassian/deploy:1.0" }],
          },
        },
      ]),
    );
    const pipeNode = nodes.find((n) => n.data.stepType === "pipe");
    expect(pipeNode).toBeDefined();
  });

  it("should assign sequential stage indices to edges", () => {
    const { edges } = transformStepsToGraph(
      makePipeline([
        { step: { name: "A", script: ["a"] } },
        { step: { name: "B", script: ["b"] } },
      ]),
    );
    const stages = edges.map((e) => e.data?.stage);
    // start->A is stage 0, A->B is stage 1, B->end is stage 2
    expect(stages).toEqual([0, 1, 2]);
  });

  it("should have a start dot node", () => {
    const pipeline: PipelineDefinition = {
      id: "branch-main",
      name: "Branch: main",
      steps: [{ step: { name: "Build", script: ["build"] } }],
      triggerType: "branch",
      triggerPattern: "main",
    };
    const { nodes } = transformStepsToGraph(pipeline);
    const startNode = nodes.find((n) => n.id === "start");
    expect(startNode).toBeDefined();
    expect(startNode!.data.stepType).toBe("start");
  });
});

describe("getLayoutedElements", () => {
  it("should assign positions to nodes", () => {
    const nodes = [
      { id: "a", data: { label: "A" }, position: { x: 0, y: 0 } },
      { id: "b", data: { label: "B" }, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: "e-a-b", source: "a", target: "b" }];
    const result = getLayoutedElements(nodes, edges);
    // Nodes should have different y positions in TB layout
    expect(result.nodes[0].position.y).not.toBe(result.nodes[1].position.y);
  });

  it("should support LR direction", () => {
    const nodes = [
      { id: "a", data: { label: "A" }, position: { x: 0, y: 0 } },
      { id: "b", data: { label: "B" }, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: "e-a-b", source: "a", target: "b" }];
    const result = getLayoutedElements(nodes, edges, "LR");
    // Nodes should have different x positions in LR layout
    expect(result.nodes[0].position.x).not.toBe(result.nodes[1].position.x);
  });

  it("should not share state between calls", () => {
    const nodes1 = [
      { id: "x", data: { label: "X" }, position: { x: 0, y: 0 } },
    ];
    const nodes2 = [
      { id: "y", data: { label: "Y" }, position: { x: 0, y: 0 } },
      { id: "z", data: { label: "Z" }, position: { x: 0, y: 0 } },
    ];
    const result1 = getLayoutedElements(nodes1, []);
    const result2 = getLayoutedElements(nodes2, [
      { id: "e", source: "y", target: "z" },
    ]);
    expect(result1.nodes).toHaveLength(1);
    expect(result2.nodes).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Import parsing tests
// ─────────────────────────────────────────────────────────────────────────────

describe("parseImportSource", () => {
  it("should parse same-repo filepath (no colon)", () => {
    const result = parseImportSource(
      "shared",
      ".bitbucket/shared-pipelines.yml",
    );
    expect(result).toEqual({
      name: "shared",
      raw: ".bitbucket/shared-pipelines.yml",
      type: "same-repo",
      filePath: ".bitbucket/shared-pipelines.yml",
    });
  });

  it("should parse cross-repo with repo:ref format", () => {
    const result = parseImportSource(
      "shared-pipelines",
      "shared-pipelines:master",
    );
    expect(result).toEqual({
      name: "shared-pipelines",
      raw: "shared-pipelines:master",
      type: "cross-repo",
      repoSlug: "shared-pipelines",
      ref: "master",
      filePath: "bitbucket-pipelines.yml",
    });
  });

  it("should parse cross-repo with repo:ref:filepath format", () => {
    const result = parseImportSource(
      "shared",
      "shared-pipelines:master:.bitbucket/pipelines.yml",
    );
    expect(result).toEqual({
      name: "shared",
      raw: "shared-pipelines:master:.bitbucket/pipelines.yml",
      type: "cross-repo",
      repoSlug: "shared-pipelines",
      ref: "master",
      filePath: ".bitbucket/pipelines.yml",
    });
  });

  it("should handle filepath with colons in cross-repo format", () => {
    const result = parseImportSource("s", "repo:main:path:with:colons.yml");
    expect(result.type).toBe("cross-repo");
    expect(result.repoSlug).toBe("repo");
    expect(result.ref).toBe("main");
    expect(result.filePath).toBe("path:with:colons.yml");
  });
});

describe("parseImportDirective", () => {
  it("should parse valid import directive", () => {
    const result = parseImportDirective("deploy-to-staging@shared-pipelines");
    expect(result).toEqual({
      pipelineName: "deploy-to-staging",
      sourceAlias: "shared-pipelines",
    });
  });

  it("should return null for empty string", () => {
    expect(parseImportDirective("")).toBeNull();
  });

  it("should return null for string without @", () => {
    expect(parseImportDirective("no-at-sign")).toBeNull();
  });

  it("should return null for string starting with @", () => {
    expect(parseImportDirective("@source")).toBeNull();
  });

  it("should return null for string ending with @", () => {
    expect(parseImportDirective("name@")).toBeNull();
  });

  it("should handle @ in pipeline name (last @ wins)", () => {
    const result = parseImportDirective("name@with@at@source");
    expect(result).toEqual({
      pipelineName: "name@with@at",
      sourceAlias: "source",
    });
  });
});

describe("parseImportSources", () => {
  it("should extract import sources from YAML", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
    local: .bitbucket/shared.yml
pipelines:
  default:
    - step:
        script:
          - echo "test"
`;
    const result = parseImportSources(yamlStr);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("shared");
    expect(result[0].type).toBe("cross-repo");
    expect(result[1].name).toBe("local");
    expect(result[1].type).toBe("same-repo");
  });

  it("should return empty array when no imports", () => {
    const yamlStr = `
pipelines:
  default:
    - step:
        script:
          - echo "test"
`;
    expect(parseImportSources(yamlStr)).toEqual([]);
  });

  it("should return empty array for invalid YAML", () => {
    expect(parseImportSources("invalid: yaml: :")).toEqual([]);
  });
});

describe("parsePipelines with imports", () => {
  it("should detect import directives and mark as unresolved when no resolver provided", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  branches:
    main:
      - import: deploy-to-staging@shared
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom).toBeDefined();
    expect(result[0].importedFrom?.sourceName).toBe("shared");
    expect(result[0].importedFrom?.pipelineName).toBe("deploy-to-staging");
    expect(result[0].importedFrom?.error).toBe("No resolver provided");
    expect(result[0].steps).toEqual([]);
  });

  it("should resolve imports when resolver provides content", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  branches:
    main:
      - import: deploy@shared
`;
    const importedYaml = `
export: true
pipelines:
  custom:
    deploy:
      - step:
          name: Deploy Step
          script:
            - echo "deploying"
      - step:
          name: Verify
          script:
            - echo "verifying"
`;
    const resolvedImports = new Map<string, string>();
    resolvedImports.set("shared", importedYaml);

    const result = parsePipelines(yamlStr, resolvedImports);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom).toBeDefined();
    expect(result[0].importedFrom?.error).toBeUndefined();
    expect(result[0].importedFrom?.sourceName).toBe("shared");
    expect(result[0].importedFrom?.pipelineName).toBe("deploy");
    expect(result[0].steps).toHaveLength(2);
    expect(result[0].steps[0].step?.name).toBe("Deploy Step");
    expect(result[0].steps[1].step?.name).toBe("Verify");
  });

  it("should handle missing pipeline name in imported source", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  custom:
    my-pipeline:
      - import: nonexistent@shared
`;
    const importedYaml = `
export: true
pipelines:
  custom:
    some-other-pipeline:
      - step:
          script:
            - echo "hello"
`;
    const resolvedImports = new Map<string, string>();
    resolvedImports.set("shared", importedYaml);

    const result = parsePipelines(yamlStr, resolvedImports);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom?.error).toBe(
      'Pipeline "nonexistent" not found in imported source "shared"',
    );
    expect(result[0].steps).toEqual([]);
  });

  it("should handle import source not defined in definitions.imports", () => {
    const yamlStr = `
pipelines:
  default:
    - import: deploy@undefined-source
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom?.error).toBe(
      'Import source "undefined-source" not found in definitions.imports',
    );
  });

  it("should handle invalid import directive format", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  default:
    - import: no-at-sign
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom?.error).toContain("Invalid import directive");
  });

  it("should preserve normal pipelines alongside import pipelines", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  default:
    - step:
        name: Normal Step
        script:
          - echo "normal"
  branches:
    main:
      - import: deploy@shared
`;
    const result = parsePipelines(yamlStr);
    expect(result).toHaveLength(2);
    // Default pipeline should be normal
    expect(result[0].id).toBe("default");
    expect(result[0].importedFrom).toBeUndefined();
    expect(result[0].steps).toHaveLength(1);
    // Branch pipeline should be an import
    expect(result[1].id).toBe("branch-main");
    expect(result[1].importedFrom).toBeDefined();
  });

  it("should handle invalid YAML in imported content", () => {
    const yamlStr = `
definitions:
  imports:
    shared: shared-pipelines:master
pipelines:
  default:
    - import: deploy@shared
`;
    const resolvedImports = new Map<string, string>();
    resolvedImports.set("shared", "invalid: yaml: :");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parsePipelines(yamlStr, resolvedImports);
    expect(result).toHaveLength(1);
    expect(result[0].importedFrom?.error).toContain(
      "Failed to parse imported YAML",
    );
    consoleSpy.mockRestore();
  });
});

describe("transformStepsToGraph with imports", () => {
  it("should render an error node for unresolved imports", () => {
    const pipeline: PipelineDefinition = {
      id: "branch-main",
      name: "Branch: main",
      steps: [],
      triggerType: "branch",
      importedFrom: {
        sourceName: "shared",
        pipelineName: "deploy",
        sourceSpec: {
          name: "shared",
          raw: "shared-pipelines:master",
          type: "cross-repo",
          repoSlug: "shared-pipelines",
          ref: "master",
          filePath: "bitbucket-pipelines.yml",
        },
        error: 'Could not resolve import from "shared"',
      },
    };
    const { nodes, edges } = transformStepsToGraph(pipeline);
    // start + import-error + end = 3
    expect(nodes).toHaveLength(3);
    expect(edges.length).toBeGreaterThan(0);
    const importNode = nodes.find((n) => n.id.startsWith("import-error"));
    expect(importNode).toBeDefined();
    expect(importNode!.data.stepType).toBe("import");
    expect(importNode!.data.importInfo?.error).toBeTruthy();
  });

  it("should render a badge node + steps for resolved imports", () => {
    const pipeline: PipelineDefinition = {
      id: "branch-main",
      name: "Branch: main",
      steps: [{ step: { name: "Deploy Step", script: ["echo deploy"] } }],
      triggerType: "branch",
      importedFrom: {
        sourceName: "shared",
        pipelineName: "deploy",
        sourceSpec: {
          name: "shared",
          raw: "shared-pipelines:master",
          type: "cross-repo",
          repoSlug: "shared-pipelines",
          ref: "master",
          filePath: "bitbucket-pipelines.yml",
        },
      },
    };
    const { nodes, edges } = transformStepsToGraph(pipeline);
    // start + badge + step + end = 4
    expect(nodes).toHaveLength(4);
    expect(edges.length).toBeGreaterThan(0);
    const badgeNode = nodes.find((n) => n.id.startsWith("import-badge"));
    expect(badgeNode).toBeDefined();
    expect(badgeNode!.data.stepType).toBe("import");
  });
});
