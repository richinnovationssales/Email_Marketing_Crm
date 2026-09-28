// src/core/use-cases/client/BulkContactUpload.ts
import { ContactRepository } from "../../../infrastructure/repositories/ContactRepository";
import { CustomFieldRepository } from "../../../infrastructure/repositories/CustomFieldRepository";
import { CustomFieldValidator } from "../../services/CustomFieldValidator";
import { CustomField, CustomFieldType } from "../../entities/CustomField";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import * as excel from "exceljs";

export interface BulkUploadRowError {
  row: number; // Row number as seen in Excel/CSV (header is row 1)
  email: string | null;
  reason: string;
}

export interface BulkUploadResult {
  total: number;
  success: number;
  failed: number;
  errors: BulkUploadRowError[];
  warnings: string[];
}

interface ParsedRow {
  row: number;
  data: Record<string, any>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_HEADER = "email";

// "First Name", "first_name", "firstName" all normalize to "firstname"
const normalizeHeader = (header: string): string =>
  header.replace(/^﻿/, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export class BulkContactUpload {
  private customFieldValidator: CustomFieldValidator;
  private customFieldRepository: CustomFieldRepository;

  constructor(private contactRepository: ContactRepository) {
    this.customFieldValidator = new CustomFieldValidator();
    this.customFieldRepository = new CustomFieldRepository();
  }

  async execute(
    filePath: string,
    originalName: string,
    clientId: string,
    userId: string,
    groupId?: string
  ): Promise<BulkUploadResult> {
    const logPrefix = `[BulkContactUpload client=${clientId} file="${originalName}"]`;

    try {
      const rows = await this.readRows(filePath, originalName);
      const customFields = await this.customFieldRepository.findAllByClient(clientId);
      const headers = rows.length > 0 ? Object.keys(rows[0].data) : [];
      const { headerMap, warnings } = this.buildHeaderMap(headers, customFields);

      console.log(
        `${logPrefix} Parsed ${rows.length} data rows. Headers: ${JSON.stringify(headers)}. ` +
          `Mapped: ${JSON.stringify(headerMap)}`
      );
      warnings.forEach((w) => console.warn(`${logPrefix} WARNING: ${w}`));

      const errors: BulkUploadRowError[] = [];
      const seenEmails = new Set<string>();
      let successCount = 0;

      for (const { row, data } of rows) {
        const mapped = this.mapRow(data, headerMap, customFields);
        const email = mapped[EMAIL_HEADER] ? String(mapped[EMAIL_HEADER]).trim().toLowerCase() : null;

        const fail = (reason: string) => {
          errors.push({ row, email, reason });
          console.warn(`${logPrefix} Row ${row} skipped (email=${email ?? "<empty>"}): ${reason}`);
        };

        if (!email) {
          fail(`Missing email. Make sure the file has an "${EMAIL_HEADER}" column and this row has a value.`);
          continue;
        }
        if (!EMAIL_REGEX.test(email)) {
          fail(`Invalid email format: "${email}"`);
          continue;
        }
        if (seenEmails.has(email)) {
          fail("Duplicate email within the uploaded file");
          continue;
        }
        seenEmails.add(email);

        try {
          const { [EMAIL_HEADER]: _email, ...customFieldData } = mapped;
          const validatedCustomFields = await this.customFieldValidator.validate(clientId, customFieldData);

          await this.contactRepository.create(
            { email, customFields: validatedCustomFields },
            clientId,
            userId,
            groupId
          );
          successCount++;
        } catch (error: any) {
          fail(this.describeError(error));
        }
      }

      console.log(
        `${logPrefix} Completed: total=${rows.length}, created=${successCount}, skipped=${errors.length}`
      );

      return {
        total: rows.length,
        success: successCount,
        failed: errors.length,
        errors,
        warnings,
      };
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Clean up the uploaded file
      }
    }
  }

  private async readRows(filePath: string, originalName: string): Promise<ParsedRow[]> {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === ".xlsx") return this.readXlsx(filePath);
    if (ext === ".csv") return this.readCsv(filePath);
    if (ext === ".xls") {
      throw new BulkUploadFileError(
        'Legacy .xls files are not supported. Please save the file as .xlsx or .csv and upload again.'
      );
    }
    throw new BulkUploadFileError(`Unsupported file type "${ext || "unknown"}". Please upload a .xlsx or .csv file.`);
  }

  private async readXlsx(filePath: string): Promise<ParsedRow[]> {
    const workbook = new excel.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (error) {
      throw new BulkUploadFileError("Could not read the Excel file. It may be corrupted or not a real .xlsx file.");
    }

    // Use the "Contacts" sheet from our template if present, otherwise the first sheet
    const worksheet = workbook.getWorksheet("Contacts") ?? workbook.worksheets[0];
    if (!worksheet) throw new BulkUploadFileError("The Excel file has no worksheets.");

    const headers: string[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = this.cellToString(cell.value).trim();
    });

