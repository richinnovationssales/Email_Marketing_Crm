import { ContactRepository } from '../../../infrastructure/repositories/ContactRepository';
import { CustomFieldValidator } from '../../services/CustomFieldValidator';
import * as fs from 'fs';
import csv from 'csv-parser';

export class BulkContactUpload {
  private customFieldValidator: CustomFieldValidator;

  constructor(private contactRepository: ContactRepository) {
    this.customFieldValidator = new CustomFieldValidator();
  }

  async execute(filePath: string, clientId: string, userId: string, groupId?: string): Promise<{ success: number; failed: number }> {
    const contacts: any[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => contacts.push(data))
        .on('end', async () => {
          let successCount = 0;
          let failureCount = 0;

          for (const contactData of contacts) {
            try {
              // Separate standard fields from potential custom fields
              // This is a naive separation assuming standard fields are known.
              // In reality, we might look up what keys are NOT standard.
              // For now, let's extract standard fields explicitly.
              const { email, firstName, lastName, ...rest } = contactData;

              if (!email) {
                failureCount++;
                continue;
              }

              // Validate custom fields (the rest)
              // We pass 'rest' as potential custom fields
              const validatedCustomFields = await this.customFieldValidator.validate(clientId, rest);

              await this.contactRepository.create({
                id: '', // Will be generated
                clientId,
                email,
                firstName,
                lastName,
                createdAt: new Date(),
                updatedAt: new Date(),
                customFields: validatedCustomFields
              }, clientId, userId, groupId);

              successCount++;
            } catch (error) {
              console.error(`Skipping contact ${contactData.email} due to validation error:`, error);
              failureCount++;
            }
          }

          fs.unlinkSync(filePath); // Clean up the uploaded file
          resolve({ success: successCount, failed: failureCount });
        })
        .on('error', (error: any) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        });
    });
  }
}
