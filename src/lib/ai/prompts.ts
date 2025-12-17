/**
 * Prompt Templates for AI Description Generation
 * 
 * @fileoverview Contains system prompts, user message templates, and
 * confidence rubric for guardrailed AI description generation.
 * 
 * @description This module provides:
 * - System prompt with strict hallucination prevention rules
 * - User message template for title/category input
 * - Confidence scoring rubric
 * - Fallback template for generation failures
 * 
 * @important The prompts are carefully crafted to:
 * - Prevent hallucination (no invented details)
 * - Produce consistent, useful descriptions
 * - Return valid JSON with required fields
 * - Score confidence accurately based on title clarity
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { MAX_DESCRIPTION_LENGTH, TARGET_DESCRIPTION_LENGTH } from '@/lib/validators/description';

// =============================================================================
// System Prompt
// =============================================================================

/**
 * System prompt for description generation
 * 
 * This prompt enforces:
 * - Factual accuracy (only use info from title/category)
 * - No hallucination (no guessing sizes, materials, brands, etc.)
 * - Consistent JSON output format
 * - Appropriate description length
 * - Accurate confidence scoring
 */
export const SYSTEM_PROMPT = `You write short, SEO-optimized listing descriptions for 86 Deadstock—a B2B restaurant surplus marketplace.

## TONE & STYLE

Write like one restaurant operator talking to another. Direct, practical, keyword-rich.
- Describe what the product IS and why it's useful
- Focus on practical value for foodservice operations
- Include relevant keywords naturally for Google/Gemini SEO
- NO filler phrases like "confirm with seller", "verify details", "check specs"

## BRAND IDENTIFICATION

If a brand name appears in the title (e.g., "Cambro", "Vollrath", "True", "Hobart"):
- Include the brand name prominently in the description
- Brands add credibility and search value

## STRICT RULES

1. ONLY use facts from the title, category, and any provided description—no inventing details
2. Do NOT guess or assume:
   - Sizes, dimensions, quantities
   - Materials or composition (unless explicitly stated)
   - Certifications or compliance
   - **Eco-friendly, sustainable, compostable, recyclable** (NEVER assume these)
   - Brand reputation or quality claims
   - Condition or age
3. Do NOT include seller instructions or CYA language
4. Focus on product identity and practical use cases in foodservice
5. If unit of measurement is provided (case, box, pack), mention it naturally
6. For vague titles, describe the general product category's use in foodservice

## LENGTH

- Target: ${TARGET_DESCRIPTION_LENGTH} characters
- Maximum: ${MAX_DESCRIPTION_LENGTH} characters
- Keep it tight: every word should add SEO or informational value

## OUTPUT FORMAT

Valid JSON with exactly these keys:
- short_description: string
- category: string (echo input exactly)
- confidence: number (0.0 to 1.0)

## CONFIDENCE SCORING

0.85–1.0: Clear item with specifics (brand, size, quantity)
Examples: "Cambro 12-quart containers", "True 2-door reach-in cooler"

0.55–0.84: Clear item but missing key details
Examples: "pizza boxes", "mixing bowls", "chef knives"

0.25–0.54: Vague or generic
Examples: "supplies", "equipment", "kitchen items"

0.0–0.24: Unusable
Examples: random characters, single letters

## EXAMPLES

Title: "Cambro 6-quart food storage containers"
Category: "Food Storage"
→ "Cambro 6-quart food storage containers—restaurant-grade, stackable, built for heavy kitchen use. Industry standard for prep and walk-in organization."
→ Confidence: 0.90

Title: "wrapped paper straws"
Category: "Disposable"
→ "Wrapped paper straws for beverage service. Individually wrapped for hygiene. Suitable for cafes, bars, and restaurants."
→ Confidence: 0.70
(NOTE: Do NOT say "eco-friendly" or "sustainable"—paper doesn't automatically mean eco-friendly)

Title: "pizza boxes"
Category: "Packaging"
Unit: "case"
→ "Pizza boxes by the case—essential packaging for pizzerias, ghost kitchens, and delivery operations."
→ Confidence: 0.70

Title: "True 2-door reach-in refrigerator"
Category: "Refrigeration"
→ "True 2-door reach-in refrigerator—commercial-grade cooling for back-of-house cold storage. Reliable workhorse."
→ Confidence: 0.88`;

// =============================================================================
// User Message Template
// =============================================================================

/**
 * Build the user message for OpenAI
 * 
 * @param title - Normalized product title
 * @param category - Product category
 * @returns Formatted user message
 * 
 * @example
 * ```typescript
 * const userMessage = buildUserMessage('pizza boxes', 'Packaging');
 * // Returns:
 * // "Title: pizza boxes
 * //  Category: Packaging
 * //  
 * //  Write a short, SEO-friendly description..."
 * ```
 */
export function buildUserMessage(
  title: string, 
  category: string,
  options?: {
    description?: string;
    unitOfMeasurement?: string;
  }
): string {
  let message = `Title: ${title}
Category: ${category}`;

  if (options?.unitOfMeasurement) {
    message += `\nUnit: ${options.unitOfMeasurement}`;
  }

  if (options?.description) {
    message += `\nSeller Description: ${options.description}`;
  }

  message += `\n\nWrite a short, SEO-friendly description. Focus on what the product IS and its value to foodservice. Include brand if mentioned. NEVER assume eco-friendly/sustainable unless explicitly stated. Keep under 200 chars.`;

  return message;
}

