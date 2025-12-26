import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ContactManagement } from '../../core/use-cases/client/ContactManagement';
import { ContactRepository } from '../../infrastructure/repositories/ContactRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import { BulkContactUpload } from '../../core/use-cases/client/BulkContactUpload';

const contactRepository = new ContactRepository();
const contactManagementUseCase = new ContactManagement(contactRepository);
const bulkContactUploadUseCase = new BulkContactUpload(contactRepository);

export class ContactController {
  async createContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      if (!req.user?.id) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID is missing' });
        return;
      }
      const contact = await contactManagementUseCase.create(req.body, req.user.clientId, req.user.id);
      res.status(StatusCodes.CREATED).json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getContacts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const contacts = await contactManagementUseCase.findAll(req.user.clientId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getContactById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const contact = await contactManagementUseCase.findById(req.params.id, req.user.clientId);
      if (!contact) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Contact not found' });
        return;
      }

      // Transform customFieldValues to normalized structure
      const customFields: Record<string, any> = {};
      if ((contact as any).customFieldValues) {
        (contact as any).customFieldValues.forEach((cfv: any) => {
          customFields[cfv.customFieldId] = {
            id: cfv.id,
            value: cfv.value,
            customFieldId: cfv.customFieldId,
            fieldKey: cfv.customField?.fieldKey,
            name: cfv.customField?.name,
            type: cfv.customField?.type,
            isRequired: cfv.customField?.isRequired,
            options: cfv.customField?.options,
            helpText: cfv.customField?.helpText
          };
        });
      }

      // Remove raw customFieldValues and add normalized customFields
      const { customFieldValues, ...contactData } = contact as any;

      res.json({ ...contactData, customFields });
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const contact = await contactManagementUseCase.update(req.params.id, req.body, req.user.clientId);
      if (!contact) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Contact not found' });
        return;
      }
      res.json(contact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const contact = await contactManagementUseCase.delete(req.params.id, req.user.clientId);
      if (!contact) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Contact not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async bulkUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      if (!req.user?.id) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID is missing' });
        return;
      }
      if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'File is missing' });
        return;
      }
      await bulkContactUploadUseCase.execute(req.file.path, req.user.clientId, req.user.id);
      res.status(StatusCodes.OK).json({ message: 'Contacts uploaded successfully' });
    } catch (error) {
      console.error('Error uploading contacts:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
