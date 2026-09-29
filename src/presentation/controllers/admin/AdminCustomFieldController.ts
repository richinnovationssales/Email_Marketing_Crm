import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middlewares/authMiddleware';
import prisma from '../../../infrastructure/database/prisma';

export class AdminCustomFieldController {
    /**
     * PATCH /admin/clients/:clientId/custom-fields/:fieldId/set-name-field
     * Body: { isNameField: boolean }
     *
     * Sets or clears the isNameField flag for a custom field that belongs to the client.
     * Only one custom field per client may have isNameField = true at a time.
     * Setting true automatically clears it from any previously set field.
     */
    async setNameField(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { clientId, fieldId } = req.params;
            const { isNameField } = req.body;

            if (typeof isNameField !== 'boolean') {
                res.status(StatusCodes.BAD_REQUEST).json({ message: 'isNameField must be a boolean' });
                return;
            }

            // Verify client exists
            const client = await prisma.client.findUnique({ where: { id: clientId } });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }

            // Verify the custom field belongs to this client
            const field = await prisma.customField.findFirst({
                where: { id: fieldId, clientId },
            });
            if (!field) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Custom field not found for this client' });
                return;
            }

            await prisma.customField.update({
                where: { id: fieldId },
                data: { isNameField },
            });

            const updated = await prisma.customField.findUnique({ where: { id: fieldId } });
            res.json({ message: `isNameField ${isNameField ? 'set' : 'cleared'} successfully`, data: updated });
        } catch (error) {
            console.error('Error setting name field:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    /**
     * GET /admin/clients/:clientId/custom-fields
     * Returns all custom fields for the client (including inactive, for admin view).
     */
    async getClientCustomFields(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { clientId } = req.params;

            const client = await prisma.client.findUnique({ where: { id: clientId } });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }

            const fields = await prisma.customField.findMany({
                where: { clientId },
                orderBy: { displayOrder: 'asc' },
            });

            res.json({ data: fields });
        } catch (error) {
            console.error('Error fetching client custom fields:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }
}
