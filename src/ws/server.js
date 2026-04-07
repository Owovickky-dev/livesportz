import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscriber = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscriber.has(matchId)) {
    matchSubscriber.set(matchId, new Set());
  }
  matchSubscriber.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscriber.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscriber.delete(matchId);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscriber.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function cleanupSubscription(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(socket, {
      type: "error",
      message: error.message,
    });
    return;
  }

  console.log("Received message:", message);

  if (
    (message?.type === "subscribe" || message?.type === "subscibe") &&
    Number.isInteger(message.matchId)
  ) {
    subscribe(message.matchId, socket);
    socket.subscriptions.add(message.matchId);
    sendJson(socket, {
      type: "subscribed",
      matchId: message.matchId,
    });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, {
      type: "unsubscribed",
      matchId: message.matchId,
    });
    return;
  }

  sendJson(socket, {
    type: "error",
    message: "Unknown message type",
  });
}

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

    socket.subscriptions = new Set();

    sendJson(socket, {
      type: "Welcome",
      message: "Connected to LiveSportz WebSocket",
    });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });

    socket.on("error", (data) => {
      socket.terminate();
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("close", () => {
      console.log("WebSocket client disconnected");
      cleanupSubscription(socket);
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

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, {
      type: "commentary",
      data: comment,
    });
  }

  return {
    broadcastMatchCreated,
    broadcastCommentary,
  };
}
