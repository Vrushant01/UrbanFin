import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let gridFSBucket: GridFSBucket | null = null;

export const connectDB = async (): Promise<typeof mongoose> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/urbanfin';

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: 'urbanfin',
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Initialize GridFS bucket on the active db connection
    if (conn.connection.db) {
      gridFSBucket = new GridFSBucket(conn.connection.db, {
        bucketName: 'images',
      });
      console.log('[Database] GridFS Bucket "images" initialized successfully');
    }

    return conn;
  } catch (error) {
    console.error('[Database] MongoDB connection failed:', error);
    throw error;
  }
};

export const getGridFSBucket = (): GridFSBucket => {
  if (!gridFSBucket) {
    if (mongoose.connection.db) {
      gridFSBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'images',
      });
      return gridFSBucket;
    }
    throw new Error('GridFS Bucket is not initialized. Ensure database is connected.');
  }
  return gridFSBucket;
};
