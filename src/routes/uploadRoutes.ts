import { Router } from 'express';

import * as uploadController from '../controllers/uploadController';
import authMiddleware from '../middlewares/auth-middleware';

const router = Router();

router.get('/initiate-upload', authMiddleware, uploadController.initiateUpload);
router.get('/get-upload-url', uploadController.getUploadUrl);
router.post('/complete-upload', uploadController.completeUpload);
// router.post('/save-upload', authMiddleware, uploadController.saveUpload);

export default router;
