import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema } from "../validation/commentary.js";
import { listCommentaryQuerySchema } from "../validation/commentary.js";
import { eq, desc } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
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

  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    const errors = queryParsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      error: "Invalid query",
      message: errors,
    });
  }

  const { id: matchId } = paramParsed.data;
  const limit = queryParsed.data.limit ?? 100;

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ nosOfCommentaries: data.length, commentaries: data });
  } catch (error) {
    console.error("Error listing commentaries:", error);
    res.status(500).json({
      error: "Failed to list commentaries",
      message: error.message || "Internal server error",
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
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
  const commentaryData = { ...bodyParsed.data, matchId };

  try {
    const [result] = await db
      .insert(commentary)
      .values(commentaryData)
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(matchId, result);
    }

    if (!result) {
      throw new Error("Failed to create commentary");
    }

    if (res.app.locals.broadcastCommentary) {
      try {
        res.app.locals.broadcastCommentary(matchId, result);
      } catch (broadcastError) {
        console.error(
          "Error broadcasting commentary created event:",
          broadcastError,
        );
      }
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
