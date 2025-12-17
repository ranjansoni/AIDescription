/**
 * Description Rating API Route
 * 
 * @route POST /api/listings/generate-description/rate
 * 
 * @fileoverview Endpoint for submitting quality ratings and feedback
 * for generated descriptions. Used to track and improve generation quality.
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db/mongo';
import type { DescriptionRatingDocument } from '@/types/ai-description';

// =============================================================================
// Configuration
// =============================================================================

export const dynamic = 'force-dynamic';

const COLLECTION_NAME = 'ai_description_ratings';

// =============================================================================
// Validation Schema
// =============================================================================

const ratingSchema = z.object({
  cacheKey: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
  title: z.string(),
  category: z.string(),
  short_description: z.string(),
  sessionId: z.string().optional(),
});

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /api/listings/generate-description/rate
 * 
 * Submit a rating for a generated description
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', status: 400 },
        { status: 400 }
      );
    }

    const validation = ratingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
          status: 400,
        },
        { status: 400 }
      );
    }

    const { cacheKey, rating, feedback, title, category, short_description, sessionId } =
      validation.data;

    // Store rating
    const collection = await getCollection<DescriptionRatingDocument>(COLLECTION_NAME);

    const ratingDoc: DescriptionRatingDocument = {
      cacheKey,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      feedback,
      title,
      category,
      short_description,
      ratedAt: new Date(),
      sessionId,
    };

    await collection.insertOne(ratingDoc);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Rating] Submitted: ${rating}/5 for "${cacheKey}"`);
    }

    return NextResponse.json(
      { success: true, message: 'Rating submitted successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Rating] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit rating', status: 500 },
      { status: 500 }
    );
  }
}

/**
 * GET /api/listings/generate-description/rate
 * 
 * Get rating statistics (for admin/analytics)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const collection = await getCollection<DescriptionRatingDocument>(COLLECTION_NAME);

    const stats = await collection
      .aggregate([
        {
          $group: {
            _id: null,
            totalRatings: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    const recentRatings = await collection
      .find({})
      .sort({ ratedAt: -1 })
      .limit(10)
      .toArray();

    const result = stats[0] || {
      totalRatings: 0,
      avgRating: 0,
      rating1: 0,
      rating2: 0,
      rating3: 0,
      rating4: 0,
      rating5: 0,
    };

    return NextResponse.json({
      ...result,
      avgRating: Math.round((result.avgRating as number || 0) * 100) / 100,
      recentRatings: recentRatings.map((r) => ({
        rating: r.rating,
        cacheKey: r.cacheKey,
        feedback: r.feedback,
        ratedAt: r.ratedAt,
      })),
    });
  } catch (error) {
    console.error('[Rating] Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rating stats', status: 500 },
      { status: 500 }
    );
  }
}

