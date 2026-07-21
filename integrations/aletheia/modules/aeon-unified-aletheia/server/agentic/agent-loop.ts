import { ReverseSolver, ReverseSolveInput, Blueprint } from "./reverse-solver";
import { Evolution, MultibranchEvolutionCoordinator, EvolutionResult } from "./evolution";
import { sanitizeMemory, intentFilter } from "./security";
import { chat } from "../ai-integration";

/**
 * Agent Loop - main orchestration of the agentic system
 * Handles: intent filtering → reverse solving → evolution → promotion
 */

export interface AgentGoal {
  objective: string;
  constraints?: Record<string, any>;
  context?: string;
  branches?: number;
  maxIterations?: number;
}

export interface AgentExecutionResult {
  success: boolean;
  goal: AgentGoal;
  blueprint?: Blueprint;
  evolutionResult?: EvolutionResult;
  reasoning: string;
  memory: AgentMemoryEntry[];
  executionTime: number;
}

export interface AgentMemoryEntry {
  timestamp: number;
  type: "goal" | "blueprint" | "evolution" | "decision" | "error";
  content: Record<string, any>;
}

export class AgentLoop {
  private reverseSolver: ReverseSolver;
  private evolution: MultibranchEvolutionCoordinator;
  private memory: AgentMemoryEntry[] = [];
  private model: "ionos" | "gemini" = "ionos";

  constructor(model: "ionos" | "gemini" = "ionos") {
    this.model = model;
    this.reverseSolver = new ReverseSolver(model);
    this.evolution = new MultibranchEvolutionCoordinator();
  }

  /**
   * Main agent execution loop
   */
  async execute(goal: AgentGoal): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const result: AgentExecutionResult = {
      success: false,
      goal,
      reasoning: "",
      memory: [],
      executionTime: 0,
    };

    try {
      // Step 1: Intent filtering
      if (!intentFilter(goal.objective)) {
        throw new Error("Goal blocked by safety filter");
      }

      this.recordMemory("goal", {
        objective: goal.objective,
        constraints: goal.constraints,
      });

      // Step 2: Reverse solve to blueprint
      const blueprints = await this.reversesolvePhase(goal);
      if (blueprints.length === 0) {
        throw new Error("Failed to generate blueprints");
      }

      this.recordMemory("blueprint", {
        count: blueprints.length,
        goals: blueprints.map((b) => b.goal),
      });

      // Step 3: Multi-branch evolution
      const evolutionResult = await this.evolutionPhase(goal, blueprints);

      this.recordMemory("evolution", {
        status: evolutionResult.status,
        bestDelta: evolutionResult.bestDelta,
        candidates: evolutionResult.candidates.length,
      });

      // Step 4: Decision - promote or reject
      const decision = await this.decisionPhase(evolutionResult);

      this.recordMemory("decision", {
        promoted: decision.promoted,
        reasoning: decision.reasoning,
      });

      if (decision.promoted && evolutionResult.bestBlueprint) {
        result.success = true;
        result.blueprint = evolutionResult.bestBlueprint;
        result.evolutionResult = evolutionResult;
        result.reasoning = decision.reasoning;
      } else {
        result.reasoning = `Evolution did not converge. ${decision.reasoning}`;
      }
    } catch (error) {
      result.reasoning = error instanceof Error ? error.message : "Unknown error";
      this.recordMemory("error", {
        error: result.reasoning,
      });
    }

    result.memory = this.getSanitizedMemory();
    result.executionTime = Date.now() - startTime;

