import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { getGridFSBucket } from '../config/db.js';
import { Readable } from 'stream';

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max upload
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

/**
 * Helper to compress image buffer using sharp and save to GridFS.
 */
export const compressAndStoreImage = async (
  buffer: Buffer,
  filename: string = 'image.webp'
): Promise<string> => {
  const compressedBuffer = await sharp(buffer)
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  const bucket = getGridFSBucket();
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: 'image/webp',
    metadata: {
      format: 'webp',
      createdAt: new Date(),
    },
  });

  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(compressedBuffer);
    readable.push(null);

    readable
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve(uploadStream.id.toString());
      });
  });
};

/**
 * If a data URL / base64 image string is provided, convert and store in GridFS.
 */
export const processBase64ImageIfPresent = async (
  imageData?: string
): Promise<string | undefined> => {
  if (!imageData || !imageData.startsWith('data:image')) {
    return imageData;
  }

  try {
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return imageData;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const imageId = await compressAndStoreImage(buffer, `upload_${Date.now()}.webp`);
    return `/api/images/${imageId}`;
  } catch (error) {
    console.error('[Image Processing] Failed to process base64 image:', error);
    return imageData;
  }
};

export const uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No image file uploaded' });
      return;
    }

    const imageId = await compressAndStoreImage(
      req.file.buffer,
      req.file.originalname || 'upload.webp'
    );

    res.status(201).json({
      imageId,
      url: `/api/images/${imageId}`,
    });
  } catch (error) {
    next(error);
  }
};

export const getImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid image ID format' });
      return;
    }

    const bucket = getGridFSBucket();
    const objectId = new ObjectId(id);

    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    const file = files[0];
    res.setHeader('Content-Type', file.contentType || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const downloadStream = bucket.openDownloadStream(objectId);
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
