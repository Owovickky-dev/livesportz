import { z } from "zod";

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: "limit must be an integer" })
    .positive({ message: "limit must be positive" })
    .max(100, { message: "limit must be at most 100" })
    .optional(),
});

export const createCommentarySchema = z.object({
  minute: z.coerce
    .number()
    .int({ message: "minute must be an integer" })
    .min(0, { message: "minute must be non-negative" }),
  sequence: z.coerce.number().int({ message: "sequence must be an integer" }),
  period: z.string().min(1, "period is required"),
  eventType: z.string().min(1, "eventType is required"),
  actor: z.string().min(1, "actor is required"),
  team: z.string().optional(),
  message: z.string().min(1, "message is required"),
  metaData: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});
