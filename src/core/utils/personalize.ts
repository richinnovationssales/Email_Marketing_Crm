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
  // Custom fields seed the map first; built-in contact columns then override
  // when they have a value. An empty/null column must NOT clobber a populated
  // custom-field entry — some tenants store firstName/lastName only as custom
  // fields (with isNameField=true) and never populate Contact.firstName/lastName.
  const valueMap: Record<string, string> = {};
  for (const cfv of customFieldValues) {
    valueMap[cfv.customField.fieldKey] = cfv.value;
  }
  if (contact) {
    if (contact.firstName) valueMap.firstName = contact.firstName;
    if (contact.lastName) valueMap.lastName = contact.lastName;
    if (contact.email) valueMap.email = contact.email;
    const resolvedFirst = valueMap.firstName ?? '';
    const resolvedLast = valueMap.lastName ?? '';
    valueMap.fullName = `${resolvedFirst} ${resolvedLast}`.trim();
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
