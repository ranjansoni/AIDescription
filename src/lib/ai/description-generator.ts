/**
 * AI Description Generator Service
 * 
 * @fileoverview Core service for generating, caching, and storing
 * AI-powered product descriptions for the 86 Deadstock marketplace.
 * 
 * @description This service orchestrates:
 * - Cache lookup and storage (MongoDB ai_descriptions collection)
 * - OpenAI generation with fallback handling
 * - Listing document updates
 * - Deduplication via deterministic cache keys
 * 
 * @flow
 * 1. Validate and normalize input
 * 2. Generate cache key
 * 3. Check cache for existing description
 * 4. If cached: return (optionally update listing)
 * 5. If not cached: generate via OpenAI
 * 6. On OpenAI failure: use fallback template
 * 7. Store in cache with TTL
 * 8. If listingId provided: update listing document
 * 9. Return result
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db/mongo';
import {
  generateStructuredDescription,
  OpenAIGenerationError,
  isOpenAIConfigured,
  DEFAULT_MODEL,
} from '@/lib/ai/openai';
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  generateFallbackDescription,
  normalizeTitle,
  generateCacheKey,
  adjustConfidence,
} from '@/lib/ai/prompts';
import type {
  GenerationResult,
  AiDescriptionCacheDocument,
  ListingDocument,
  ListingAiMetadata,
  GenerationMode,
} from '@/types/ai-description';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Cache TTL in days
 */
const CACHE_TTL_DAYS = 30;

/**
 * Collection names
 */
const COLLECTIONS = {
  AI_DESCRIPTIONS: 'ai_descriptions',
  LISTINGS: 'products', // Using 'products' to match existing schema
} as const;

// =============================================================================
// Main Generation Function
// =============================================================================

/**
 * Generate a description for a listing
 * 
 * This is the main entry point for the description generator.
 * It handles caching, OpenAI generation, and optional listing updates.
 * 
 * @param title - Product title (will be normalized)
 * @param category - Product category
 * @param listingId - Optional listing ID to update
 * @param mode - Generation context ('upload' or 'on_demand')
 * @returns Generation result with description and metadata
 * 
 * @example
 * ```typescript
 * // Generate without updating listing
 * const result = await generateDescription('pizza boxes', 'Packaging');
 * 
 * // Generate and update listing
 * const result = await generateDescription(
 *   'pizza boxes',
 *   'Packaging',
 *   '507f1f77bcf86cd799439011',
 *   'upload'
 * );
 * ```
 */
export async function generateDescription(
  title: string,
  category: string,
  listingId?: string,
  mode: GenerationMode = 'on_demand',
  options?: {
    description?: string;
    unitOfMeasurement?: string;
  }
): Promise<GenerationResult> {
  // Normalize title for consistent caching
  const normalized = normalizeTitle(title);
  const cacheKey = generateCacheKey(category, normalized);

  // Log generation request (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DescriptionGenerator] Request: "${title}" in "${category}"`);
    console.log(`[DescriptionGenerator] Cache key: ${cacheKey}`);
    console.log(`[DescriptionGenerator] Mode: ${mode}`);
  }

  // Step 1: Check cache
  const cachedResult = await getCachedDescription(cacheKey);
  
  if (cachedResult) {
    // Increment hit count asynchronously
    void incrementCacheHitCount(cacheKey, listingId);
    
    // Update listing if ID provided
    if (listingId) {
      await updateListingWithDescription(listingId, cachedResult, cacheKey);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DescriptionGenerator] Cache HIT`);
    }

    return {
      short_description: cachedResult.short_description,
      confidence: cachedResult.confidence,
      cached: true,
      model: cachedResult.model,
      cacheKey,
      source: 'cache',
    };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DescriptionGenerator] Cache MISS - generating via OpenAI`);
  }

  // Step 2: Generate via OpenAI
  let result: GenerationResult;

  if (!isOpenAIConfigured()) {
    // OpenAI not configured - use fallback
    console.warn('[DescriptionGenerator] OpenAI not configured, using fallback');
    const fallback = generateFallbackDescription(title, category);
    result = {
      ...fallback,
      cached: false,
      model: 'fallback',
      cacheKey,
      source: 'fallback',
    };
  } else {
    try {
      const userMessage = buildUserMessage(normalized, category, options);
      const openAiResult = await generateStructuredDescription(
        SYSTEM_PROMPT,
        userMessage
      );

      // Adjust confidence based on title characteristics
      const adjustedConfidence = adjustConfidence(
        openAiResult.response.confidence,
        normalized
      );

      result = {
        short_description: openAiResult.response.short_description,
        confidence: adjustedConfidence,
        cached: false,
        model: openAiResult.model,
        cacheKey,
        source: 'openai',
      };

      if (process.env.NODE_ENV === 'development') {
        console.log(`[DescriptionGenerator] OpenAI generation successful`);
        console.log(`[DescriptionGenerator] Tokens used: ${openAiResult.usage.totalTokens}`);
      }
    } catch (error) {
      // OpenAI failed - use fallback
      console.error('[DescriptionGenerator] OpenAI error, using fallback:', 
        error instanceof Error ? error.message : 'Unknown error'
      );

      const fallback = generateFallbackDescription(title, category);
      result = {
        ...fallback,
        cached: false,
        model: 'fallback',
        cacheKey,
        source: 'fallback',
      };
    }
  }

  // Step 3: Store in cache (don't await - fire and forget)
  void storeCachedDescription(cacheKey, normalized, category, result, listingId);

  // Step 4: Update listing if ID provided
  if (listingId) {
    await updateListingWithDescription(listingId, result, cacheKey);
  }

  return result;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Retrieve a cached description
 * 
 * @param cacheKey - Deterministic cache key
 * @returns Cached document or null
 */
