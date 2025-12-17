/**
 * MongoDB Index Setup Script for AI Description Generator
 * 
 * @description Creates required indexes for the AI description
 * caching and rating collections. Run this script once during
 * initial deployment or when setting up a new environment.
 * 
 * @usage
 * ```bash
 * # Using npx tsx (recommended)
 * npx tsx scripts/setup-ai-indexes.ts
 * 
 * # Or compile and run
 * npx tsc scripts/setup-ai-indexes.ts --outDir dist
 * node dist/setup-ai-indexes.js
 * ```
 * 
 * @requires MONGODB_URI environment variable to be set
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { MongoClient } from 'mongodb';

// =============================================================================
// Configuration
// =============================================================================

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || '86_dead_stock_staging';

const COLLECTIONS = {
  AI_DESCRIPTIONS: 'ai_descriptions',
  AI_RATINGS: 'ai_description_ratings',
} as const;

// =============================================================================
// Index Definitions
// =============================================================================

interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1 | 'text'>;
  options: {
    name: string;
    unique?: boolean;
    expireAfterSeconds?: number;
    sparse?: boolean;
  };
}

const INDEXES: IndexDefinition[] = [
  // AI Descriptions Collection
  {
    collection: COLLECTIONS.AI_DESCRIPTIONS,
    index: { expiresAt: 1 },
    options: {
      name: 'ttl_expiresAt',
      expireAfterSeconds: 0, // TTL based on the field value
    },
  },
  {
    collection: COLLECTIONS.AI_DESCRIPTIONS,
    index: { cacheKey: 1 },
    options: {
      name: 'unique_cacheKey',
      unique: true,
    },
  },
  {
    collection: COLLECTIONS.AI_DESCRIPTIONS,
    index: { category: 1, generatedAt: -1 },
    options: {
      name: 'category_generatedAt',
    },
  },
  {
    collection: COLLECTIONS.AI_DESCRIPTIONS,
    index: { model: 1 },
    options: {
      name: 'model',
    },
  },
  {
    collection: COLLECTIONS.AI_DESCRIPTIONS,
    index: { hitCount: -1 },
    options: {
      name: 'hitCount_desc',
    },
  },

  // AI Ratings Collection
  {
    collection: COLLECTIONS.AI_RATINGS,
    index: { cacheKey: 1 },
    options: {
      name: 'cacheKey',
    },
  },
  {
    collection: COLLECTIONS.AI_RATINGS,
    index: { rating: 1 },
    options: {
      name: 'rating',
    },
  },
  {
    collection: COLLECTIONS.AI_RATINGS,
    index: { ratedAt: -1 },
    options: {
      name: 'ratedAt_desc',
    },
  },
  {
    collection: COLLECTIONS.AI_RATINGS,
    index: { category: 1, rating: 1 },
    options: {
      name: 'category_rating',
    },
  },
];

// =============================================================================
// Main Function
// =============================================================================

async function setupIndexes(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AI Description Generator - MongoDB Index Setup');
  console.log('='.repeat(60));
  console.log();

  // Validate environment
  if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  console.log(`📦 Database: ${DATABASE_NAME}`);
  console.log(`🔗 Connecting to MongoDB...`);
  console.log();

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    console.log();

    const db = client.db(DATABASE_NAME);

    // Ensure collections exist
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    for (const collName of Object.values(COLLECTIONS)) {
      if (!existingNames.includes(collName)) {
        console.log(`📁 Creating collection: ${collName}`);
        await db.createCollection(collName);
      }
    }
    console.log();

    // Create indexes
    console.log('📇 Creating indexes...');
    console.log();

    let created = 0;
    let skipped = 0;

    for (const indexDef of INDEXES) {
      const collection = db.collection(indexDef.collection);
      const indexName = indexDef.options.name;

      try {
        // Check if index already exists
        const existingIndexes = await collection.indexes();
        const exists = existingIndexes.some((idx) => idx.name === indexName);

        if (exists) {
          console.log(`   ⏭️  ${indexDef.collection}.${indexName} (already exists)`);
          skipped++;
        } else {
          await collection.createIndex(indexDef.index, indexDef.options);
          console.log(`   ✅ ${indexDef.collection}.${indexName}`);
          created++;
        }
      } catch (error) {
        console.error(`   ❌ ${indexDef.collection}.${indexName}: ${error}`);
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log(`Summary: ${created} created, ${skipped} skipped`);
    console.log('='.repeat(60));
    console.log();
    console.log('✅ Index setup complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// =============================================================================
// Run
// =============================================================================

setupIndexes().catch(console.error);

