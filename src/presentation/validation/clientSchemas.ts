import { z } from 'zod';

export const createClientSchema = z.object({
    name: z.string().min(1, 'Client name is required'),
    planId: z.string().cuid(),
    planStartDate: z.string().datetime().optional(),
    planRenewalDate: z.string().datetime().optional(),
});

export const updateClientSchema = z.object({
    name: z.string().min(1).optional(),
    planId: z.string().cuid().optional(),
    planStartDate: z.string().datetime().optional(),
    planRenewalDate: z.string().datetime().optional(),
    isApproved: z.boolean().optional(),
    isActive: z.boolean().optional(),
    remainingMessages: z.number().int().min(0).optional(),
});

export const approveClientSchema = z.object({
    planStartDate: z.string().datetime().optional(),
    planRenewalDate: z.string().datetime().optional(),
});

export const rejectClientSchema = z.object({
    reason: z.string().min(1, 'Rejection reason is required'),
});

export const deactivateClientSchema = z.object({
    reason: z.string().min(1, 'Deactivation reason is required'),
});

export const clientFilterSchema = z.object({
    isApproved: z.string().optional().transform((val) => val === 'true'),
    isActive: z.string().optional().transform((val) => val === 'true'),
    planId: z.string().cuid().optional(),
});
