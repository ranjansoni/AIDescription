# AI Description Generator

AI-powered product description generator for B2B marketplace listings. Uses OpenAI GPT-4o with guardrailed prompting to produce accurate, SEO-friendly descriptions without hallucination.

## Features

- **SEO-Optimized Output**: 150-250 character descriptions optimized for Google/Gemini
- **Brand Detection**: Automatically identifies and highlights 50+ known restaurant equipment brands
- **Guardrailed Generation**: Prevents hallucination—never assumes eco-friendly, sizes, or materials
- **Caching**: 30-day TTL cache with MongoDB for fast repeat lookups
- **Rating System**: Track and improve description quality with user feedback
- **Confidence Scoring**: 0.0-1.0 score based on title clarity

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: OpenAI GPT-4o
- **Database**: MongoDB
- **Validation**: Zod
- **Language**: TypeScript

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
OPENAI_API_KEY=sk-your-key-here
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=your_database
```

### 3. Setup MongoDB Indexes

```bash
npm run setup:indexes
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Test the Generator

Open: `http://localhost:3000/test/ai-description`

## API Reference

### Generate Description

```http
POST /api/listings/generate-description
Content-Type: application/json
```

**Request:**

```json
{
  "title": "Cambro 6-quart food storage containers",
  "category": "Food Storage",
  "mode": "on_demand",
  "unitOfMeasurement": "case",
  "userDescription": "Clear polycarbonate, stackable"
}
```

**Response:**

```json
{
  "short_description": "Cambro 6-quart food storage containers—restaurant-grade, stackable, built for heavy kitchen use.",
  "category": "Food Storage",
  "confidence": 0.90,
  "cached": false,
  "model": "gpt-4o-2024-08-06",
  "cacheKey": "Food Storage::cambro 6-quart food storage containers"
}
```

### Submit Rating

```http
POST /api/listings/generate-description/rate
```

```json
{
  "cacheKey": "Food Storage::cambro 6-quart",
  "rating": 4,
  "feedback": "Good but could mention color",
  "title": "cambro 6-quart",
  "category": "Food Storage",
  "short_description": "..."
}
```

## Project Structure

```
src/
├── app/
│   ├── api/listings/generate-description/
│   │   ├── route.ts          # Main API endpoint
│   │   └── rate/route.ts     # Rating endpoint
│   └── test/ai-description/
│       └── page.tsx          # Interactive test harness
├── lib/
│   ├── ai/
│   │   ├── prompts.ts        # System prompts & templates
│   │   ├── description-generator.ts  # Core service
│   │   └── openai.ts         # OpenAI client
│   ├── db/
│   │   └── mongo.ts          # MongoDB connection
│   └── validators/
│       └── description.ts    # Zod validation schemas
├── types/
│   └── ai-description.ts     # TypeScript types
scripts/
└── setup-ai-indexes.ts       # MongoDB index setup
docs/
└── AI_DESCRIPTION_GENERATOR.md  # Full documentation
```

## Prompt Guidelines

The AI is instructed to:

✅ **DO:**
- Use only facts from title, category, and seller description
- Include brand names when present
- Focus on product identity and practical value
- Keep descriptions 150-200 characters
- Use restaurant-to-restaurant tone

❌ **DON'T:**
- Assume eco-friendly, sustainable, compostable
- Guess sizes, materials, or certifications
- Add "confirm with seller" filler
- Hallucinate brand reputations

## Confidence Scoring

| Score | Level | Description |
|-------|-------|-------------|
| 0.85-1.0 | High | Clear item with brand, size, specifics |
| 0.55-0.84 | Medium | Understandable but missing qualifiers |
| 0.25-0.54 | Low | Ambiguous or generic title |
| 0.0-0.24 | Very Low | Unusable input |

## License

© 2025 86Deadstock LLC. All rights reserved.

