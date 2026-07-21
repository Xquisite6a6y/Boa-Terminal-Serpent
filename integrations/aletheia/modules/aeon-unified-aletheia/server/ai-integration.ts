import { invokeLLM } from "./_core/llm";

/**
 * ELF Framework System Prompts
 * Entropic-Lagrangian Framework for advanced reasoning and philosophical depth
 */
export const ELF_SYSTEM_PROMPT = `You are Aletheia, an advanced AI assistant powered by the Entropic-Lagrangian Framework (ELF).

The ELF framework guides your reasoning through:
- **Entropic Dynamics**: Understanding systems through their tendency toward equilibrium and disorder
- **Lagrangian Optimization**: Finding optimal paths through complex problem spaces
- **Multi-dimensional Analysis**: Examining issues from multiple perspectives simultaneously
- **Philosophical Depth**: Grounding technical solutions in deeper truths about reality and knowledge

Your approach:
1. Analyze problems through both entropic (what tends to happen naturally) and optimized (what's the best path) lenses
2. Consider multiple dimensions: technical, philosophical, practical, and ethical
3. Provide reasoning that's both rigorous and accessible
4. When uncertain, acknowledge the limits of knowledge and explore possibilities
5. Connect specific problems to broader patterns and principles

You combine cutting-edge AI capabilities with philosophical rigor to provide insights that are both powerful and meaningful.`;

/**
 * Prediction engine prompts for forecasting and analysis
 */
export const PREDICTION_SYSTEM_PROMPT = `You are a prediction and forecasting specialist using the Reverse Solver system.

You analyze:
- Historical patterns and anomalies
- Cascade dynamics and compression effects
- Temporal relationships and causality
- Risk factors and early warning signals
- Prediction confidence and uncertainty bounds

When making predictions, you:
1. Identify key variables and their relationships
2. Analyze historical precedents
3. Assess cascade compression ratios
4. Provide confidence intervals
5. Highlight key uncertainty factors
6. Suggest monitoring points for early detection`;

/**
 * Call IONOS AI Hub custom model with streaming
 */
export async function callIONOSModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
) {
  const systemPrompt = options?.systemPrompt || ELF_SYSTEM_PROMPT;
  
  const fullMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  try {
    const response = await invokeLLM({
      messages: fullMessages,
    });

    return {
      success: true,
      content: response.choices?.[0]?.message?.content || "",
      model: "ionos" as const,
      tokensUsed: response.usage?.total_tokens,
    };
  } catch (error) {
    console.error("[IONOS] Error calling model:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      model: "ionos" as const,
    };
  }
}

/**
 * Call Google Gemini API with streaming
 */
export async function callGeminiModel(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
) {
  const systemPrompt = options?.systemPrompt || ELF_SYSTEM_PROMPT;
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Gemini API key not configured",
      model: "gemini" as const,
    };
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: messages.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 2000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      success: true,
      content,
      model: "gemini" as const,
      tokensUsed: data.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error("[Gemini] Error calling model:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      model: "gemini" as const,
    };
  }
}

/**
 * Smart model selector - chooses best model based on context
 */
export async function selectBestModel(
  userMessage: string,
  preferredModel: "ionos" | "gemini" = "ionos"
): Promise<"ionos" | "gemini"> {
  // For now, respect user preference
  // In future, could analyze message to determine best model
  return preferredModel;
}

/**
 * Unified chat interface that handles both models
 */
export async function chat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  model: "ionos" | "gemini" = "ionos",
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    usePredictionMode?: boolean;
  }
) {
  const systemPrompt = options?.usePredictionMode
    ? PREDICTION_SYSTEM_PROMPT
    : options?.systemPrompt || ELF_SYSTEM_PROMPT;

  if (model === "gemini") {
    return callGeminiModel(messages, {
      ...options,
      systemPrompt,
    });
  } else {
    // Convert messages for IONOS format
    const ionosMessages = messages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    return callIONOSModel(ionosMessages, {
      ...options,
      systemPrompt,
    });
  }
}
