import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, Payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(Payload));
}

function broadCast(wss, Payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(Payload));
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket) => {
    sendJson(socket, {
      type: "Welcomes",
    });

    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match) {
    broadCast(wss, {
      type: "match_created",
      data: match,
    });
  }

  return {
    broadcastMatchCreated,
  };
}
