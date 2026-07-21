# Aletheia Agentic System

## Overview

The Agentic System is a self-evolving AI architecture integrated into Aletheia that enables:

- **Reverse-Solving**: Convert high-level goals into architectural blueprints
- **Multi-Branch Evolution**: Test multiple system designs in parallel sandboxes
- **Stability Scoring**: Evaluate systems using the Δ (delta) stability metric
- **Self-Modification**: Automatically improve and evolve the system
- **Security Hardening**: Safe code execution with intent filtering and memory sanitization

## Architecture

```
User Goal
   ↓
Intent Filter (Safety Check)
   ↓
Reverse Solver (Goal → Blueprint)
   ↓
Multi-Branch Evolution (Sandbox Testing)
   ├─ Sandbox 1: Blueprint A
   ├─ Sandbox 2: Blueprint B
   └─ Sandbox 3: Blueprint C
   ↓
Stability Scoring (Δ Evaluation)
   ↓
Decision Engine (Promote or Reject)
   ↓
Promoted Blueprint (New System State)
```

## Core Components

### 1. Security Layer (`server/agentic/security.ts`)

Provides safe code execution with multiple layers of protection:

- **Code Validation**: AST-based analysis to detect dangerous patterns
- **Intent Filtering**: Blocks requests attempting to access system resources
- **Memory Sanitization**: Removes sensitive data from logs
- **Safe Execution**: Isolated execution context with timeout protection

**Key Functions:**
- `validateCode(code)` - Validate code before execution
- `intentFilter(userInput)` - Check if intent is safe
- `sanitizeMemory(entry)` - Remove sensitive data
- `safeExec(code, inputData, timeout)` - Execute code safely
- `computeDelta(result)` - Calculate stability score

### 2. Reverse Solver (`server/agentic/reverse-solver.ts`)

Converts goals into architectural blueprints using the ELF framework:

**Key Concepts:**
- **Blueprint**: Graph structure with nodes (components) and flows (connections)
- **Node**: Represents a system component with role and description
- **Flow**: Directed connection between nodes

**Key Functions:**
- `generateBlueprint(input)` - Create blueprint from goal
- `generateBlueprintCandidates(input, count)` - Generate multiple candidates
- `validateBlueprint(blueprint)` - Verify blueprint structure
- `checkPhaseAlignment(blueprint)` - Ensure component compatibility

**Example Usage:**
```typescript
const solver = new ReverseSolver("ionos");
const blueprint = await solver.generateBlueprint({
  objective: "Create a data processing pipeline",
  constraints: { maxLatency: "2s", reliability: "99%" },
  branches: 3
});
```

### 3. Materializer (`server/agentic/materializer.ts`)

Converts blueprints into executable TypeScript code:

- Generates module for each node
- Creates main orchestrator
- Produces package.json and tsconfig.json
- Supports dependency injection

**Key Functions:**
- `build(blueprint, basePath)` - Generate project from blueprint
- Automatically creates proper module structure

### 4. Evolution Engine (`server/agentic/evolution.ts`)

Multi-branch sandbox evolution with stability scoring:

**Features:**
- Parallel blueprint execution
- Isolated sandbox environments
- Δ (delta) stability scoring
- Automatic promotion of best candidates
- Rollback support

**Key Classes:**
- `Evolution` - Single evolution run
- `MultibranchEvolutionCoordinator` - Multi-iteration evolution

**Stability Scoring (Δ):**
- Ideal range: 0.02 - 0.04
- Calculated from execution success and error metrics
- Closer to 0.03 is optimal

### 5. Agent Loop (`server/agentic/agent-loop.ts`)

Main orchestration of the entire agentic system:

**Execution Flow:**
1. Intent Filtering (Safety check)
2. Reverse Solving (Goal → Blueprints)
3. Multi-Branch Evolution (Test candidates)
4. Decision Engine (Promote or reject)
5. Memory Recording (Non-destructive logging)

**Key Functions:**
- `execute(goal)` - Run complete agent cycle
- `selfOptimize(results)` - Learn from execution patterns
- `getMemory()` - Access execution history
- `clearMemory()` - Reset memory

## API Integration

### tRPC Endpoints (`server/agentic-router.ts`)

#### Execute Goal
```typescript
// Execute a single agent goal
agentic.executeGoal({
  objective: "Create a data processing system",
  constraints: { maxLatency: "2s" },
  branches: 3,
  maxIterations: 2
})
```

**Response:**
```typescript
{
  success: boolean,
  blueprint: { id, goal, nodeCount, flowCount },
  evolutionStatus: "converged" | "partial" | "rejected",
  bestDelta: number,
  reasoning: string,
  executionTime: number
}
```

