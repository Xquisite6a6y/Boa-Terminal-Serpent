import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { Blueprint, Node } from "./reverse-solver";

/**
 * Materializer - converts blueprints into executable code
 * Generates TypeScript modules for each node
 */

export interface MaterializedProject {
  path: string;
  files: Map<string, string>;
  mainFile: string;
  nodeFiles: Map<string, string>; // role -> filepath
}

export class Materializer {
  /**
   * Build a project from blueprint
   */
  build(blueprint: Blueprint, basePath: string): MaterializedProject {
    // Create directory structure
    mkdirSync(basePath, { recursive: true });

    const files = new Map<string, string>();
    const nodeFiles = new Map<string, string>();

    // Generate module for each node
    for (const node of blueprint.nodes) {
      const moduleCode = this.generateNodeModule(node, blueprint);
      const fileName = `${node.role}.ts`;
      const filePath = join(basePath, fileName);

      files.set(fileName, moduleCode);
      nodeFiles.set(node.role, filePath);

      writeFileSync(filePath, moduleCode);
    }

    // Generate main orchestrator
    const mainCode = this.generateMainOrchestrator(blueprint, nodeFiles);
    const mainFile = "main.ts";
    files.set(mainFile, mainCode);
    writeFileSync(join(basePath, mainFile), mainCode);

    // Generate package.json
    const packageJson = this.generatePackageJson(blueprint);
    files.set("package.json", JSON.stringify(packageJson, null, 2));
    writeFileSync(join(basePath, "package.json"), files.get("package.json")!);

    // Generate tsconfig
    const tsconfig = this.generateTsConfig();
    files.set("tsconfig.json", JSON.stringify(tsconfig, null, 2));
    writeFileSync(join(basePath, "tsconfig.json"), files.get("tsconfig.json")!);

    return {
      path: basePath,
      files,
      mainFile: join(basePath, mainFile),
      nodeFiles,
    };
  }

  /**
   * Generate TypeScript module for a node
   */
  private generateNodeModule(node: Node, blueprint: Blueprint): string {
    const nodeType = this.inferNodeType(node, blueprint);

    let code = `/**
 * Node: ${node.role}
 * Description: ${node.description}
 * Type: ${nodeType}
 */

export interface NodeInput {
  data: any;
  context?: Record<string, any>;
}

export interface NodeOutput {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute this node's logic
 */
export async function execute(input: NodeInput): Promise<NodeOutput> {
  try {
    // Node-specific logic
    const result = await process${this.capitalize(node.role)}(input.data);
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Core processing logic for ${node.role}
 */
async function process${this.capitalize(node.role)}(data: any): Promise<any> {
  // TODO: Implement ${node.role} logic
  // Input: ${this.getInputDescription(node, blueprint)}
  // Output: Transformed data
  
  return data;
}
`;

    return code;
  }

  /**
   * Generate main orchestrator that coordinates all nodes
   */
  private generateMainOrchestrator(
    blueprint: Blueprint,
    nodeFiles: Map<string, string>
  ): string {
    const imports = Array.from(blueprint.nodes)
      .map((n) => `import * as ${n.role} from './${n.role}';`)
      .join("\n");

    const nodeExecutions = blueprint.nodes
      .map((n) => `  const ${n.role}Result = await ${n.role}.execute(input);`)
      .join("\n");

    const flowLogic = this.generateFlowLogic(blueprint);

    return `/**
 * Main Orchestrator - coordinates all nodes
 * Generated from blueprint: ${blueprint.goal}
 */

${imports}

export interface ExecutionContext {
  blueprintId: string;
  goal: string;
  startTime: number;
  results: Map<string, any>;
}

/**
 * Execute the entire pipeline
 */
export async function executePipeline(inputData: any): Promise<any> {
  const context: ExecutionContext = {
    blueprintId: '${blueprint.id}',
    goal: '${blueprint.goal}',
    startTime: Date.now(),
    results: new Map(),
  };

  try {
    // Execute nodes in sequence
    let data = inputData;

${flowLogic}

    return {
      success: true,
      data,
      executionTime: Date.now() - context.startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - context.startTime,
    };
  }
}

/**
 * Main entry point
 */
if (import.meta.main) {
  const testInput = { test: 'data' };
  executePipeline(testInput).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
`;
  }

  /**
   * Generate flow logic based on blueprint connections
   */
  private generateFlowLogic(blueprint: Blueprint): string {
    // Find root nodes (no incoming connections)
    const allTargets = new Set(blueprint.flows.map(([_, to]) => to));
    const rootNodes = blueprint.nodes.filter(
      (n) => !allTargets.has(n.id)
    );

    let logic = "";

    // Execute root nodes first
    for (const root of rootNodes) {
      logic += `    const ${root.role}Result = await ${root.role}.execute({ data });
    if (!${root.role}Result.success) throw new Error(\`${root.role} failed\`);
    data = ${root.role}Result.data;
`;
    }

    // Execute remaining nodes in dependency order
    const executed = new Set(rootNodes.map((n) => n.id));

    while (executed.size < blueprint.nodes.length) {
      for (const node of blueprint.nodes) {
        if (executed.has(node.id)) continue;

        // Check if all dependencies are executed
        const dependencies = blueprint.flows
          .filter(([_, to]) => to === node.id)
          .map(([from]) => from);

        if (dependencies.every((dep) => executed.has(dep))) {
          logic += `    const ${node.role}Result = await ${node.role}.execute({ data });
    if (!${node.role}Result.success) throw new Error(\`${node.role} failed\`);
    data = ${node.role}Result.data;
`;
          executed.add(node.id);
        }
      }
    }

    return logic;
  }

  /**
   * Infer node type from role
   */
  private inferNodeType(
    node: Node,
    blueprint: Blueprint
  ): "input" | "processor" | "output" | "storage" | "validator" {
    const role = node.role.toLowerCase();

    if (role.includes("input") || role.includes("fetch")) return "input";
    if (role.includes("output") || role.includes("return")) return "output";
    if (role.includes("store") || role.includes("save")) return "storage";
    if (role.includes("validate") || role.includes("check")) return "validator";

    return "processor";
  }

  /**
   * Get description of what a node should receive as input
   */
  private getInputDescription(node: Node, blueprint: Blueprint): string {
    const incoming = blueprint.flows
      .filter(([_, to]) => to === node.id)
      .map(([from]) => {
        const sourceNode = blueprint.nodes.find((n) => n.id === from);
        return sourceNode?.role || "unknown";
      });

    if (incoming.length === 0) return "initial input data";
    return `output from: ${incoming.join(", ")}`;
  }

  /**
   * Generate package.json for the project
   */
  private generatePackageJson(blueprint: Blueprint): any {
    return {
      name: `aletheia-blueprint-${blueprint.id.substring(0, 8)}`,
      version: "1.0.0",
      type: "module",
      description: blueprint.goal,
      main: "dist/main.js",
      scripts: {
        build: "tsc",
        start: "node dist/main.js",
        test: "node dist/main.js",
      },
      dependencies: {
        typescript: "^5.3.0",
      },
    };
  }

  /**
   * Generate tsconfig.json
   */
  private generateTsConfig(): any {
    return {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        lib: ["ES2020"],
        outDir: "./dist",
        rootDir: "./",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ["*.ts"],
      exclude: ["node_modules", "dist"],
    };
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
