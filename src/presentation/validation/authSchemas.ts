import { z } from 'zod';
import { emailSchema, passwordSchema } from './commonSchemas';

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    clientId: z.string().cuid(),
    role: z.enum(['CLIENT_SUPER_ADMIN', 'CLIENT_ADMIN', 'CLIENT_USER']).optional(),
});

export const superAdminLoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
});
