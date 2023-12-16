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

  io.use((socket, next) => {
    const name = socket.handshake.auth.user.name;
    const profilePic = socket.handshake.auth.user.profile_picture;
    const id = socket.handshake.auth.user.id;
    socket.name = name;
    socket.profilePic = profilePic;
    socket.userId = id;
    next();
  });

  io.on("connection", (socket) => {
    const users = [];
    for (let [id, socket] of io.of("/").sockets) {
      users.push({
        userId: socket.userId,
        name: socket.name,
        profilePic: socket.profilePic,
        socketId: id,
        key: id,
      });
    }

    socket.emit("users", users);

    socket.broadcast.emit("user_connected", {
      userId: socket.userId,
      name: socket.name,
      profilePic: socket.profilePic,
      socketId: socket.id,
      key: socket.id,
      self: false,
    });

    socket.on("private_message", ({ content, to }) => {
      console.log("Content:", content, " To:", to);
      socket.to(to).emit("private message", {
        content,
        from: socket.id,
      });
    });
  });
};
