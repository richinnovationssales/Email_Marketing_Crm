// src/presentation/routes/contactGroupRoutes.ts
import { Router } from 'express';
import { ContactGroupController } from '../controllers/ContactGroupController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const contactGroupController = new ContactGroupController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.post('/assign', contactGroupController.assignMultipleContactsToGroup);
router.delete('/remove', contactGroupController.removeMultipleContactsFromGroup);

router.post('/', contactGroupController.assignContactToGroup);
router.delete('/:contactId/:groupId', contactGroupController.removeContactFromGroup);
router.get('/:groupId', contactGroupController.getContactsInGroup);

export default router;
