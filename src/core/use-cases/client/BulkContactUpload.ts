// src/core/use-cases/client/BulkContactUpload.ts
import { ContactRepository } from "../../../infrastructure/repositories/ContactRepository";
import { CustomFieldValidator } from "../../services/CustomFieldValidator";
import * as fs from "fs";
import csv from "csv-parser";

export class BulkContactUpload {
  private customFieldValidator: CustomFieldValidator;

  constructor(private contactRepository: ContactRepository) {
    this.customFieldValidator = new CustomFieldValidator();
  }

  async execute(
    filePath: string,
    clientId: string,
    userId: string,
    groupId?: string
  ): Promise<{ success: number; failed: number }> {
    const contacts: any[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data: any) => contacts.push(data))
        .on("end", async () => {
          let successCount = 0;
          let failureCount = 0;

          for (const contactData of contacts) {
            try {
              // 1. Identify Core Fields
              const { email, ...potentialCustomFields } = contactData;

              if (!email) {
                failureCount++;
                continue;
              }

              // 2. Prepare data for creation
              // We pass everything except email as customFields.
              const customFields = { ...potentialCustomFields };

              // Validate custom fields
              const validatedCustomFields =
                await this.customFieldValidator.validate(
                  clientId,
                  customFields
                );

              await this.contactRepository.create(
                {
                  email,
                  customFields: validatedCustomFields,
                },
                clientId,
                userId,
                groupId
              );

              successCount++;
            } catch (error) {
              console.error(
                `Skipping contact ${contactData.email} due to validation error:`,
                error
              );
              failureCount++;
            }
          }

          fs.unlinkSync(filePath); // Clean up the uploaded file
          resolve({ success: successCount, failed: failureCount });
        })
        .on("error", (error: any) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(error);
        });
    });
  }
}
