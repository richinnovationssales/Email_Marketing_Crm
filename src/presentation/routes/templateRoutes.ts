// src/presentation/routes/templateRoutes.ts
import { Router } from 'express';
import { TemplateController } from '../controllers/TemplateController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const templateController = new TemplateController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.post('/', templateController.createTemplate);
router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplateById);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

export default router;
