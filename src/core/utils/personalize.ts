/**
 * Replaces {{fieldKey}} placeholders in content with the contact's actual
 * custom field value. Unmatched placeholders are replaced with "" so recipients
 * never see raw placeholder syntax. Used for SMTP (Nodemailer) per-contact sending.
 */
export function personalizeContent(
  content: string,
  customFieldValues: Array<{ value: string; customField: { fieldKey: string } }>
): string {
  const valueMap: Record<string, string> = {};
  for (const cfv of customFieldValues) {
    valueMap[cfv.customField.fieldKey] = cfv.value;
  }
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => valueMap[key] ?? '');
}

/**
 * Extracts all {{fieldKey}} placeholder keys used in the content.
 */
export function extractPlaceholderKeys(content: string): string[] {
  return [...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
}

/**
 * Converts {{fieldKey}} placeholders to Mailgun's %recipient.fieldKey% syntax.
 * Call this once on the campaign content before passing to MailgunService.
 */
export function convertPlaceholdersToMailgun(content: string): string {
  return content.replace(/\{\{(\w+)\}\}/g, '%recipient.$1%');
}
