/**
 * MongoDB Connection Singleton for Next.js Server Components and API Routes
 * 
 * @fileoverview Provides a singleton MongoDB connection that persists across
 * hot-reloads in development and is properly managed in production.
 * 
 * @description This module implements the recommended pattern for Next.js
 * MongoDB connections, caching the client promise in the global scope to
 * prevent connection pool exhaustion during development hot-reloads.
 * 
 * @example
 * ```typescript
 * import { getMongoDb, getCollection } from '@/lib/db/mongo';
 * 
 * // Get database instance
 * const db = await getMongoDb();
 * 
 * // Get typed collection
 * const listings = await getCollection<ListingDocument>('listings');
 * ```
 * 
 * @author 86 Deadstock Engineering Team
 * @since 2024-12-17
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';

/**
 * MongoDB connection URI from environment variables
 * @constant
 */
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Database name extracted from URI or default
 * @constant
 */
const DATABASE_NAME = process.env.MONGODB_DATABASE || '86_dead_stock_staging';

/**
 * Connection options for MongoDB client
 * @constant
 */
const MONGO_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
};

/**
 * Type declaration for global MongoDB client cache
 * Extends global namespace to persist across hot-reloads
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Cached MongoDB client promise
 * Uses global scope to survive Next.js hot-reloads in development
 */
let clientPromise: Promise<MongoClient>;

/**
 * Initialize or retrieve the MongoDB client connection
 * 
 * @throws {Error} When MONGODB_URI environment variable is not defined
 * @returns {Promise<MongoClient>} MongoDB client promise
 */
function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not defined. ' +
      'Please add it to your .env.local file.'
    );
  }

  if (process.env.NODE_ENV === 'development') {
    // In development, use a global variable to preserve connection across hot-reloads
    if (!global._mongoClientPromise) {
      const client = new MongoClient(MONGODB_URI, MONGO_OPTIONS);
      global._mongoClientPromise = client.connect();
      
      // Log connection establishment (development only)
      global._mongoClientPromise.then(() => {
        console.log('[MongoDB] Connected successfully in development mode');
      }).catch((err) => {
        console.error('[MongoDB] Connection failed:', err.message);
      });
    }
    return global._mongoClientPromise;
  }

  // In production, create a new client for each cold start
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, MONGO_OPTIONS);
    clientPromise = client.connect();
  }
  
  return clientPromise;
}

// Initialize the client promise on module load
clientPromise = getClientPromise();

/**
 * Get the MongoDB client instance
 * 
 * @returns {Promise<MongoClient>} Connected MongoDB client
 * @example
 * ```typescript
 * const client = await getMongoClient();
 * const adminDb = client.db('admin');
 * ```
 */
export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

/**
 * Get the default database instance
 * 
 * @returns {Promise<Db>} MongoDB database instance
 * @example
 * ```typescript
 * const db = await getMongoDb();
 * const result = await db.collection('listings').findOne({ _id: id });
 * ```
 */
export async function getMongoDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DATABASE_NAME);
}

/**
 * Get a typed collection from the database
 * 
 * @template T - Document type extending MongoDB Document
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Collection<T>>} Typed MongoDB collection
 * @example
 * ```typescript
 * interface MyDocument extends Document {
 *   name: string;
 *   value: number;
 * }
 * 
 * const collection = await getCollection<MyDocument>('myCollection');
 * const doc = await collection.findOne({ name: 'test' });
 * ```
 */
export async function getCollection<T extends Document>(
  collectionName: string
): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(collectionName);
}

/**
 * Check if MongoDB connection is healthy
 * 
 * @returns {Promise<boolean>} True if connected, false otherwise
 * @example
 * ```typescript
 * const isHealthy = await checkMongoHealth();
 * if (!isHealthy) {
 *   console.error('MongoDB connection is unhealthy');
 * }
 * ```
 */
export async function checkMongoHealth(): Promise<boolean> {
  try {
    const client = await clientPromise;
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Export the client promise for Next.js API routes
 * that may need direct access to the connection
 */
export { clientPromise };

/**
 * Export database name for reference
 */
export { DATABASE_NAME };

