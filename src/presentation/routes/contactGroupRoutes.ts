import { Router } from 'express';
import { ContactGroupController } from '../controllers/ContactGroupController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const contactGroupController = new ContactGroupController();

router.use(authMiddleware);

router.post('/', contactGroupController.assignContactToGroup);
router.delete('/:contactId/:groupId', contactGroupController.removeContactFromGroup);
router.get('/:groupId', contactGroupController.getContactsInGroup);

export default router;
