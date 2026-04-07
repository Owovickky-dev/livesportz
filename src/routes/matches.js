import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  MATCH_STATUS,
  matchIdParamSchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utilities/match-status.js";
import { desc } from "drizzle-orm";
import { commentary } from "../db/schema.js";
import { createCommentarySchema } from "../validation/commentary.js";

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
      try {
        res.app.locals.broadcastMatchCreated(event);
      } catch (broadcastError) {
        console.error(
          "Error broadcasting match created event:",
          broadcastError,
        );
      }
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

matchRouter.post("/:id/commentary", async (req, res) => {
  const paramParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    const errors = paramParsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      error: "Invalid parameter",
      message: errors,
    });
  }

  const bodyParsed = createCommentarySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    const errors = bodyParsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      error: "Invalid payload",
      message: errors,
    });
  }

  const { id: matchId } = paramParsed.data;
  const commentaryData = {
    ...bodyParsed.data,
    matchId,
    metadata: bodyParsed.data.metaData,
    metaData: undefined, // remove the extra field
  };

  try {
    const [result] = await db
      .insert(commentary)
      .values(commentaryData)
      .returning();

    if (!result) {
      throw new Error("Failed to create commentary");
    }

    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Error creating commentary:", error);
    res.status(500).json({
      error: "Failed to create commentary",
      message: error.message || "Internal server error",
    });
  }
});
