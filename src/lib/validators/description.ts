/**
 * Zod Validation Schemas for AI Description Generator
 * 
 * @fileoverview Defines request/response validation schemas using Zod
 * with detailed error messages and type inference.
 * 
 * @description Provides:
 * - Request validation with sanitization
 * - Response structure validation
 * - Reusable field validators
 * - Type inference from schemas
 * 
 * @example
 * ```typescript
 * import { generateDescriptionRequestSchema, validateRequest } from '@/lib/validators/description';
 * 
 * const result = generateDescriptionRequestSchema.safeParse(requestBody);
 * if (!result.success) {
 *   return { error: result.error.issues };
 * }
 * const validatedData = result.data;
 * ```
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { z } from 'zod';

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum title length after trimming
 */
export const MIN_TITLE_LENGTH = 3;

/**
 * Maximum title length
 */
export const MAX_TITLE_LENGTH = 500;

/**
 * Maximum category length
 */
export const MAX_CATEGORY_LENGTH = 100;

/**
 * Target description length (SEO optimized for Google/Gemini)
 */
export const TARGET_DESCRIPTION_LENGTH = 200;

/**
 * Maximum description length (SEO meta description best practice)
 */
export const MAX_DESCRIPTION_LENGTH = 280;

/**
 * Minimum description length
 */
export const MIN_DESCRIPTION_LENGTH = 120;

/**
 * MongoDB ObjectId regex pattern
 */
export const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

// =============================================================================
// Field Validators
// =============================================================================

/**
 * Title field validator
 * - Transforms: trims whitespace, collapses multiple spaces
 * - Validates: minimum length after trimming
 */
export const titleSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, ' '))
  .pipe(
    z.string()
      .min(MIN_TITLE_LENGTH, {
        message: `Title must be at least ${MIN_TITLE_LENGTH} characters after trimming`,
      })
      .max(MAX_TITLE_LENGTH, {
        message: `Title must not exceed ${MAX_TITLE_LENGTH} characters`,
      })
  );

/**
 * Category field validator
 */
export const categorySchema = z
  .string()
  .trim()
  .min(1, { message: 'Category is required' })
  .max(MAX_CATEGORY_LENGTH, {
    message: `Category must not exceed ${MAX_CATEGORY_LENGTH} characters`,
  });

/**
 * Optional MongoDB ObjectId validator
 */
export const listingIdSchema = z
  .string()
  .regex(OBJECT_ID_PATTERN, {
    message: 'listingId must be a valid MongoDB ObjectId (24 hex characters)',
  })
  .optional();

/**
 * Generation mode validator
 */
export const modeSchema = z.enum(['upload', 'on_demand'], {
  errorMap: () => ({
    message: "mode must be either 'upload' or 'on_demand'",
  }),
});

/**
 * Confidence score validator (0.0 to 1.0)
 */
export const confidenceSchema = z
  .number()
  .min(0, { message: 'Confidence must be at least 0' })
  .max(1, { message: 'Confidence must not exceed 1' });

/**
 * Short description validator
 */
