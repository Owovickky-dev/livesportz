import { z } from "zod";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

export const listMatchesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: "limit must be an integer" })
    .positive({ message: "limit must be positive" })
    .max(100, { message: "limit must be at most 100" })
    .optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int({ message: "id must be an integer" })
    .positive({ message: "id must be positive" }),
});

const parseToIsoString = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  return undefined;
};

export const createMatchSchema = z
  .object({
    sport: z.string().min(1, "sport is required"),
    homeTeam: z.string().min(1, "homeTeam is required"),
    awayTeam: z.string().min(1, "awayTeam is required"),
    startTime: z
      .preprocess((val) => parseToIsoString(val) || val, z.string())
      .refine((val) => {
        const date = new Date(val);
        return !Number.isNaN(date.getTime());
      }, "startTime must be a valid date"),
    endTime: z
      .preprocess((val) => parseToIsoString(val) || val, z.string())
      .refine((val) => {
        const date = new Date(val);
        return !Number.isNaN(date.getTime());
      }, "endTime must be a valid date"),
    homeScore: z.coerce
      .number()
      .int({ message: "homeScore must be an integer" })
      .min(0, { message: "homeScore must be non-negative" })
      .optional(),
    awayScore: z.coerce
      .number()
      .int({ message: "awayScore must be an integer" })
      .min(0, { message: "awayScore must be non-negative" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startTime).getTime();
    const end = new Date(data.endTime).getTime();
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be after startTime",
        path: ["endTime"],
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce
    .number()
    .int({ message: "homeScore must be an integer" })
    .min(0, { message: "homeScore must be non-negative" }),
  awayScore: z.coerce
    .number()
    .int({ message: "awayScore must be an integer" })
    .min(0, { message: "awayScore must be non-negative" }),
});
