/**
 * Agentic System - Self-evolving agent with reverse-solving and sandbox evolution
 * 
 * This module provides:
 * - Security layer for safe code execution
 * - Reverse solver for goal-to-blueprint conversion
 * - Materializer for blueprint-to-code generation
 * - Evolution engine for multi-branch sandbox testing
 * - Agent loop for orchestration
 */

export * from "./security";
export * from "./reverse-solver";
export * from "./materializer";
export * from "./evolution";
export * from "./agent-loop";

// Convenience exports
export { ReverseSolver, type Blueprint, type Node } from "./reverse-solver";
export { Materializer } from "./materializer";
export { Evolution, MultibranchEvolutionCoordinator } from "./evolution";
export { AgentLoop, runAgent, runAgentBatch, type AgentGoal, type AgentExecutionResult } from "./agent-loop";
