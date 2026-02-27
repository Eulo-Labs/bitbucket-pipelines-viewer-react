import { describe, it, expect, vi } from "vitest";
import {
  parsePipelines,
  transformStepsToGraph,
  getLayoutedElements,
  PipelineDefinition,
} from "./utils";

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
