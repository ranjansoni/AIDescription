/**
 * AI Description Generator Type Definitions
 * 
 * @fileoverview TypeScript interfaces and types for the AI-powered
 * listing description generation system.
 * 
 * @description Defines the contract for:
 * - API request/response payloads
 * - MongoDB document structures
 * - Service layer interfaces
 * - Configuration types
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { ObjectId } from 'mongodb';

// =============================================================================
// API Types
// =============================================================================

/**
 * Mode of description generation
 * - 'upload': Generated during product upload flow
 * - 'on_demand': Generated when user clicks "generate" button
 */
export type GenerationMode = 'upload' | 'on_demand';

/**
 * Request payload for POST /api/listings/generate-description
 */
export interface GenerateDescriptionRequest {
  /** Product title (required, min 3 characters after trimming) */
  title: string;
  
  /** Category name provided by client */
  category: string;
  
  /** Optional MongoDB ObjectId string to update existing listing */
  listingId?: string;
  
  /** Context of when generation is triggered */
  mode: GenerationMode;
}

/**
 * Response payload for POST /api/listings/generate-description
 */
export interface GenerateDescriptionResponse {
  /** Generated short description (240-360 characters target) */
  short_description: string;
  
  /** Echo of input category */
  category: string;
  
  /** Confidence score 0.0-1.0 based on title clarity */
  confidence: number;
  
  /** Whether result was served from cache */
  cached: boolean;
  
  /** OpenAI model used for generation */
  model: string;
  
  /** Cache key used for deduplication */
  cacheKey: string;
}

/**
 * Error response structure
 */
export interface GenerateDescriptionError {
  /** Error message */
  error: string;
  
  /** HTTP status code */
  status: number;
  
  /** Error code for client-side handling */
  code?: string;
  
  /** Additional error details (development only) */
  details?: string;
}

// =============================================================================
// MongoDB Document Types
// =============================================================================

/**
 * AI metadata stored on listing documents
 */
export interface ListingAiMetadata {
  /** Generated short description */
  short_description: string;
  
  /** Confidence score of generation */
  confidence: number;
  
  /** Timestamp of generation */
  generatedAt: Date;
  
  /** OpenAI model used */
  model: string;
  
  /** Cache key for reference */
  cacheKey: string;
}

/**
 * Listing document structure (subset relevant to AI generation)
 */
export interface ListingDocument {
  _id: ObjectId;
  
  /** Product title */
  title: string;
  
  /** Category information */
  category: Array<{ id: string; name: string }> | string;
  
  /** Short description field */
  short_description?: string;
  
  /** AI generation metadata */
  ai?: ListingAiMetadata;
  
  /** Product description */
  description?: string;
  
  /** Creation timestamp */
  createdAt?: Date;
  
  /** Update timestamp */
  updatedAt?: Date;
}

/**
 * Cached AI description document structure
 * Stored in 'ai_descriptions' collection
 */
export interface AiDescriptionCacheDocument {
  _id?: ObjectId;
  
  /** Deterministic cache key: ${category}::${normalizedTitle} */
  cacheKey: string;
  
  /** Normalized title (trimmed, lowercase, collapsed whitespace) */
  normalizedTitle: string;
  
  /** Original category */
  category: string;
  
  /** Generated short description */
  short_description: string;
  
  /** Confidence score 0.0-1.0 */
  confidence: number;
  
  /** OpenAI model used */
  model: string;
  
  /** Generation timestamp */
  generatedAt: Date;
  
  /** TTL expiration date (30 days from generation) */
  expiresAt: Date;
  
  /** Number of times this cached result was used */
  hitCount: number;
  
  /** IDs of listings that used this cached description */
  usedByListings: ObjectId[];
}

// =============================================================================
// Rating Types
// =============================================================================

/**
 * Rating value from 1-5
 */
export type RatingValue = 1 | 2 | 3 | 4 | 5;

/**
 * Rating document for tracking description quality
 */
export interface DescriptionRatingDocument {
  _id?: ObjectId;
  
  /** Reference to cache entry */
  cacheKey: string;
  
  /** Rating value 1-5 */
  rating: RatingValue;
  
  /** Optional feedback text */
  feedback?: string;
  
  /** Original title for context */
  title: string;
  
  /** Original category */
  category: string;
  
  /** Generated description that was rated */
  short_description: string;
  
  /** Timestamp of rating */
  ratedAt: Date;
  
  /** Session ID for analytics (optional) */
  sessionId?: string;
}

// =============================================================================
// Service Layer Types
// =============================================================================

/**
 * Result from description generation service
 */
export interface GenerationResult {
  /** Generated description */
  short_description: string;
  
  /** Confidence score */
  confidence: number;
  
  /** Whether served from cache */
  cached: boolean;
  
  /** Model used */
  model: string;
  
  /** Cache key */
  cacheKey: string;
  
  /** Source of generation */
  source: 'cache' | 'openai' | 'fallback';
}

/**
 * OpenAI structured output schema response
 */
export interface OpenAiStructuredResponse {
  /** Generated description */
  short_description: string;
  
  /** Echo of category */
  category: string;
  
  /** Confidence score */
  confidence: number;
}

/**
 * Configuration for the description generator
 */
export interface GeneratorConfig {
  /** OpenAI model to use */
  model: string;
  
  /** Maximum tokens for response */
  maxTokens: number;
  
  /** Temperature for generation (0.0-1.0) */
  temperature: number;
  
  /** Cache TTL in days */
  cacheTtlDays: number;
  
  /** Minimum title length */
  minTitleLength: number;
  
  /** Target description length */
  targetDescriptionLength: number;
  
  /** Maximum description length */
  maxDescriptionLength: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Normalized title result
 */
export interface NormalizedTitle {
  /** Original input */
  original: string;
  
  /** Normalized form (trimmed, lowercase, collapsed whitespace) */
  normalized: string;
  
  /** Whether title is valid (length >= 3) */
  isValid: boolean;
}

/**
 * Cache key components
 */
export interface CacheKeyComponents {
  /** Category portion */
  category: string;
  
  /** Normalized title portion */
  normalizedTitle: string;
  
  /** Full cache key */
  cacheKey: string;
}

