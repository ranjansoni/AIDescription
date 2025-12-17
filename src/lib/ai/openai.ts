/**
 * OpenAI Client Wrapper for AI Description Generation
 * 
 * @fileoverview Provides a configured OpenAI client with structured output
 * support, error handling, and retry logic for description generation.
 * 
 * @description This module wraps the OpenAI SDK with:
 * - Environment-based configuration
 * - Structured JSON output enforcement
 * - Automatic retry with exponential backoff
 * - Token usage tracking
 * - Safe error handling
 * 
 * @example
 * ```typescript
 * import { generateStructuredDescription } from '@/lib/ai/openai';
 * 
 * const result = await generateStructuredDescription(
 *   systemPrompt,
 *   userMessage,
 *   { title: 'pizza boxes', category: 'Packaging' }
 * );
 * ```
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import OpenAI from 'openai';
import type { OpenAiStructuredResponse } from '@/types/ai-description';
import { validateOpenAiResponse } from '@/lib/validators/description';

// =============================================================================
// Configuration
// =============================================================================

/**
 * OpenAI API key from environment
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Default model for description generation
 * Using gpt-4o for high quality outputs
 */
export const DEFAULT_MODEL = 'gpt-4o';

/**
 * Fallback model if primary is unavailable
 */
export const FALLBACK_MODEL = 'gpt-4o-mini';

/**
 * Maximum tokens for response
 */
export const MAX_TOKENS = 500;

/**
 * Temperature for generation (lower = more deterministic)
 */
export const TEMPERATURE = 0.3;

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY = 1000;

// =============================================================================
// Client Initialization
// =============================================================================

/**
 * Cached OpenAI client instance
 */
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 * 
 * @throws {Error} When OPENAI_API_KEY is not configured
 * @returns {OpenAI} Configured OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not defined. ' +
      'Please add it to your .env.local file.'
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 0, // We handle retries ourselves
    });
  }

  return openaiClient;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for structured description generation
 */
export interface GenerationOptions {
  /** Model to use (defaults to gpt-4o) */
  model?: string;
  
  /** Temperature 0.0-1.0 */
  temperature?: number;
  
  /** Maximum tokens */
  maxTokens?: number;
  
  /** Request identifier for logging */
  requestId?: string;
}

/**
 * Result from OpenAI generation
 */
export interface OpenAIGenerationResult {
  /** Parsed structured response */
  response: OpenAiStructuredResponse;
  
  /** Model actually used */
  model: string;
  
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** Generation duration in ms */
  durationMs: number;
}

/**
 * Generation error with context
 */
export class OpenAIGenerationError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    retryable: boolean,
    originalError?: Error
  ) {
    super(message);
    this.name = 'OpenAIGenerationError';
    this.code = code;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}

// =============================================================================
// JSON Schema for Structured Output
// =============================================================================

/**
 * JSON schema for OpenAI structured output
 * Enforces the exact response format we need
 */
const DESCRIPTION_JSON_SCHEMA = {
  name: 'listing_description',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      short_description: {
        type: 'string',
        description: 'Generated description, 240-360 characters',
      },
      category: {
        type: 'string',
        description: 'Echo of input category',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0.0-1.0',
      },
    },
    required: ['short_description', 'category', 'confidence'],
    additionalProperties: false,
  },
} as const;

// =============================================================================
// Main Generation Function
// =============================================================================

/**
 * Generate a structured description using OpenAI
 * 
 * @param systemPrompt - System message with rules
 * @param userMessage - User message with title/category
 * @param options - Generation options
 * @returns Structured response with usage stats
 * @throws {OpenAIGenerationError} On generation failure
 * 
 * @example
 * ```typescript
 * const result = await generateStructuredDescription(
 *   SYSTEM_PROMPT,
 *   `Title: pizza boxes\nCategory: Packaging`,
 *   { model: 'gpt-4o' }
 * );
 * console.log(result.response.short_description);
 * ```
 */
export async function generateStructuredDescription(
  systemPrompt: string,
  userMessage: string,
  options: GenerationOptions = {}
): Promise<OpenAIGenerationResult> {
  const {
    model = DEFAULT_MODEL,
    temperature = TEMPERATURE,
    maxTokens = MAX_TOKENS,
    requestId = generateRequestId(),
  } = options;

  const client = getOpenAIClient();
  const startTime = Date.now();

  // Log in development (not production to avoid exposing inputs)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[OpenAI:${requestId}] Starting generation with model: ${model}`);
  }

  let lastError: Error | undefined;
  let currentModel = model;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: DESCRIPTION_JSON_SCHEMA,
        },
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new OpenAIGenerationError(
          'OpenAI returned empty response',
          'EMPTY_RESPONSE',
          true
        );
      }

      // Parse and validate the JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        throw new OpenAIGenerationError(
          'Failed to parse OpenAI JSON response',
          'PARSE_ERROR',
          true,
          parseError instanceof Error ? parseError : undefined
        );
      }

      // Validate against our schema
      const validated = validateOpenAiResponse(parsed);

      const durationMs = Date.now() - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.log(`[OpenAI:${requestId}] Generation completed in ${durationMs}ms`);
        console.log(`[OpenAI:${requestId}] Confidence: ${validated.confidence}`);
      }

      return {
        response: validated,
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
        durationMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const { retryable, shouldFallback } = classifyError(error);

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[OpenAI:${requestId}] Attempt ${attempt}/${MAX_RETRIES} failed:`,
          lastError.message
        );
      }

      // If we should try fallback model
      if (shouldFallback && currentModel !== FALLBACK_MODEL) {
        console.log(`[OpenAI:${requestId}] Switching to fallback model: ${FALLBACK_MODEL}`);
        currentModel = FALLBACK_MODEL;
        continue;
      }

      // If not retryable or last attempt, throw
      if (!retryable || attempt === MAX_RETRIES) {
        throw new OpenAIGenerationError(
          `OpenAI generation failed after ${attempt} attempts: ${lastError.message}`,
          'GENERATION_FAILED',
          false,
          lastError
        );
      }

      // Exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw new OpenAIGenerationError(
    'Generation failed unexpectedly',
    'UNEXPECTED_ERROR',
    false,
    lastError
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Classify an error to determine retry strategy
 */
function classifyError(error: unknown): {
  retryable: boolean;
  shouldFallback: boolean;
} {
  if (error instanceof OpenAI.APIError) {
    // Rate limit - retry with backoff
    if (error.status === 429) {
      return { retryable: true, shouldFallback: false };
    }

    // Server errors - retry
    if (error.status && error.status >= 500) {
      return { retryable: true, shouldFallback: false };
    }

    // Model not available - try fallback
    if (error.status === 404 || error.code === 'model_not_found') {
      return { retryable: true, shouldFallback: true };
    }

    // Auth errors - don't retry
    if (error.status === 401 || error.status === 403) {
      return { retryable: false, shouldFallback: false };
    }
  }

  // Network errors - retry
  if (error instanceof Error && error.message.includes('network')) {
    return { retryable: true, shouldFallback: false };
  }

  // Default: retry once
  return { retryable: true, shouldFallback: false };
}

/**
 * Generate a unique request ID for logging
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if OpenAI is configured and available
 * 
 * @returns True if OpenAI API key is configured
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(OPENAI_API_KEY);
}

/**
 * Test OpenAI connectivity
 * 
 * @returns True if OpenAI API is reachable
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}

