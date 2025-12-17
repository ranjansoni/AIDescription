/**
 * AI Description Generation API Route
 * 
 * @route POST /api/listings/generate-description
 * 
 * @fileoverview Next.js App Router API endpoint for generating
 * AI-powered product descriptions using OpenAI.
 * 
 * @description Handles:
 * - Request validation with Zod
 * - Cache-first description retrieval
 * - OpenAI generation with fallback
 * - Optional listing document updates
 * - Structured JSON responses
 * 
 * @security
 * - Input validation and sanitization
 * - No raw input logging in production
 * - Secrets read from environment only
 * 
 * @example
 * ```typescript
 * // Request
 * POST /api/listings/generate-description
 * {
 *   "title": "pizza boxes",
 *   "category": "Packaging",
 *   "mode": "upload"
 * }
 * 
 * // Response
 * {
 *   "short_description": "Pizza boxes for foodservice...",
 *   "category": "Packaging",
 *   "confidence": 0.72,
 *   "cached": false,
 *   "model": "gpt-4o",
 *   "cacheKey": "Packaging::pizza boxes"
 * }
 * ```
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  safeValidateGenerateRequest,
  formatZodErrors,
  MIN_TITLE_LENGTH,
} from '@/lib/validators/description';
import { generateDescription } from '@/lib/ai/description-generator';
import type {
  GenerateDescriptionResponse,
  GenerateDescriptionError,
} from '@/types/ai-description';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Disable static generation for this route
 * Ensure it always runs as a serverless function
 */
export const dynamic = 'force-dynamic';

/**
 * Set reasonable timeout (30 seconds for OpenAI calls)
 */
export const maxDuration = 30;

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/listings/generate-description
 * 
 * Generate an AI-powered short description for a product listing.
 * 
 * @param request - Next.js request object
 * @returns JSON response with description or error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateDescriptionResponse | GenerateDescriptionError>> {
  const startTime = Date.now();

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON in request body', 400, 'INVALID_JSON');
    }

    // Validate request
    const validationResult = safeValidateGenerateRequest(body);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);
      return createErrorResponse(
        `Validation failed: ${errors.join('; ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    const { title, category, listingId, mode, userDescription, unitOfMeasurement, customPrompt } = validationResult.data;

    // Additional validation: title length after normalization
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      return createErrorResponse(
        `Title must be at least ${MIN_TITLE_LENGTH} characters after trimming`,
        400,
        'TITLE_TOO_SHORT'
      );
    }

    // Log request in development (not production to protect inputs)
    if (process.env.NODE_ENV === 'development') {
      console.log('[API:generate-description] Request:', {
        titleLength: title.length,
        category,
        mode,
        hasListingId: Boolean(listingId),
        hasUserDescription: Boolean(userDescription),
        unitOfMeasurement,
        hasCustomPrompt: Boolean(customPrompt),
      });
    }

    // Generate description with optional fields
    const result = await generateDescription(title, category, listingId, mode, {
      description: userDescription,
      unitOfMeasurement,
      customPrompt,
    });

    // Build response
    const response: GenerateDescriptionResponse = {
      short_description: result.short_description,
      category,
      confidence: Math.round(result.confidence * 100) / 100, // Round to 2 decimals
      cached: result.cached,
      model: result.model,
      cacheKey: result.cacheKey,
    };

    // Log timing in development
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - startTime;
      console.log(`[API:generate-description] Response in ${duration}ms:`, {
        cached: result.cached,
        confidence: response.confidence,
        source: result.source,
      });
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Generation-Source': result.source,
        'X-Generation-Time-Ms': String(Date.now() - startTime),
      },
    });
  } catch (error) {
    // Log full error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[API:generate-description] Error:', error);
    } else {
      // Log minimal info in production
      console.error(
        '[API:generate-description] Error:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Determine if this is a known error type
    if (error instanceof Error) {
      // Listing not found
      if (error.message.includes('listing')) {
        return createErrorResponse(
          'Failed to update listing',
          500,
          'LISTING_UPDATE_FAILED',
          process.env.NODE_ENV === 'development' ? error.message : undefined
        );
      }

      // Database connection issues
      if (error.message.includes('MongoDB') || error.message.includes('connect')) {
        return createErrorResponse(
          'Database connection error',
          503,
          'DATABASE_ERROR'
        );
      }
    }

    // Generic error
    return createErrorResponse(
      'An unexpected error occurred while generating description',
      500,
      'INTERNAL_ERROR'
    );
  }
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * GET /api/listings/generate-description
 * 
 * Health check endpoint to verify the API is available.
 * 
 * @returns JSON with service status
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      service: 'ai-description-generator',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    },
    { status: 200 }
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a standardized error response
 * 
 * @param message - Error message
 * @param status - HTTP status code
 * @param code - Error code for client handling
 * @param details - Additional details (development only)
 * @returns NextResponse with error payload
 */
function createErrorResponse(
  message: string,
  status: number,
  code: string,
  details?: string
): NextResponse<GenerateDescriptionError> {
  const response: GenerateDescriptionError = {
    error: message,
    status,
    code,
  };

  // Only include details in development
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

