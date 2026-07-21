import { execSync, spawn } from "child_process";
import { mkdirSync, rmSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import { Blueprint, validateBlueprint, checkPhaseAlignment } from "./reverse-solver";
import { Materializer, MaterializedProject } from "./materializer";
import { computeDelta } from "./security";

/**
 * Evolution Engine - multi-branch sandbox evolution with stability scoring
 * Generates multiple blueprint variants, tests them, and promotes the best
 */

export interface EvolutionResult {
  status: "converged" | "rejected" | "partial";
  bestBlueprint?: Blueprint;
  bestDelta?: number;
  candidates: EvolutionCandidate[];
  totalTime: number;
}

export interface EvolutionCandidate {
  blueprint: Blueprint;
  delta: number;
  success: boolean;
  error?: string;
  executionTime?: number;
}

export class Evolution {
  private materializer: Materializer;
  private baseSandboxPath: string;

  constructor(baseSandboxPath: string = "/tmp/aletheia-sandboxes") {
    this.materializer = new Materializer();
    this.baseSandboxPath = baseSandboxPath;

    // Ensure base path exists
    mkdirSync(baseSandboxPath, { recursive: true });
  }

  /**
   * Evolve multiple blueprint candidates in parallel sandboxes
   */
  async evolve(
    blueprints: Blueprint[],
    timeout: number = 10000
  ): Promise<EvolutionResult> {
    const startTime = Date.now();
    const candidates: EvolutionCandidate[] = [];

    // Validate all blueprints first
    for (const bp of blueprints) {
      try {
        validateBlueprint(bp);
        checkPhaseAlignment(bp);
      } catch (error) {
        candidates.push({
          blueprint: bp,
          delta: 1.0,
          success: false,
          error: error instanceof Error ? error.message : "Validation failed",
        });
        continue;
      }
    }

    // Execute each blueprint in its own sandbox
    const execPromises = blueprints.map((bp, idx) =>
      this.executeBlueprintInSandbox(bp, idx, timeout)
    );

    const results = await Promise.all(execPromises);
    candidates.push(...results);

    // Find best candidate
    const bestCandidate = candidates.reduce((best, current) => {
      if (!current.success) return best;
      if (!best.success) return current;
      // Closer to 0.03 is better
      const bestDist = Math.abs(best.delta - 0.03);
      const currentDist = Math.abs(current.delta - 0.03);
      return currentDist < bestDist ? current : best;
    });

    // Determine evolution status
    let status: "converged" | "rejected" | "partial" = "rejected";
    if (bestCandidate.success && bestCandidate.delta >= 0.02 && bestCandidate.delta <= 0.04) {
      status = "converged";
    } else if (candidates.some((c) => c.success)) {
      status = "partial";
    }

    return {
      status,
      bestBlueprint: bestCandidate.success ? bestCandidate.blueprint : undefined,
      bestDelta: bestCandidate.success ? bestCandidate.delta : undefined,
      candidates,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Execute a blueprint in an isolated sandbox
   */
  private async executeBlueprintInSandbox(
    blueprint: Blueprint,
    index: number,
    timeout: number
  ): Promise<EvolutionCandidate> {
    const sandboxPath = join(this.baseSandboxPath, `sandbox_${index}_${Date.now()}`);
    const startTime = Date.now();

    try {
      // Create sandbox directory
      mkdirSync(sandboxPath, { recursive: true });

      // Materialize blueprint into code
      const project = this.materializer.build(blueprint, sandboxPath);

      // Execute the generated code
      const result = await this.executeProject(project, timeout);

      const delta = computeDelta(result);

      return {
        blueprint,
        delta,
        success: !result.error,
        error: result.error,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        blueprint,
        delta: 1.0,
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
        executionTime: Date.now() - startTime,
      };
    } finally {
      // Cleanup sandbox
      this.cleanupSandbox(sandboxPath);
    }
  }

  /**
   * Execute a materialized project
   */
  private async executeProject(
    project: MaterializedProject,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ error: "Execution timeout" });
      }, timeout);

      try {
        // For TypeScript projects, we need to compile first
        // For now, we'll simulate execution
        const result = {
          success: true,
          output: "Project executed successfully",
        };

        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        resolve({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Clean up sandbox directory
   */
  private cleanupSandbox(sandboxPath: string): void {
    try {
      if (existsSync(sandboxPath)) {
        rmSync(sandboxPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to cleanup sandbox ${sandboxPath}:`, error);
    }
  }

  /**
   * Promote a blueprint - save it as the new system state
   */
  async promoteBlueprint(
    blueprint: Blueprint,
    targetPath: string
  ): Promise<boolean> {
    try {
      // Create target directory
      mkdirSync(targetPath, { recursive: true });

      // Materialize blueprint to target
      this.materializer.build(blueprint, targetPath);

      // Save blueprint metadata
      const metadataPath = join(targetPath, ".blueprint.json");
      const metadata = {
        id: blueprint.id,
        goal: blueprint.goal,
        timestamp: Date.now(),
        constraints: blueprint.constraints,
        nodeCount: blueprint.nodes.length,
        flowCount: blueprint.flows.length,
      };

      const fs = await import("fs/promises");
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return true;
    } catch (error) {
      console.error("Failed to promote blueprint:", error);
      return false;
    }
  }

  /**
   * Rollback to previous blueprint
   */
  async rollbackBlueprint(backupPath: string, targetPath: string): Promise<boolean> {
    try {
      // Remove current
      if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true, force: true });
      }

      // Restore from backup
      const fs = await import("fs/promises");
      const files = await fs.readdir(backupPath, { recursive: true });

      for (const file of files) {
        const srcPath = join(backupPath, file as string);
        const dstPath = join(targetPath, file as string);

        const stat = await fs.stat(srcPath);
        if (stat.isDirectory()) {
          mkdirSync(dstPath, { recursive: true });
        } else {
          mkdirSync(join(dstPath, ".."), { recursive: true });
          await fs.copyFile(srcPath, dstPath);
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to rollback blueprint:", error);
      return false;
    }
  }
}

/**
 * Multi-branch evolution coordinator
 * Manages multiple evolution runs and selects best outcome
 */
export class MultibranchEvolutionCoordinator {
  private evolution: Evolution;

  constructor(baseSandboxPath?: string) {
    this.evolution = new Evolution(baseSandboxPath);
  }

  /**
   * Run multi-branch evolution
   */
  async runMultibranch(
    blueprintCandidates: Blueprint[],
    options: {
      timeout?: number;
      maxIterations?: number;
      convergenceThreshold?: number;
    } = {}
  ): Promise<EvolutionResult> {
    const {
      timeout = 10000,
      maxIterations = 3,
      convergenceThreshold = 0.03,
    } = options;

    let bestResult: EvolutionResult | null = null;
    let iteration = 0;

    while (iteration < maxIterations) {
      const result = await this.evolution.evolve(blueprintCandidates, timeout);

      if (!bestResult || this.isBetterResult(result, bestResult, convergenceThreshold)) {
        bestResult = result;
      }

      if (result.status === "converged") {
        break;
      }

      iteration++;
    }

    return bestResult || {
      status: "rejected",
      candidates: [],
      totalTime: 0,
    };
  }

  /**
   * Compare two evolution results
   */
  private isBetterResult(
    current: EvolutionResult,
    previous: EvolutionResult,
    threshold: number
  ): boolean {
    if (current.status === "converged" && previous.status !== "converged") {
      return true;
    }

    if (!current.bestDelta || !previous.bestDelta) {
      return false;
    }

    const currentDist = Math.abs(current.bestDelta - threshold);
    const previousDist = Math.abs(previous.bestDelta - threshold);

    return currentDist < previousDist;
  }
}
