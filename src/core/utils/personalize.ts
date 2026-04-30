interface ContactBuiltins {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replaces {{fieldKey}} placeholders in content with the contact's actual values.
 * Resolution order: built-in contact fields (firstName, lastName, fullName, email)
 * → custom field values by fieldKey → empty string. Substituted values are
 * HTML-escaped so user-supplied content can't inject markup. Used for SMTP
 * (Nodemailer) per-contact sending.
 */
export function personalizeContent(
  content: string,
  customFieldValues: Array<{ value: string; customField: { fieldKey: string } }>,
  contact?: ContactBuiltins
): string {
  // Custom fields seed the map first; built-in greeting tokens then override
  // so e.g. {{firstName}} always resolves from the contact's actual column,
  // not a custom field that happens to share the key.
  const valueMap: Record<string, string> = {};
  for (const cfv of customFieldValues) {
    valueMap[cfv.customField.fieldKey] = cfv.value;
  }
  if (contact) {
    const firstName = contact.firstName ?? '';
    const lastName = contact.lastName ?? '';
    valueMap.firstName = firstName;
    valueMap.lastName = lastName;
    valueMap.fullName = `${firstName} ${lastName}`.trim();
    valueMap.email = contact.email ?? '';
  }
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(valueMap[key] ?? ''));
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

/**
 * Wraps a greeting template (plain text from admin) in a paragraph tag and
 * prepends it to the campaign body. The template is HTML-escaped before
 * wrapping so admin-supplied chars like `<` can't inject markup. Tokens
 * `{{fieldKey}}` survive escapeHtml unchanged (they contain only word
 * chars and braces) and flow through the same personalization pipeline
 * as the body.
 */
export function prependGreeting(content: string, greetingTemplate?: string | null): string {
  if (!greetingTemplate || !greetingTemplate.trim()) {
    return content;
  }
  return `<p>${escapeHtml(greetingTemplate.trim())}</p>\n${content}`;
}
