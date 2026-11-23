import { z } from 'zod';

// Formato na borda; invariantes de verdade (trim, caixa do email...) ficam no domínio.
const name = z.string().trim().min(1).max(120);

export const userId = z.guid();

export const registerSchema = z.object({
  name,
  email: z.email(),
  password: z.string().min(8).max(72),
});
export const updateSchema = z.object({ name });
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export type RegisterBody = z.infer<typeof registerSchema>;
export type UpdateBody = z.infer<typeof updateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
