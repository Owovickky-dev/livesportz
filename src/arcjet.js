import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) {
  console.warn("ARCJET_KEY is not defined - security middleware disabled");
}

export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({
          mode: arcjetMode,
        }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({
          mode: arcjetMode,
          interval: "10s",
          max: 50,
        }),
      ],
    })
  : null;

export const wsArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({
          mode: arcjetMode,
        }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({
          mode: arcjetMode,

          interval: "2s",
          max: 5,
        }),
      ],
    })
  : null;

export function securityMiddleware() {
  return async (req, res, next) => {
    if (!httpArcjet) return next();

    try {
      const allowExecution = await httpArcjet.protect(req);

      if (allowExecution.isDenied()) {
        if (allowExecution.reason.isRateLimit()) {
          return res.status(429).json({ error: "Rate limit exceeded" });
        }
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (error) {
      console.error("Arcjet Middelware error:", error);
      return res.status(503).json({ error: "Arcjet error" });
    }

    next();
  };
}
