import http from "http";
import https from "https";
import { Server } from "socket.io";

export const socketInit = (app, options, SOCKET, NODE_ENV) => {
  const protocol = NODE_ENV === "prod" ? https : http;

  const server = protocol.createServer(options, app).listen(SOCKET, () => {
    console.log(
      `\n[SERVER LOG] SOCKET\n[SERVER LOG] Is running on port ${SOCKET}\n`
    );
  });

  const io = new Server(server, {
    cors: {
      origin:
        NODE_ENV === "prod"
          ? ["https://social-demo-app.vercel.app"]
          : ["http://localhost:3000"],
      methods: ["GET", "POST"],
    },
  });

  let onlineUsers = [];

  io.on("connection", (socket) => {
    socket.on("user_connection", ({ id, name, profile_picture }) => {
      if (!onlineUsers.some((user) => user.id === id)) {
        onlineUsers.push({
          socketId: socket.id,
          id,
          profile_picture,
          name,
        });
      }
      io.emit("get_online_users", onlineUsers);
    });

    socket.on("user_logout", () => {
      onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
      io.emit("get_online_users", onlineUsers);
    });

    socket.on("disconnect", () => {
      onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
      io.emit("get_online_users", onlineUsers);
    });
  });
};