export const shortDescriptionSchema = z
  .string()
  .min(1, { message: 'Description cannot be empty' })
  .max(MAX_DESCRIPTION_LENGTH, {
    message: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`,
  });

// =============================================================================
// Request Schemas
// =============================================================================

/**
 * Optional user description validator
 */
export const userDescriptionSchema = z
  .string()
  .max(1000, { message: 'Description must not exceed 1000 characters' })
  .optional();

/**
 * Unit of measurement validator
 */
export const unitOfMeasurementSchema = z
  .string()
  .max(50, { message: 'Unit must not exceed 50 characters' })
  .optional();

/**
 * Request schema for POST /api/listings/generate-description
 * 
 * @example
 * ```typescript
 * const result = generateDescriptionRequestSchema.safeParse({
 *   title: "pizza boxes",
 *   category: "Packaging",
 *   mode: "upload",
 *   unitOfMeasurement: "case",
 *   userDescription: "12x12 corrugated pizza boxes"
 * });
 * ```
 */
export const generateDescriptionRequestSchema = z.object({
  title: titleSchema,
  category: categorySchema,
  listingId: listingIdSchema,
  mode: modeSchema,
  userDescription: userDescriptionSchema,
  unitOfMeasurement: unitOfMeasurementSchema,
});

/**
 * Inferred type from request schema
 */
export type GenerateDescriptionRequestPayload = z.infer<
  typeof generateDescriptionRequestSchema
>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Response schema for successful generation
 */
export const generateDescriptionResponseSchema = z.object({
  short_description: shortDescriptionSchema,
  category: z.string(),
  confidence: confidenceSchema,
  cached: z.boolean(),
  model: z.string(),
  cacheKey: z.string(),
});

/**
 * Inferred type from response schema
 */
export type GenerateDescriptionResponsePayload = z.infer<
  typeof generateDescriptionResponseSchema
>;

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
  code: z.string().optional(),
  details: z.string().optional(),
});

/**
 * Inferred error type
 */
export type ErrorResponsePayload = z.infer<typeof errorResponseSchema>;

// =============================================================================
// OpenAI Structured Output Schema
// =============================================================================

/**
 * Schema for OpenAI structured JSON output
 * This is used in the JSON mode response from OpenAI
 */
export const openAiOutputSchema = z.object({
  short_description: z.string(),
  category: z.string(),
  confidence: z.number(),
});

/**
 * Inferred type from OpenAI output schema
 */
export type OpenAiOutputPayload = z.infer<typeof openAiOutputSchema>;

// =============================================================================
// Rating Schema
// =============================================================================

/**
 * Rating request schema for quality feedback
 */
export const ratingRequestSchema = z.object({
  cacheKey: z.string().min(1, { message: 'cacheKey is required' }),
  rating: z.number().int().min(1).max(5, {
    message: 'Rating must be between 1 and 5',
  }),
  feedback: z.string().max(1000).optional(),
  title: z.string(),
  category: z.string(),
  short_description: z.string(),
  sessionId: z.string().optional(),
});

/**
 * Inferred type from rating schema
 */
export type RatingRequestPayload = z.infer<typeof ratingRequestSchema>;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validate request body and return typed result
 * 
 * @param body - Request body to validate
 * @returns Parsed and validated request data
 * @throws Zod validation errors
 * 
 * @example
 * ```typescript
 * try {
 *   const validated = validateGenerateRequest(req.body);
 *   // validated is properly typed
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     return Response.json({ error: error.issues }, { status: 400 });
 *   }
 * }
 * ```
 */
export function validateGenerateRequest(
  body: unknown
): GenerateDescriptionRequestPayload {
  return generateDescriptionRequestSchema.parse(body);
}

/**
 * Safely validate request and return result object
 * 
 * @param body - Request body to validate
 * @returns Safe parse result with success flag and data/error
 * 
 * @example
 * ```typescript
 * const result = safeValidateGenerateRequest(req.body);
 * if (!result.success) {
 *   return Response.json({ 
 *     error: 'Validation failed', 
 *     details: result.error.issues 
 *   }, { status: 400 });
 * }
 * const data = result.data;
 * ```
 */
export function safeValidateGenerateRequest(body: unknown): z.SafeParseReturnType<
  unknown,
  GenerateDescriptionRequestPayload
> {
  return generateDescriptionRequestSchema.safeParse(body);
}

/**
 * Validate OpenAI response structure
 * 
 * @param response - Parsed JSON from OpenAI
 * @returns Validated and typed response
 */
export function validateOpenAiResponse(response: unknown): OpenAiOutputPayload {
  return openAiOutputSchema.parse(response);
}

/**
 * Format Zod errors for API response
 * 
 * @param error - Zod error object
 * @returns Formatted error messages
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

