import { chat } from "../ai-integration";

/**
 * Reverse Solver - converts goals into architectural blueprints
 * Uses your ELF framework to reason backward from desired end-state
 */

export interface Node {
  id: string;
  role: string;
  description: string;
  connections: string[];
}

export interface Blueprint {
  id: string;
  goal: string;
  nodes: Node[];
  flows: Array<[string, string]>; // [from, to]
  constraints: Record<string, any>;
  score?: number;
  timestamp: number;
}

export interface ReverseSolveInput {
  objective: string;
  constraints?: Record<string, any>;
  context?: string;
  branches?: number;
}

/**
 * Generate unique node ID
 */
function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reverse Solver - uses LLM to generate architectural blueprint from goal
 */
export class ReverseSolver {
  private model: "ionos" | "gemini" = "ionos";

  constructor(model: "ionos" | "gemini" = "ionos") {
    this.model = model;
  }

  /**
   * Generate a blueprint by reverse-solving from the goal
   */
  async generateBlueprint(input: ReverseSolveInput): Promise<Blueprint> {
    const prompt = this.buildReverseSolvePrompt(input);

    const messages = [
      {
        role: "user" as const,
        content: prompt,
      },
    ];

    const response = await chat(messages, this.model, {
      systemPrompt: this.getReverseSolveSystemPrompt(),
      temperature: 0.7,
      maxTokens: 2000,
    });

    if (!response.success) {
      throw new Error(`Reverse solver failed: ${response.error}`);
    }

    // Parse LLM response into blueprint structure
    const blueprint = this.parseBlueprint(response.content, input);
    return blueprint;
  }

  /**
   * Build the reverse-solve prompt for the LLM
   */
  private buildReverseSolvePrompt(input: ReverseSolveInput): string {
    return `
You are an expert system architect using the Reverse Solver framework.

OBJECTIVE: ${input.objective}

CONSTRAINTS:
${Object.entries(input.constraints || {})
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

CONTEXT: ${input.context || "General purpose system"}

TASK: Reverse-solve the architecture needed to achieve this objective.

Return a JSON structure with:
{
  "nodes": [
    {
      "role": "component_name",
      "description": "what this component does",
      "type": "input|processor|output|storage|validator"
    }
  ],
  "flows": [
    ["source_role", "target_role"]
  ],
  "reasoning": "explanation of why this architecture works"
}

Think backward from the desired end-state. What components MUST exist? What must they do? How must they connect?
`;
  }

  /**
   * Get system prompt for reverse solving
   */
  private getReverseSolveSystemPrompt(): string {
    return `You are an advanced system architect using the Reverse Solver framework.

Your approach:
1. Start with the desired end-state (the goal)
2. Work backward to identify necessary components
3. Define component roles and responsibilities
4. Specify data flows between components
5. Ensure all constraints are satisfied

Use the ELF framework principles:
- Entropic Dynamics: Components should naturally converge toward stable states
- Lagrangian Optimization: Minimize unnecessary complexity
- Phase Alignment: Ensure components are compatible
- Stability: Design for Δ (delta) between 0.02-0.04

Always return valid JSON for blueprint parsing.`;
  }

  /**
   * Parse LLM response into Blueprint structure
   */
  private parseBlueprint(content: string, input: ReverseSolveInput): Blueprint {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build nodes with IDs
      const nodes: Node[] = parsed.nodes.map(
        (n: any) => ({
          id: generateNodeId(),
          role: n.role,
          description: n.description || "",
          connections: [],
        })
      );

      // Create role -> node map for flow resolution
      const roleMap = new Map(nodes.map((n) => [n.role, n]));

      // Build flows and update connections
      const flows: Array<[string, string]> = [];
      for (const [from, to] of parsed.flows || []) {
        const fromNode = roleMap.get(from);
        const toNode = roleMap.get(to);
        if (fromNode && toNode) {
          fromNode.connections.push(toNode.id);
          flows.push([fromNode.id, toNode.id]);
        }
      }

      return {
        id: generateNodeId(),
        goal: input.objective,
        nodes,
        flows,
        constraints: input.constraints || {},
        timestamp: Date.now(),
      };
    } catch (error) {
      // Fallback: create basic blueprint
      console.error("Blueprint parsing failed:", error);
      return this.createFallbackBlueprint(input);
    }
  }

  /**
   * Create a fallback blueprint if parsing fails
   */
  private createFallbackBlueprint(input: ReverseSolveInput): Blueprint {
    const inputNode: Node = {
      id: generateNodeId(),
      role: "input",
      description: "Accept input data",
      connections: [],
    };

    const processorNode: Node = {
      id: generateNodeId(),
      role: "processor",
      description: "Process data according to objective",
      connections: [],
    };

    const outputNode: Node = {
      id: generateNodeId(),
      role: "output",
      description: "Return processed results",
      connections: [],
    };

    inputNode.connections.push(processorNode.id);
    processorNode.connections.push(outputNode.id);

    return {
      id: generateNodeId(),
      goal: input.objective,
      nodes: [inputNode, processorNode, outputNode],
      flows: [
        [inputNode.id, processorNode.id],
        [processorNode.id, outputNode.id],
      ],
      constraints: input.constraints || {},
      timestamp: Date.now(),
    };
  }

  /**
   * Generate multiple blueprint candidates (for multi-branch evolution)
   */
  async generateBlueprintCandidates(
    input: ReverseSolveInput,
    count: number = 3
  ): Promise<Blueprint[]> {
    const blueprints: Blueprint[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const bp = await this.generateBlueprint(input);
        bp.score = Math.random(); // Will be scored during evolution
        blueprints.push(bp);
      } catch (error) {
        console.error(`Failed to generate blueprint candidate ${i}:`, error);
      }
    }

    return blueprints;
  }
}

/**
 * Validate blueprint structure
 */
export function validateBlueprint(blueprint: Blueprint): boolean {
  if (!blueprint.nodes || blueprint.nodes.length === 0) {
    throw new Error("Blueprint must have at least one node");
  }

  if (!blueprint.flows || blueprint.flows.length === 0) {
    // Single node is valid
    return true;
  }

  // Verify all flow references exist
  const nodeIds = new Set(blueprint.nodes.map((n) => n.id));
  for (const [from, to] of blueprint.flows) {
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error(`Invalid flow reference: ${from} -> ${to}`);
    }
  }

  return true;
}

/**
 * Check phase alignment - ensure nodes are compatible
 */
export function checkPhaseAlignment(blueprint: Blueprint): boolean {
  // Phase alignment: connected nodes should have different roles
  for (const node of blueprint.nodes) {
    for (const connectedId of node.connections) {
      const connected = blueprint.nodes.find((n) => n.id === connectedId);
      if (connected && node.role === connected.role) {
        console.warn(
          `Phase misalignment: ${node.role} -> ${connected.role} (same role)`
        );
        // Not necessarily a failure, just a warning
      }
    }
  }

  return true;
}