    const rows: ParsedRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const data: Record<string, any> = {};
      headers.forEach((header, colNumber) => {
        if (header) data[header] = this.cellToString(row.getCell(colNumber).value).trim();
      });
      if (Object.values(data).some((v) => v !== "")) rows.push({ row: rowNumber, data });
    });
    return rows;
  }

  private readCsv(filePath: string): Promise<ParsedRow[]> {
    return new Promise((resolve, reject) => {
      const rows: ParsedRow[] = [];
      let rowNumber = 1; // header row
      fs.createReadStream(filePath)
        .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^﻿/, "").trim() }))
        .on("data", (data: Record<string, any>) => {
          rowNumber++;
          const trimmed: Record<string, any> = {};
          Object.entries(data).forEach(([k, v]) => (trimmed[k] = typeof v === "string" ? v.trim() : v));
          if (Object.values(trimmed).some((v) => v !== "" && v !== undefined)) {
            rows.push({ row: rowNumber, data: trimmed });
          }
        })
        .on("end", () => resolve(rows))
        .on("error", reject);
    });
  }

  // Excel cells can hold hyperlinks (auto-linked emails), rich text, formulas and dates
  private cellToString(value: excel.CellValue): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    if (typeof value === "object") {
      if ("text" in value && typeof value.text === "string") return value.text; // hyperlink
      if ("richText" in value) return value.richText.map((t) => t.text).join("");
      if ("result" in value) return this.cellToString(value.result as excel.CellValue); // formula
      if ("error" in value) return "";
    }
    return String(value);
  }

  private buildHeaderMap(
    headers: string[],
    customFields: CustomField[]
  ): { headerMap: Record<string, string>; warnings: string[] } {
    const lookup = new Map<string, string>();
    lookup.set(normalizeHeader(EMAIL_HEADER), EMAIL_HEADER);
    lookup.set("emailaddress", EMAIL_HEADER);
    for (const field of customFields) {
      lookup.set(normalizeHeader(field.fieldKey), field.fieldKey);
      lookup.set(normalizeHeader(field.name), field.fieldKey);
    }

    const headerMap: Record<string, string> = {};
    const unknown: string[] = [];
    for (const header of headers) {
      const key = lookup.get(normalizeHeader(header));
      if (key) headerMap[header] = key;
      else unknown.push(header);
    }

    const warnings: string[] = [];
    if (headers.length === 0) {
      warnings.push("The file has no data rows.");
      return { headerMap, warnings };
    }
    if (unknown.length > 0) {
      warnings.push(`Ignored columns that don't match any contact field: ${unknown.join(", ")}`);
    }
    const mappedKeys = new Set(Object.values(headerMap));
    if (!mappedKeys.has(EMAIL_HEADER)) {
      warnings.push(`Missing required column "${EMAIL_HEADER}". Every row will be skipped.`);
    }
    const missingRequired = customFields.filter(
      (f) => (f.isRequired || f.isNameField) && !mappedKeys.has(f.fieldKey)
    );
    if (missingRequired.length > 0) {
      warnings.push(
        `Missing required column(s): ${missingRequired.map((f) => `${f.name} (${f.fieldKey})`).join(", ")}. ` +
          "Every row will be skipped."
      );
    }
    return { headerMap, warnings };
  }

  private mapRow(
    data: Record<string, any>,
    headerMap: Record<string, string>,
    customFields: CustomField[]
  ): Record<string, any> {
    const mapped: Record<string, any> = {};
    for (const [header, value] of Object.entries(data)) {
      const key = headerMap[header];
      if (!key || value === "" || value === undefined) continue;
      mapped[key] = value;
    }

    // Normalize values that spreadsheets commonly format differently
    for (const field of customFields) {
      const value = mapped[field.fieldKey];
      if (value === undefined) continue;
      if (field.type === CustomFieldType.BOOLEAN) {
        const v = String(value).toLowerCase();
        if (["true", "yes", "y", "1"].includes(v)) mapped[field.fieldKey] = "true";
        else if (["false", "no", "n", "0"].includes(v)) mapped[field.fieldKey] = "false";
      } else if (field.type === CustomFieldType.MULTISELECT) {
        mapped[field.fieldKey] = String(value).split(",").map((v) => v.trim()).filter(Boolean);
      }
    }
    return mapped;
  }

  private describeError(error: any): string {
    if (error?.code === "P2002") return "A contact with this email already exists";
    if (error?.code?.startsWith?.("P")) return `Database error (${error.code})`;
    return error?.message || "Unknown error";
  }
}

export class BulkUploadFileError extends Error {}