    return result;
  }

  /**
   * Phase 1: Reverse solve goal into blueprints
   */
  private async reversesolvePhase(goal: AgentGoal): Promise<Blueprint[]> {
    const input: ReverseSolveInput = {
      objective: goal.objective,
      constraints: goal.constraints,
      context: goal.context,
      branches: goal.branches || 3,
    };

    try {
      const blueprints = await this.reverseSolver.generateBlueprintCandidates(
        input,
        input.branches
      );

      console.log(`[Agent] Generated ${blueprints.length} blueprint candidates`);
      return blueprints;
    } catch (error) {
      console.error("[Agent] Reverse solve failed:", error);
      return [];
    }
  }

  /**
   * Phase 2: Multi-branch evolution
   */
  private async evolutionPhase(
    goal: AgentGoal,
    blueprints: Blueprint[]
  ): Promise<EvolutionResult> {
    try {
      const result = await this.evolution.runMultibranch(blueprints, {
        timeout: 10000,
        maxIterations: goal.maxIterations || 2,
        convergenceThreshold: 0.03,
      });

      console.log(`[Agent] Evolution complete: ${result.status}`);
      console.log(
        `[Agent] Best delta: ${result.bestDelta?.toFixed(4)}, Candidates: ${result.candidates.length}`
      );

      return result;
    } catch (error) {
      console.error("[Agent] Evolution failed:", error);
      return {
        status: "rejected",
        candidates: [],
        totalTime: 0,
      };
    }
  }

  /**
   * Phase 3: Decision - should we promote this blueprint?
   */
  private async decisionPhase(
    evolutionResult: EvolutionResult
  ): Promise<{ promoted: boolean; reasoning: string }> {
    // Automatic decision based on stability
    if (
      evolutionResult.status === "converged" &&
      evolutionResult.bestDelta &&
      evolutionResult.bestDelta >= 0.02 &&
      evolutionResult.bestDelta <= 0.04
    ) {
      return {
        promoted: true,
        reasoning: `System converged with optimal stability (Δ=${evolutionResult.bestDelta.toFixed(4)})`,
      };
    }

    if (evolutionResult.status === "partial" && evolutionResult.bestDelta) {
      const isAcceptable = evolutionResult.bestDelta < 0.1;
      return {
        promoted: isAcceptable,
        reasoning: `Partial convergence with Δ=${evolutionResult.bestDelta.toFixed(4)}. ${
          isAcceptable ? "Acceptable for deployment." : "Below acceptance threshold."
        }`,
      };
    }

    return {
      promoted: false,
      reasoning: `Evolution failed to converge. Δ=${evolutionResult.bestDelta?.toFixed(4) || "N/A"}`,
    };
  }

  /**
   * Record memory entry
   */
  private recordMemory(type: AgentMemoryEntry["type"], content: Record<string, any>): void {
    this.memory.push({
      timestamp: Date.now(),
      type,
      content,
    });
  }

  /**
   * Get sanitized memory (removes sensitive data)
   */
  private getSanitizedMemory(): AgentMemoryEntry[] {
    return this.memory.map((entry) => ({
      ...entry,
      content: sanitizeMemory(entry.content),
    }));
  }

  /**
   * Get full memory (for debugging)
   */
  getMemory(): AgentMemoryEntry[] {
    return this.memory;
  }

  /**
   * Clear memory
   */
  clearMemory(): void {
    this.memory = [];
  }

  /**
   * Self-modify: update agent parameters based on performance
   */
  async selfOptimize(results: AgentExecutionResult[]): Promise<void> {
    const successRate = results.filter((r) => r.success).length / results.length;

    console.log(`[Agent] Self-optimization: ${(successRate * 100).toFixed(1)}% success rate`);

    // Analyze memory patterns
    const errorPatterns = this.analyzeErrorPatterns();

    if (errorPatterns.length > 0) {
      console.log(`[Agent] Detected error patterns:`, errorPatterns);
      // Could adjust parameters based on patterns
    }

    // Log optimization decisions
    this.recordMemory("decision", {
      type: "self-optimization",
      successRate,
      errorPatterns,
    });
  }

  /**
   * Analyze error patterns in memory
   */
  private analyzeErrorPatterns(): string[] {
    const errors = this.memory
      .filter((m) => m.type === "error")
      .map((m) => m.content.error as string);

    const patterns: Record<string, number> = {};
    for (const error of errors) {
      const key = error.split(":")[0];
      patterns[key] = (patterns[key] || 0) + 1;
    }

    return Object.entries(patterns)
      .filter(([_, count]) => count > 1)
      .map(([pattern]) => pattern);
  }
}

/**
 * Convenience function to run agent with defaults
 */
export async function runAgent(goal: AgentGoal, model: "ionos" | "gemini" = "ionos"): Promise<AgentExecutionResult> {
  const agent = new AgentLoop(model);
  return agent.execute(goal);
}

/**
 * Batch execution - run multiple goals and aggregate results
 */
export async function runAgentBatch(
  goals: AgentGoal[],
  model: "ionos" | "gemini" = "ionos"
): Promise<AgentExecutionResult[]> {
  const agent = new AgentLoop(model);
  const results: AgentExecutionResult[] = [];

  for (const goal of goals) {
    const result = await agent.execute(goal);
    results.push(result);
  }

  // Self-optimize based on batch results
  await agent.selfOptimize(results);

  return results;
}
