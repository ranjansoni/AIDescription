'use client';

/**
 * AI Description Generator Test Harness
 * 
 * @route /test/ai-description
 * 
 * @fileoverview Interactive testing interface for the AI description
 * generation API. Provides a form to test generation and rate results.
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import React, { useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface GenerationResult {
  short_description: string;
  category: string;
  confidence: number;
  cached: boolean;
  model: string;
  cacheKey: string;
}

interface GenerationError {
  error: string;
  status: number;
  code?: string;
  details?: string;
}

interface RatingStats {
  totalRatings: number;
  avgRating: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
}

type GenerationMode = 'upload' | 'on_demand';

// =============================================================================
// Sample Categories
// =============================================================================

const SAMPLE_CATEGORIES = [
  'Packaging',
  'Disposable',
  'Kitchen Equipment',
  'Tableware',
  'Food Storage',
  'Cleaning Supplies',
  'Beverages',
  'Furniture',
  'Smallwares',
  'Refrigeration',
  'Cooking Equipment',
] as const;

const SAMPLE_TITLES = [
  'pizza boxes',
  '12-inch pizza boxes',
  '6-quart stainless steel mixing bowl',
  'commercial refrigerator',
  'disposable coffee cups',
  'chef knives set',
  'supplies',
  'boxes',
  'restaurant equipment',
  '16oz compostable food containers with lids',
] as const;

// =============================================================================
// Component
// =============================================================================

// Unit of Measurement options
const UNIT_OPTIONS = [
  '',
  'each',
  'case',
  'box',
  'pack',
  'pallet',
  'dozen',
  'set',
  'pair',
  'roll',
  'bag',
] as const;

export default function AiDescriptionTestPage() {
  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(SAMPLE_CATEGORIES[0]);
  const [mode, setMode] = useState<GenerationMode>('on_demand');
  const [listingId, setListingId] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [unitOfMeasurement, setUnitOfMeasurement] = useState('');

  // Result state
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<GenerationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  // Rating state
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Stats state
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleGenerate = useCallback(async () => {
    if (!title.trim()) {
      setError({ error: 'Title is required', status: 400, code: 'VALIDATION' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setRating(null);
    setFeedback('');
    setRatingSubmitted(false);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/listings/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          mode,
          ...(listingId.trim() && { listingId: listingId.trim() }),
          ...(userDescription.trim() && { userDescription: userDescription.trim() }),
          ...(unitOfMeasurement && { unitOfMeasurement }),
        }),
      });

      const data = await response.json();
      setGenerationTime(Date.now() - startTime);

      if (!response.ok) {
        setError(data as GenerationError);
      } else {
        setResult(data as GenerationResult);
      }
    } catch (err) {
      setGenerationTime(Date.now() - startTime);
      setError({
        error: err instanceof Error ? err.message : 'Network error',
        status: 0,
        code: 'NETWORK',
      });
    } finally {
      setIsLoading(false);
    }
  }, [title, category, mode, listingId, userDescription, unitOfMeasurement]);

  const handleSubmitRating = useCallback(async () => {
    if (!result || rating === null) return;

    setIsSubmittingRating(true);

    try {
      const response = await fetch('/api/listings/generate-description/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cacheKey: result.cacheKey,
          rating,
          feedback: feedback.trim() || undefined,
          title,
          category,
          short_description: result.short_description,
          sessionId: `test-${Date.now()}`,
        }),
      });

      if (response.ok) {
        setRatingSubmitted(true);
      }
    } catch (err) {
      console.error('Rating submission failed:', err);
    } finally {
      setIsSubmittingRating(false);
    }
  }, [result, rating, feedback, title, category]);

  const handleLoadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/listings/generate-description/rate');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setShowStats(true);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const handleSampleTitle = useCallback((sampleTitle: string) => {
    setTitle(sampleTitle);
  }, []);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                AI Description Generator
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Test harness for listing description generation
              </p>
            </div>
            <button
              onClick={handleLoadStats}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-600"
            >
              View Stats
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="space-y-6">
            {/* Title Input */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <label className="block text-sm font-semibold text-slate-200 mb-3">
                Product Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 12-inch pizza boxes"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              
              {/* Sample Titles */}
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Quick samples:</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_TITLES.slice(0, 5).map((sample) => (
                    <button
                      key={sample}
                      onClick={() => handleSampleTitle(sample)}
                      className="px-3 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-md transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category & Unit */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  {SAMPLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Unit of Measurement{' '}
                  <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <select
                  value={unitOfMeasurement}
                  onChange={(e) => setUnitOfMeasurement(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Select unit --</option>
                  {UNIT_OPTIONS.filter(u => u).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* User Description (Optional) */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <label className="block text-sm font-semibold text-slate-200 mb-3">
                Seller Description{' '}
                <span className="text-slate-500 font-normal">(optional - enhances AI output)</span>
              </label>
              <textarea
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
                placeholder="Add details like size, material, condition, quantity..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                Helps the AI generate a more accurate description without guessing
              </p>
            </div>

            {/* Mode & Listing ID */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Generation Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="on_demand"
                      checked={mode === 'on_demand'}
                      onChange={() => setMode('on_demand')}
                      className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-300">On Demand</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="upload"
                      checked={mode === 'upload'}
                      onChange={() => setMode('upload')}
                      className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-300">Upload</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3">
                  Listing ID{' '}
                  <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                  placeholder="MongoDB ObjectId (24 hex chars)"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono text-sm"
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !title.trim()}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                isLoading || !title.trim()
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Description'
              )}
            </button>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-red-400 text-sm">✕</span>
                  </div>
                  <div>
                    <h3 className="text-red-400 font-semibold">
                      Error {error.code && `(${error.code})`}
                    </h3>
                    <p className="text-red-300/80 mt-1">{error.error}</p>
                    {error.details && (
                      <p className="text-red-400/60 text-sm mt-2 font-mono">
                        {error.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className="space-y-6">
                {/* Description Card */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Generated Description
                    </h3>
                    {result.cached && (
                      <span className="px-2.5 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                        Cached
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 leading-relaxed text-lg">
                    {result.short_description}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                    <span>{result.short_description.length} chars</span>
                    <span>•</span>
                    <span>{generationTime}ms</span>
                  </div>
                </div>

                {/* Metadata Card */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Confidence</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              result.confidence >= 0.85
                                ? 'bg-emerald-500'
                                : result.confidence >= 0.55
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${result.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-white font-mono text-sm">
                          {(result.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Category</p>
                      <p className="text-white mt-1">{result.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Model</p>
                      <p className="text-white font-mono text-sm mt-1">
                        {result.model}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cache Key</p>
                      <p className="text-white font-mono text-xs mt-1 truncate">
                        {result.cacheKey}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating Card */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Rate This Description
                  </h3>

                  {ratingSubmitted ? (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-3">
                        <span className="text-emerald-400 text-xl">✓</span>
                      </div>
                      <p className="text-emerald-400 font-medium">
                        Thank you for your feedback!
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Star Rating */}
                      <div className="flex justify-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className={`w-10 h-10 rounded-lg transition-all ${
                              rating !== null && star <= rating
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      {/* Feedback Text */}
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Optional feedback..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                      />

                      {/* Submit Rating */}
                      <button
                        onClick={handleSubmitRating}
                        disabled={rating === null || isSubmittingRating}
                        className={`w-full mt-4 py-3 rounded-lg font-medium transition-all ${
                          rating === null
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!result && !error && !isLoading && (
              <div className="bg-slate-800/30 rounded-xl p-12 border border-dashed border-slate-700 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <span className="text-3xl">✨</span>
                </div>
                <h3 className="text-lg font-medium text-slate-300">
                  Ready to Generate
                </h3>
                <p className="text-slate-500 mt-2 max-w-xs">
                  Enter a product title and category, then click generate to see
                  the AI-powered description.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Modal */}
        {showStats && stats && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Rating Statistics</h2>
                <button
                  onClick={() => setShowStats(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-500 text-sm">Total Ratings</p>
                  <p className="text-2xl font-bold text-white">{stats.totalRatings}</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-500 text-sm">Average Rating</p>
                  <p className="text-2xl font-bold text-amber-400">
                    {stats.avgRating.toFixed(1)} ★
                  </p>
                </div>
              </div>

              {/* Distribution */}
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats[`rating${star}` as keyof RatingStats] as number;
                  const percentage =
                    stats.totalRatings > 0
                      ? (count / stats.totalRatings) * 100
                      : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-slate-400 w-8">{star} ★</span>
                      <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-slate-500 text-sm w-8">{count}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowStats(false)}
                className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <p className="text-slate-600 text-sm text-center">
            86 Deadstock AI Description Generator Test Harness • v1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}

