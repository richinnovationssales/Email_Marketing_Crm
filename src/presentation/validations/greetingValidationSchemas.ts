import { z } from 'zod';
import { findInvalidGreetingTokens, GREETING_TOKENS } from '../../core/constants/greetingTokens';

const allowedTokensMessage = `Allowed tokens: ${GREETING_TOKENS.map((t) => `{{${t}}}`).join(', ')}`;

const templateSchema = z
  .string()
  .min(1, 'Template is required')
  .max(500, 'Template must be less than 500 characters')
  .superRefine((template, ctx) => {
    const invalid = findInvalidGreetingTokens(template);
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Invalid token(s): ${invalid
          .map((t) => `{{${t}}}`)
          .join(', ')}. ${allowedTokensMessage}`,
      });
    }
  });

export const createGreetingSchema = z.object({
  name: z
    .string()
    .min(1, 'Greeting name is required')
    .max(100, 'Greeting name must be less than 100 characters'),
  template: templateSchema,
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateGreetingSchema = z.object({
  name: z
    .string()
    .min(1, 'Greeting name is required')
    .max(100, 'Greeting name must be less than 100 characters')
    .optional(),
  template: templateSchema.optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type CreateGreetingInput = z.infer<typeof createGreetingSchema>;
export type UpdateGreetingInput = z.infer<typeof updateGreetingSchema>;
