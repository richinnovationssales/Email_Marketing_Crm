import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CustomFieldManagement } from '../../core/use-cases/client/CustomFieldManagement';
import { CustomFieldRepository } from '../../infrastructure/repositories/CustomFieldRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const customFieldRepository = new CustomFieldRepository();
const customFieldManagementUseCase = new CustomFieldManagement(customFieldRepository);

export class CustomFieldController {
    async getCustomFields(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.clientId) {
                res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
                return;
            }

            const includeInactive = req.query.includeInactive === 'true';
            const customFields = await customFieldManagementUseCase.getCustomFields(req.user.clientId, includeInactive);

            res.json({ data: customFields });
        } catch (error) {
            console.error('Error fetching custom fields:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }
}