// =============================================================================
// Fallback Template
// =============================================================================

/**
 * Generate a fallback description when OpenAI fails
 * 
 * This template is used as a safe default when:
 * - OpenAI API is unavailable
 * - Rate limits are exceeded
 * - Response parsing fails after retries
 * 
 * @param title - Original title (not normalized, for display)
 * @param category - Product category
 * @returns Fallback description object
 * 
 * @example
 * ```typescript
 * const fallback = generateFallbackDescription('Pizza Boxes', 'Packaging');
 * // Returns:
 * // {
 * //   short_description: "Pizza Boxes available—surplus pricing. Confirm specs with seller.",
 * //   confidence: 0.3
 * // }
 * ```
 */
export function generateFallbackDescription(
  title: string,
  category: string
): { short_description: string; confidence: number } {
  // Capitalize first letter of title for display
  const displayTitle = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Build SEO-friendly fallback description focused on product identity
  let description = `${displayTitle}—${category.toLowerCase()} for foodservice operations. Available at surplus pricing.`;
  
  // Truncate to max length if needed
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    description = description.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
  }
  
  return {
    short_description: description,
    confidence: 0.3, // Low confidence for fallback
  };
}

// =============================================================================
// Title Processing
// =============================================================================

/**
 * Normalize a title for cache key generation
 * 
 * @param title - Raw title input
 * @returns Normalized title (trimmed, lowercase, collapsed whitespace)
 * 
 * @example
 * ```typescript
 * normalizeTitle('  Pizza   BOXES  '); // 'pizza boxes'
 * ```
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Generate a deterministic cache key
 * 
 * @param category - Product category
 * @param normalizedTitle - Pre-normalized title
 * @returns Cache key in format "category::normalizedTitle"
 * 
 * @example
 * ```typescript
 * generateCacheKey('Packaging', 'pizza boxes'); // 'Packaging::pizza boxes'
 * ```
 */
export function generateCacheKey(
  category: string,
  normalizedTitle: string
): string {
  return `${category}::${normalizedTitle}`;
}

// =============================================================================
// Confidence Estimation
// =============================================================================

/**
 * Common restaurant equipment brands for detection
 */
const KNOWN_BRANDS = [
  'cambro', 'vollrath', 'true', 'hobart', 'manitowoc', 'rational',
  'turbochef', 'vitamix', 'robot coupe', 'bunn', 'fetco', 'grindmaster',
  'beverage-air', 'traulsen', 'continental', 'delfield', 'hoshizaki',
  'scotsman', 'ice-o-matic', 'follett', 'cornelius', 'taylor', 'stoelting',
  'carpigiani', 'duke', 'hatco', 'apw wyott', 'star', 'toastmaster',
  'waring', 'hamilton beach', 'cuisinart', 'kitchenaid', 'globe',
  'berkel', 'hobart', 'bizerba', 'tor-rey', 'detecto', 'cardinal',
  'rubbermaid', 'carlisle', 'winco', 'update', 'browne', 'crestware',
  'tablecraft', 'american metalcraft', 'get', 'hall china', 'libbey',
  'anchor hocking', 'arcoroc', 'steelite', 'oneida', 'walco',
];

/**
 * Estimate confidence based on title characteristics
 * Used as a sanity check on OpenAI's confidence score
 * 
 * @param title - Normalized title
 * @returns Estimated confidence score
 */
export function estimateConfidence(title: string): number {
  const words = title.split(' ').filter(Boolean);
  const wordCount = words.length;
  const lowerTitle = title.toLowerCase();
  
  // Very short titles = low confidence
  if (wordCount <= 1) {
    return 0.35;
  }
  
  // Check for specific qualifiers that increase confidence
  const hasNumbers = /\d+/.test(title);
  const hasSizeIndicator = /(inch|oz|qt|quart|gallon|lb|pound|liter|ml|cm|mm)/i.test(title);
  const hasMaterialIndicator = /(stainless|steel|plastic|aluminum|wood|glass|paper|foam)/i.test(title);
  const hasBrand = KNOWN_BRANDS.some(brand => lowerTitle.includes(brand));
  
  let confidence = 0.55; // Base for understandable titles
  
  if (wordCount >= 3) confidence += 0.1;
  if (hasNumbers) confidence += 0.1;
  if (hasSizeIndicator) confidence += 0.1;
  if (hasMaterialIndicator) confidence += 0.05;
  if (hasBrand) confidence += 0.1; // Brand names increase confidence
  
  // Cap at 0.95 since we can't be 100% certain
  return Math.min(confidence, 0.95);
}

/**
 * Validate and adjust confidence score
 * Ensures the score is reasonable given the title
 * 
 * @param openAiConfidence - Confidence returned by OpenAI
 * @param title - Normalized title
 * @returns Adjusted confidence score
 */
export function adjustConfidence(
  openAiConfidence: number,
  title: string
): number {
  const estimated = estimateConfidence(title);
  
  // If OpenAI's confidence differs significantly from estimate,
  // use weighted average favoring OpenAI slightly
  const diff = Math.abs(openAiConfidence - estimated);
  
  if (diff > 0.3) {
    // Large discrepancy - blend them
    return openAiConfidence * 0.6 + estimated * 0.4;
  }
  
  // Otherwise trust OpenAI's assessment
  return openAiConfidence;
}

