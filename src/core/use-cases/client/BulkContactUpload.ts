import { ContactRepository } from '../../../infrastructure/repositories/ContactRepository';
import * as fs from 'fs';
import csv from 'csv-parser';

export class BulkContactUpload {
  constructor(private contactRepository: ContactRepository) { }

  async execute(filePath: string, clientId: string): Promise<void> {
    const contacts: any[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => contacts.push(data))
        .on('end', async () => {
          for (const contact of contacts) {
            // Assuming the CSV has 'email', 'firstName', and 'lastName' columns
            await this.contactRepository.create(contact, clientId);
          }
          fs.unlinkSync(filePath); // Clean up the uploaded file
          resolve();
        })
        .on('error', (error: any) => {
          fs.unlinkSync(filePath); // Clean up the uploaded file
          reject(error);
        });
    });
  }
}
