import { Router } from 'express';
import { analyzeDocument } from '../controllers/ocrController.js';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';

// Use memory storage to avoid messy file cleanup, or temp disk.
// 10MB limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Check mime type or extension
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, JPG, JPEG, and WEBP are allowed.'));
    }
  }
});

const router = Router();

// /api/ocr/analyze
router.post('/analyze', requireAuth, upload.single('file'), analyzeDocument);

export default router;
