import { z } from 'zod';

export const createPlanSchema = z.object({
    name: z.string().min(1, 'Plan name is required').max(255, 'Plan name must be less than 255 characters'),
    price: z.number().min(0, 'Price must be a positive number'),
    emailLimit: z.number().int().min(1, 'Email limit must be at least 1')
});

export const updatePlanSchema = z.object({
    name: z.string().min(1, 'Plan name is required').max(255, 'Plan name must be less than 255 characters').optional(),
    price: z.number().min(0, 'Price must be a positive number').optional(),
    emailLimit: z.number().int().min(1, 'Email limit must be at least 1').optional()
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
