import { ROLES } from '@rc/contracts';
import { z } from 'zod';

export const userSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    role: z.enum(ROLES),
  })
  .meta({ id: 'UserSummary' });

export type UserSummary = z.infer<typeof userSummarySchema>;

export function toUserSummary(user: {
  id: number;
  name: string;
  email: string;
  role: (typeof ROLES)[number];
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
