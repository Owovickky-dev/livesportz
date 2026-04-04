import { WebSocket, WebSocketServer } from "ws";

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
  const expectedToken = options.authToken ?? process.env.WS_AUTH_TOKEN;

  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1MB max message
    verifyClient: ({ req }) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
      const token = authHeader.slice("Bearer ".length).trim();
      if (!token) return false;
      return !expectedToken || token === expectedToken;
    },
  });

  wss.on("connection", (socket) => {
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
