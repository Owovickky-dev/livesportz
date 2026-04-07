import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      console.error("WebSocket broadcast error for client:", err);
      client.terminate();
    }
  }
}

export function attachWebSocketServer(server, options = {}) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1MB max message
  });

  wss.on("connection", async (socket, req) => {
    if (wsArcjet) {
      try {
        const allowExecution = await wsArcjet.protect(req);

        if (allowExecution.isDenied()) {
          const code = allowExecution.reason.isRateLimit() ? 1013 : 1008;
          const reason = allowExecution.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Forbidden";
          socket.close(code, reason);
          return;
        }
      } catch (error) {
        console.error("WS Connection Error", error);
        socket.close(1011, "Server security error");
        return;
      }
    }

    socket.isAlive = true;

    sendJson(socket, {
      type: "Welcome",
      message: "Connected to LiveSportz WebSocket",
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    socket.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  function broadcastMatchCreated(match) {
    broadcast(wss, {
      type: "match_created",
      data: match,
    });
  }

  return {
    broadcastMatchCreated,
  };
}
