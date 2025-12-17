# AI Description Generator

## Overview

The AI Description Generator is a server-side API that automatically generates product descriptions for the 86 Deadstock B2B marketplace. It uses OpenAI's GPT-4o model with guardrailed prompting to produce accurate, non-hallucinating descriptions.

## Features

- **Guardrailed Generation**: Prevents hallucination by only using facts from title/category
- **Caching**: 30-day TTL cache with deduplication for identical requests
- **Fallback Handling**: Template-based fallback when OpenAI is unavailable
- **Confidence Scoring**: 0.0-1.0 score based on title clarity
- **Rating System**: Track and improve description quality with user feedback
- **Listing Updates**: Optionally updates listing documents with generated descriptions

## API Reference

### Generate Description

```http
POST /api/listings/generate-description
Content-Type: application/json
```

#### Request Body

```json
{
  "title": "12-inch pizza boxes",
  "category": "Packaging",
  "mode": "upload",
  "listingId": "507f1f77bcf86cd799439011"  // Optional
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Product title (min 3 chars) |
| `category` | string | Yes | Product category |
| `mode` | string | Yes | `"upload"` or `"on_demand"` |
| `listingId` | string | No | MongoDB ObjectId to update |

#### Response

```json
{
  "short_description": "Pizza boxes designed for foodservice operations. Suitable for transporting and serving pizza. Verify size specifications, material composition, and quantity with seller before purchasing.",
  "category": "Packaging",
  "confidence": 0.72,
  "cached": false,
  "model": "gpt-4o",
  "cacheKey": "Packaging::pizza boxes"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `short_description` | string | Generated description (240-360 chars) |
| `category` | string | Echo of input category |
| `confidence` | number | Score 0.0-1.0 |
| `cached` | boolean | Whether served from cache |
| `model` | string | OpenAI model used |
| `cacheKey` | string | Deterministic cache key |

#### Error Response

```json
{
  "error": "Title must be at least 3 characters after trimming",
  "status": 400,
  "code": "TITLE_TOO_SHORT"
}
```

### Submit Rating

```http
POST /api/listings/generate-description/rate
Content-Type: application/json
```

```json
{
  "cacheKey": "Packaging::pizza boxes",
  "rating": 4,
  "feedback": "Good description but could mention typical sizes",
  "title": "pizza boxes",
  "category": "Packaging",
  "short_description": "Pizza boxes designed for..."
}
```

### Get Rating Statistics

```http
GET /api/listings/generate-description/rate
```

```json
{
  "totalRatings": 150,
  "avgRating": 4.2,
  "rating1": 5,
  "rating2": 10,
  "rating3": 25,
  "rating4": 60,
  "rating5": 50
}
```

## Confidence Scoring Rubric

| Score | Level | Description | Example |
|-------|-------|-------------|---------|
| 0.85-1.0 | High | Clear concrete item with key qualifiers | "12-inch pizza boxes" |
| 0.55-0.84 | Medium | Understandable but missing qualifiers | "pizza boxes" |
| 0.25-0.54 | Low | Ambiguous or generic title | "boxes", "supplies" |
| 0.0-0.24 | Very Low | Nonsense or unusable | "asdfgh" |

## Integration Examples

### Upload Flow (React)

```typescript
// During product upload
async function handleProductUpload(product: ProductFormData) {
  // First, create the product
  const createdProduct = await createProduct(product);
  
  // Then generate description
  const descriptionResponse = await fetch('/api/listings/generate-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: product.title,
      category: product.category.name,
      listingId: createdProduct.id,
      mode: 'upload'
    })
  });
  
  const { short_description, confidence } = await descriptionResponse.json();
  
  // Description is already saved to the listing
  console.log(`Generated with ${confidence * 100}% confidence`);
}
```

### On-Demand Generation (React Component)

```typescript
function GenerateDescriptionButton({ 
  title, 
  category, 
  listingId,
  onGenerated 
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/listings/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          listingId,
          mode: 'on_demand'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        onGenerated(result);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? 'Generating...' : 'Generate Description'}
    </button>
  );
}
```

### Server-Side Generation (Next.js Server Action)

```typescript
'use server';

import { generateDescription } from '@/lib/ai/description-generator';

export async function generateProductDescription(
  title: string,
  category: string,
  listingId?: string
) {
  try {
    const result = await generateDescription(
      title,
      category,
      listingId,
      'on_demand'
    );
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    };
  }
}
```

## Environment Variables

Add these to your `.env.local`:

```env
# Required
OPENAI_API_KEY=sk-...

# MongoDB (already configured)
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=86_dead_stock_staging
```

## Setup

### 1. Install Dependencies

The OpenAI SDK needs to be installed:

```bash
npm install openai
```

### 2. Create MongoDB Indexes

Run the index setup script:

```bash
npx tsx scripts/setup-ai-indexes.ts
```

### 3. Test the API

Visit the test harness at:

```
http://localhost:3000/test/ai-description
```

## MongoDB Collections

### `ai_descriptions` (Cache)

```typescript
{
  _id: ObjectId,
  cacheKey: "Packaging::pizza boxes",  // Unique
  normalizedTitle: "pizza boxes",
  category: "Packaging",
  short_description: "...",
  confidence: 0.72,
  model: "gpt-4o",
  generatedAt: Date,
  expiresAt: Date,  // TTL index
  hitCount: 15,
  usedByListings: [ObjectId, ...]
}
```

### `ai_description_ratings`

```typescript
{
  _id: ObjectId,
  cacheKey: "Packaging::pizza boxes",
  rating: 4,
  feedback: "Good but...",
  title: "pizza boxes",
  category: "Packaging",
  short_description: "...",
  ratedAt: Date,
  sessionId: "test-1234567890"
}
```

### Listing Document Updates

When `listingId` is provided, the listing document is updated:

```typescript
{
  // ... existing fields
  short_description: "...",
  ai: {
    short_description: "...",
    confidence: 0.72,
    generatedAt: Date,
    model: "gpt-4o",
    cacheKey: "Packaging::pizza boxes"
  }
}
```

## Architecture

```
┌─────────────────────┐
│   API Route         │
│   /api/listings/    │
│   generate-desc     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Description         │────▶│ MongoDB Cache       │
│ Generator Service   │     │ ai_descriptions     │
└─────────┬───────────┘     └─────────────────────┘
          │ Cache Miss
          ▼
┌─────────────────────┐
│ OpenAI Client       │
│ (gpt-4o)            │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Fallback Template   │ (if OpenAI fails)
└─────────────────────┘
```

## Guardrails

The system prompt enforces these rules:

1. **Only use facts from title/category** - No guessing or inventing details
2. **No hallucination of**:
   - Size, dimensions, measurements
   - Materials or composition
   - Brand names
   - Certifications (food-safe, NSF, etc.)
   - Quantity or pack size
   - Condition details
3. **Neutral, operational tone** - Useful for B2B buyers
4. **Appropriate length** - 240-360 characters target
5. **Confidence scoring** - Reflects title clarity

## Fallback Behavior

When OpenAI fails, a template-based description is generated:

```
{Category}: {Title} available. Details not specified—confirm size, 
material, quantity, and condition with seller before purchasing.
```

This fallback has a confidence score of 0.3.

## Performance

- **Cache Hit**: ~50-100ms response time
- **OpenAI Generation**: ~1-3 seconds
- **Fallback**: ~50ms

## Troubleshooting

### "OPENAI_API_KEY not configured"

Add the key to `.env.local`:
```env
OPENAI_API_KEY=sk-your-key-here
```

### "MongoDB connection error"

Check `MONGODB_URI` is correct and the database is accessible.

### Low confidence scores

This is expected for vague titles. The system is working correctly by indicating uncertainty.

### Cached results not updating

Cache TTL is 30 days. Clear manually if needed:

```typescript
import { clearExpiredCache } from '@/lib/ai/description-generator';
await clearExpiredCache();
```

