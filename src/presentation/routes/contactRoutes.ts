import { Router } from 'express';
import { ContactController } from '../controllers/ContactController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();
const contactController = new ContactController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.post('/', contactController.createContact);
router.post('/upload', upload.single('file'), contactController.bulkUpload);
router.get('/', contactController.getContacts);
router.get('/:id', contactController.getContactById);
router.put('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

export default router;

