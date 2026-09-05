import { Router } from 'express';
import {
  uploadImage,
  getImage,
  uploadMiddleware,
} from '../controllers/imageController.js';

const router = Router();

router.post('/upload', uploadMiddleware.single('file'), uploadImage);
router.get('/:id', getImage);

export default router;