async function getCachedDescription(
  cacheKey: string
): Promise<AiDescriptionCacheDocument | null> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    return await collection.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() }, // Only return non-expired
    });
  } catch (error) {
    console.error('[DescriptionGenerator] Cache lookup failed:', error);
    return null;
  }
}

/**
 * Store a description in cache
 * 
 * @param cacheKey - Deterministic cache key
 * @param normalizedTitle - Normalized title
 * @param category - Category
 * @param result - Generation result
 * @param listingId - Optional listing ID
 */
async function storeCachedDescription(
  cacheKey: string,
  normalizedTitle: string,
  category: string,
  result: GenerationResult,
  listingId?: string
): Promise<void> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const document: AiDescriptionCacheDocument = {
      cacheKey,
      normalizedTitle,
      category,
      short_description: result.short_description,
      confidence: result.confidence,
      model: result.model,
      generatedAt: now,
      expiresAt,
      hitCount: 1,
      usedByListings: listingId ? [new ObjectId(listingId)] : [],
    };

    await collection.updateOne(
      { cacheKey },
      { $set: document },
      { upsert: true }
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DescriptionGenerator] Cached: ${cacheKey}`);
    }
  } catch (error) {
    console.error('[DescriptionGenerator] Cache storage failed:', error);
    // Non-critical - don't throw
  }
}

/**
 * Increment cache hit count and track listing usage
 * 
 * @param cacheKey - Cache key
 * @param listingId - Optional listing ID to track
 */
async function incrementCacheHitCount(
  cacheKey: string,
  listingId?: string
): Promise<void> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    const update: Record<string, unknown> = {
      $inc: { hitCount: 1 },
    };

    if (listingId) {
      update.$addToSet = { usedByListings: new ObjectId(listingId) };
    }

    await collection.updateOne({ cacheKey }, update);
  } catch (error) {
    console.error('[DescriptionGenerator] Hit count update failed:', error);
    // Non-critical - don't throw
  }
}

// =============================================================================
// Listing Operations
// =============================================================================

/**
 * Update a listing document with generated description
 * 
 * @param listingId - MongoDB ObjectId string
 * @param result - Generation result
 * @param cacheKey - Cache key for reference
 */
async function updateListingWithDescription(
  listingId: string,
  result: Pick<GenerationResult, 'short_description' | 'confidence' | 'model'>,
  cacheKey: string
): Promise<void> {
  try {
    const collection = await getCollection<ListingDocument>(COLLECTIONS.LISTINGS);

    const aiMetadata: ListingAiMetadata = {
      short_description: result.short_description,
      confidence: result.confidence,
      generatedAt: new Date(),
      model: result.model,
      cacheKey,
    };

    await collection.updateOne(
      { _id: new ObjectId(listingId) },
      {
        $set: {
          short_description: result.short_description,
          ai: aiMetadata,
          updatedAt: new Date(),
        },
      }
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DescriptionGenerator] Updated listing: ${listingId}`);
    }
  } catch (error) {
    console.error('[DescriptionGenerator] Listing update failed:', error);
    // Throw this error - listing update failure is significant
    throw new Error(`Failed to update listing ${listingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Index Setup
// =============================================================================

/**
 * Ensure required indexes exist on collections
 * Call this during application startup
 * 
 * @returns Promise that resolves when indexes are created
 */
export async function ensureIndexes(): Promise<void> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    // TTL index on expiresAt field
    await collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'ttl_expiresAt' }
    );

    // Unique index on cacheKey for fast lookups
    await collection.createIndex(
      { cacheKey: 1 },
      { unique: true, name: 'unique_cacheKey' }
    );

    // Index for analytics queries
    await collection.createIndex(
      { category: 1, generatedAt: -1 },
      { name: 'category_generatedAt' }
    );

    console.log('[DescriptionGenerator] Indexes ensured');
  } catch (error) {
    console.error('[DescriptionGenerator] Index creation failed:', error);
    // Non-fatal - indexes may already exist
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get cache statistics
 * 
 * @returns Cache statistics object
 */
export async function getCacheStats(): Promise<{
  totalCached: number;
  hitRate: number;
  avgConfidence: number;
  byModel: Record<string, number>;
}> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    const stats = await collection.aggregate([
      {
        $match: { expiresAt: { $gt: new Date() } },
      },
      {
        $group: {
          _id: null,
          totalCached: { $sum: 1 },
          totalHits: { $sum: '$hitCount' },
          avgConfidence: { $avg: '$confidence' },
        },
      },
    ]).toArray();

    const modelStats = await collection.aggregate([
      {
        $match: { expiresAt: { $gt: new Date() } },
      },
      {
        $group: {
          _id: '$model',
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const byModel: Record<string, number> = {};
    for (const stat of modelStats) {
      byModel[stat._id as string] = stat.count as number;
    }

    const result = stats[0] || { totalCached: 0, totalHits: 0, avgConfidence: 0 };

    return {
      totalCached: result.totalCached as number,
      hitRate: result.totalCached > 0 
        ? (result.totalHits as number) / (result.totalCached as number) 
        : 0,
      avgConfidence: result.avgConfidence as number || 0,
      byModel,
    };
  } catch (error) {
    console.error('[DescriptionGenerator] Stats query failed:', error);
    return { totalCached: 0, hitRate: 0, avgConfidence: 0, byModel: {} };
  }
}

/**
 * Clear expired cache entries (manual cleanup if TTL index isn't working)
 * 
 * @returns Number of entries deleted
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const collection = await getCollection<AiDescriptionCacheDocument>(
      COLLECTIONS.AI_DESCRIPTIONS
    );

    const result = await collection.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  } catch (error) {
    console.error('[DescriptionGenerator] Cache cleanup failed:', error);
    return 0;
  }
}

