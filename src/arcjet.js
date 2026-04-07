import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) throw new Error("ARCJET_KEY is not defined");

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
      const allowExcution = await httpArcjet.protect(req);

      if (allowExcution.isDenied()) {
        if (allowExcution.reason.isRateLimit()) {
          return res.status(429).json({ error: "Rate limit exceeded" });
        }
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (error) {
      console.error("Arcjet Middelware ersror:", error);
      return res.status(503).json({ error: "Arcjet error" });
    }

    next();
  };
}

// export function securityMiddleware() {
//   return async (req, res, next) => {
//     if (!httpArcjet) return next();

//     try {
//       const result = await httpArcjet.protect(req);

//       // Debug logging to see what's happening
//       console.log({
//         isDenied: result.isDenied,
//         reason: result.reason,
//         remaining: result.remaining,
//       });

//       // ✅ Fixed: properties, not functions
//       if (result.isDenied) {
//         if (result.reason.isRateLimit) {
//           console.log(`❌ Rate limit hit! ${result.remaining || 0} remaining`);
//           return res.status(429).json({ error: "Rate limit exceeded" });
//         }
//         console.log(`❌ Blocked by: ${result.reason}`);
//         return res.status(403).json({ error: "Forbidden" });
//       }

//       console.log(`✅ Allowed. ${result.remaining} requests left in window`);
//       next();
//     } catch (error) {
//       console.error("Arcjet Middleware error:", error);
//       return res.status(503).json({ error: "Arcjet error" });
//     }
//   };
// }
