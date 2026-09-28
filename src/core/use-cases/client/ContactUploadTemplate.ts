// src/core/use-cases/client/ContactUploadTemplate.ts
import * as excel from "exceljs";
import { CustomFieldRepository } from "../../../infrastructure/repositories/CustomFieldRepository";
import { CustomField, CustomFieldType } from "../../entities/CustomField";

const VALIDATION_ROWS = 1000; // Rows that get dropdowns for SELECT/BOOLEAN columns

const SAMPLE_VALUES: Record<CustomFieldType, string> = {
  [CustomFieldType.TEXT]: "Sample text",
  [CustomFieldType.TEXTAREA]: "Longer sample text",
  [CustomFieldType.NUMBER]: "42",
  [CustomFieldType.EMAIL]: "other@example.com",
  [CustomFieldType.PHONE]: "+1 555 123 4567",
  [CustomFieldType.DATE]: "2026-01-31",
  [CustomFieldType.BOOLEAN]: "true",
  [CustomFieldType.URL]: "https://example.com",
  [CustomFieldType.SELECT]: "",
  [CustomFieldType.MULTISELECT]: "",
};

const FORMAT_HINTS: Record<CustomFieldType, string> = {
  [CustomFieldType.TEXT]: "Any text",
  [CustomFieldType.TEXTAREA]: "Any text",
  [CustomFieldType.NUMBER]: "Number only, e.g. 42 or 3.5",
  [CustomFieldType.EMAIL]: "Valid email address",
  [CustomFieldType.PHONE]: "Phone number",
  [CustomFieldType.DATE]: "Date in YYYY-MM-DD format (or an Excel date cell)",
  [CustomFieldType.BOOLEAN]: "true / false (yes / no also accepted)",
  [CustomFieldType.URL]: "Full URL including https://",
  [CustomFieldType.SELECT]: "Exactly one of the allowed values",
  [CustomFieldType.MULTISELECT]: "One or more allowed values, separated by commas",
};

export class ContactUploadTemplate {
  private customFieldRepository = new CustomFieldRepository();

  async generate(clientId: string): Promise<excel.Workbook> {
    const customFields = await this.customFieldRepository.findAllByClient(clientId);

    const workbook = new excel.Workbook();
    const sheet = workbook.addWorksheet("Contacts");
    const instructions = workbook.addWorksheet("Instructions");

    // --- Contacts sheet: header row + one sample row ---
    const columns = [
      { header: "email", key: "email", width: 30 },
      ...customFields.map((f) => ({ header: f.fieldKey, key: f.fieldKey, width: Math.max(18, f.fieldKey.length + 4) })),
    ];
    sheet.columns = columns;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((cell, colNumber) => {
      const field = customFields[colNumber - 2];
      const required = colNumber === 1 || field?.isRequired || field?.isNameField;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? "FFC0392B" : "FF2C3E50" } };
      cell.note = colNumber === 1 ? "Required. Contact email address (must be unique)." : this.describeField(field);
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const sample: Record<string, string> = { email: "john.doe@example.com" };
    customFields.forEach((f) => (sample[f.fieldKey] = this.sampleValue(f)));
    const sampleRow = sheet.addRow(sample);
    sampleRow.font = { italic: true, color: { argb: "FF7F8C8D" } };

    // Text format so Excel doesn't mangle phone numbers, leading zeros, etc.
    customFields.forEach((f, i) => {
      if (f.type !== CustomFieldType.DATE && f.type !== CustomFieldType.NUMBER) {
        sheet.getColumn(i + 2).numFmt = "@";
      }
    });

    // Dropdowns for SELECT and BOOLEAN columns
    customFields.forEach((f, i) => {
      let list: string[] | null = null;
      if (f.type === CustomFieldType.SELECT) list = this.parseOptions(f);
      if (f.type === CustomFieldType.BOOLEAN) list = ["true", "false"];
      const formula = list && `"${list.join(",")}"`;
      // Excel limits inline list formulas to 255 chars; skip the dropdown if longer
      if (!formula || list!.length === 0 || formula.length > 255) return;
      for (let r = 2; r <= VALIDATION_ROWS + 1; r++) {
        sheet.getCell(r, i + 2).dataValidation = {
          type: "list",
          allowBlank: !f.isRequired,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: "Invalid value",
          error: `Choose one of: ${list!.join(", ")}`,
        };
      }
    });

    // --- Instructions sheet ---
    instructions.columns = [
      { header: "Column header", key: "column", width: 24 },
      { header: "Field name", key: "name", width: 24 },
      { header: "Type", key: "type", width: 14 },
      { header: "Required", key: "required", width: 10 },
      { header: "Format / allowed values", key: "format", width: 60 },
      { header: "Notes", key: "notes", width: 40 },
    ];
    instructions.getRow(1).font = { bold: true };
    instructions.addRow({
      column: "email",
      name: "Email",
      type: "EMAIL",
      required: "Yes",
      format: "Valid email address, unique per contact",
      notes: "Contacts whose email already exists are skipped",
    });
    customFields.forEach((f) =>
      instructions.addRow({
        column: f.fieldKey,
        name: f.name,
        type: f.type,
        required: f.isRequired || f.isNameField ? "Yes" : "No",
        format: this.formatHint(f),
        notes: [f.isNameField ? "Contact display name" : "", f.helpText ?? ""].filter(Boolean).join(". "),
      })
    );
    instructions.addRow({});
    [
      "How to use:",
      "1. Fill in contacts on the \"Contacts\" sheet, one per row. Delete the grey sample row.",
      "2. Keep the header row unchanged. Red headers are required.",
      "3. Columns not listed above are ignored.",
      "4. Save as .xlsx (or .csv) and upload. Skipped rows will be listed with the reason.",
    ].forEach((line, i) => {
      const row = instructions.addRow([line]);
      if (i === 0) row.font = { bold: true };
    });

    return workbook;
  }

  private parseOptions(field: CustomField): string[] {
    if (!field.options) return [];
    try {
      const parsed = JSON.parse(field.options);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private sampleValue(field: CustomField): string {
    if (field.isNameField) return "John Doe";
    const options = this.parseOptions(field);
    if (field.type === CustomFieldType.SELECT) return options[0] ?? "";
    if (field.type === CustomFieldType.MULTISELECT) return options.slice(0, 2).join(", ");
    return field.defaultValue ?? SAMPLE_VALUES[field.type] ?? "";
  }

  private formatHint(field: CustomField): string {
    const options = this.parseOptions(field);
    let hint = FORMAT_HINTS[field.type] ?? "Any text";
    if (options.length > 0) hint += `: ${options.join(", ")}`;
    if (field.validationRegex) hint += ` (must match pattern ${field.validationRegex})`;
    return hint;
  }

  private describeField(field?: CustomField): string {
    if (!field) return "";
    const required = field.isRequired || field.isNameField ? "Required" : "Optional";
    return `${field.name} — ${required}, ${field.type}. ${this.formatHint(field)}`;
  }
}
