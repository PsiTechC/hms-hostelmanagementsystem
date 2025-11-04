
import mongoose, { Mongoose } from "mongoose"


// const MONGODB_URI = process.env.MONGODB_URI || HARDCODED_MONGODB_URI;
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in environment variables and no hardcoded fallback set")
}

// const DB_NAME = process.env.MONGODB_DB || HARDCODED_DB_NAME;
const DB_NAME = process.env.MONGODB_DB;

type MongooseCache = {
    conn: Mongoose | null
    promise: Promise<Mongoose> | null
}

declare global {
    // eslint-disable-next-line no-var
    var _mongoose: MongooseCache | undefined
}

// Cached connection pattern for Next.js (hot reload safe)
let cached = global._mongoose
if (!cached) {
    cached = global._mongoose = { conn: null, promise: null }
}

export async function dbConnect() {
    if (cached!.conn) return cached!.conn

    if (!cached!.promise) {
        cached!.promise = mongoose
            .connect(MONGODB_URI as string, { dbName: DB_NAME })
            .then((m) => {
                console.log("MongoDB connected successfully!")
                return m
            })
    }

    cached!.conn = await cached!.promise
    return cached!.conn
}
