import { z } from 'zod';

export const createBranchAccountSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Branch ID or Code is required' }),
  }),
  body: z.object({
    loginId: z
      .string({ required_error: 'Login ID is required' })
      .trim()
      .min(3, 'Login ID must be at least 3 characters')
      .toLowerCase(),
    name: z.string({ required_error: 'Account name is required' }).trim().min(2),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters'),
    email: z.string().email().optional(),
  }),
});

export const updateBranchAccountSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Branch ID or Code is required' }),
  }),
  body: z.object({
    loginId: z.string().trim().min(3).toLowerCase().optional(),
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Branch ID or Code is required' }),
  }),
  body: z.object({
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(6, 'Password must be at least 6 characters'),
  }),
});

export const updatePermissionsSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Branch ID or Code is required' }),
  }),
  body: z.object({
    permissions: z.record(z.boolean()),
  }),
});

export const branchParamSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Branch ID or Code is required' }),
  }),
});

export type CreateBranchAccountInput = z.infer<typeof createBranchAccountSchema>['body'];
export type UpdateBranchAccountInput = z.infer<typeof updateBranchAccountSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>['body'];

