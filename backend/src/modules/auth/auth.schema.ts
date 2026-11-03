import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    loginId: z
      .string({ required_error: 'Login ID is required' })
      .trim()
      .min(3, 'Login ID must be at least 3 characters'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(4, 'Password must be at least 4 characters'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(6, 'New password must be at least 6 characters'),
  }),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