#### Get Memory
```typescript
agentic.getMemory()
```

Returns agent execution history and decision logs.

#### Get Status
```typescript
agentic.getStatus()
```

Returns agent capabilities and version.

#### Batch Execute
```typescript
agentic.executeBatch({
  goals: [
    { objective: "..." },
    { objective: "..." }
  ],
  branches: 3
})
```

## Usage Examples

### Basic Goal Execution

```typescript
import { runAgent } from "@/server/agentic";

const result = await runAgent({
  objective: "Build a REST API for user management",
  constraints: {
    framework: "Express",
    database: "MySQL",
    authentication: "JWT"
  }
});

if (result.success) {
  console.log("Blueprint generated:", result.blueprint);
  console.log("Stability:", result.evolutionResult?.bestDelta);
}
```

### Batch Processing

```typescript
import { runAgentBatch } from "@/server/agentic";

const results = await runAgentBatch([
  { objective: "Create authentication module" },
  { objective: "Create payment processing module" },
  { objective: "Create notification system" }
]);

console.log(`Success rate: ${results.filter(r => r.success).length}/${results.length}`);
```

### Direct API Usage

```typescript
// From client-side
const response = await trpc.agentic.executeGoal.mutate({
  objective: "Add real-time collaboration features",
  branches: 5,
  maxIterations: 3
});
```

## Safety & Security

### Intent Filtering

Blocks requests attempting to:
- Read/write files
- Access system resources
- Leak environment variables
- Execute system commands

### Code Validation

Prevents:
- Dangerous imports (os, sys, subprocess, etc.)
- Unsafe function calls (eval, exec, Function)
- Direct process/global access

### Memory Sanitization

Automatically removes:
- API keys and tokens
- Passwords and secrets
- Authentication credentials
- Private keys

## Performance Characteristics

### Stability Scoring (Δ)

| Delta Range | Status | Meaning |
|-------------|--------|---------|
| 0.02 - 0.04 | Optimal | System converged |
| 0.04 - 0.1 | Acceptable | Minor issues |
| 0.1 - 0.5 | Degraded | Significant issues |
| > 0.5 | Failed | System unstable |

### Execution Timeline

- Reverse Solving: ~2-5 seconds
- Blueprint Generation: ~1-3 seconds per candidate
- Evolution (3 branches): ~10-30 seconds
- Decision Making: ~1 second
- **Total**: ~15-40 seconds per goal

## Configuration

### Environment Variables

```bash
# LLM Model Selection
AGENTIC_MODEL=ionos  # or "gemini"

# Evolution Parameters
EVOLUTION_TIMEOUT=10000  # milliseconds
EVOLUTION_MAX_ITERATIONS=2
EVOLUTION_BRANCHES=3

# Sandbox Configuration
SANDBOX_BASE_PATH=/tmp/aletheia-sandboxes
SANDBOX_CLEANUP=true  # Auto-cleanup after execution
```

### Constraints Format

```typescript
{
  // Performance
  maxLatency: "2s",
  maxMemory: "512MB",
  
  // Reliability
  reliability: "99.9%",
  errorRate: "< 0.1%",
  
  // Architecture
  framework: "Express",
  database: "MySQL",
  authentication: "JWT",
  
  // Custom constraints
  [key: string]: any
}
```

## Extending the System

### Adding Custom Node Types

1. Create new node role in blueprint
2. Implement in materializer template
3. Add validation in reverse solver

### Custom Stability Metrics

Modify `computeDelta()` in security.ts to use custom metrics.

### Integration with Other Systems

The agent loop can be extended to:
- Deploy generated code automatically
- Integrate with version control
- Trigger CI/CD pipelines
- Update live systems

## Troubleshooting

### Blueprint Generation Fails

**Cause**: LLM API error or invalid constraints

**Solution**: 
- Check API keys are configured
- Simplify constraints
- Increase timeout

### Evolution Doesn't Converge

**Cause**: Blueprints too complex or constraints conflicting

**Solution**:
- Reduce blueprint complexity
- Review constraints for conflicts
- Increase maxIterations

### Memory Grows Unbounded

**Cause**: Memory not being cleared

**Solution**:
```typescript
agent.clearMemory();
```

## Future Enhancements

- [ ] Real-time blueprint visualization
- [ ] Distributed evolution across multiple machines
- [ ] Self-improving node logic
- [ ] Automatic deployment integration
- [ ] Advanced constraint satisfaction
- [ ] Multi-objective optimization

## References

- ELF Framework: Entropic-Lagrangian Framework for system reasoning
- Δ (Delta): Stability metric between 0 and 1
- Blueprint: Directed acyclic graph of system components
- Reverse Solver: Goal-to-architecture conversion using LLM reasoning

## License

MIT
