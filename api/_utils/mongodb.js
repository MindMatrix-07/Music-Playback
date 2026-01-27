
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
    );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Define Schema
const accessCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, index: true },
    status: { type: String, default: '' }, // 'USED' or empty
    spotifyId: { type: String, default: null }, // Linked User ID
    name: { type: String, default: null }, // User Name
    rowIndex: { type: Number, default: null }, // Reference to Sheet Row
    isBlocked: { type: Boolean, default: false }, // BLOCK FEATURE
    lastLogin: { type: Date, default: null }, // LAST LOGIN TRACKING
    createdAt: { type: Date, default: Date.now }
});

const analyticsSchema = new mongoose.Schema({
    type: { type: String, required: true }, // 'VISIT', 'SPAM'
    userId: { type: String, default: null },
    details: { type: Object, default: {} },
    ip: { type: String, default: null }, // Optional: Hash or partial IP for spam tracking
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // 30 Day Auto-delete
});

// Prevent model recompilation error in dev
const AccessCode = mongoose.models.AccessCode || mongoose.model('AccessCode', accessCodeSchema);
const Analytics = mongoose.models.Analytics || mongoose.model('Analytics', analyticsSchema);

export { connectToDatabase, AccessCode, Analytics };
