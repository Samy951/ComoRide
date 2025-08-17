import { z } from 'zod';

export const verifySchema = z.object({
  phoneNumber: z.string().regex(/^\+269[36]\d{6}$/, {
    message: "Format de numéro invalide. Utilisez +269XXXXXXX"
  })
});

export type VerifyRequest = z.infer<typeof verifySchema>;