import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  MATCH_STATUS,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utilities/match-status.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      error: "Invalid query",
      message: errors,
    });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    res.json({ nosOfMatches: data.length, matches: data });
  } catch (error) {
    console.error("Error listing matches:", error);
    res.status(500).json({
      error: "Failed to list matches",
      message: error.message || "Internal server error",
    });
  }
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      error: "Invalid Payload",
      message: errors,
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime) || MATCH_STATUS.SCHEDULED,
      })
      .returning();

    if (!event) {
      throw new Error("Failed to create match");
    }

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }

    res.status(201).json({ data: event });
  } catch (error) {
    console.error("Error creating match:", error);
    res.status(500).json({
      error: "Failed to create match",
      message: error.message || "Internal server error",
    });
  }
});
