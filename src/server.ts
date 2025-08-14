import express from "express";
import http from "http";
import path from "path";
import ViteExpress from "vite-express";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { lobby } from "./lobby-server/LobbyServer";

const PORT = process.env.PORT || 8000;

// create express app
const expressApp = express();

// create http server
const httpServer = http.createServer(expressApp);

// serves socket.io admin-ui
expressApp.use(
  "/admin/socket.io",
  express.static(path.join(import.meta.dirname, "../../node_modules/@socket.io/admin-ui/ui/dist")),
);

// serve client app
ViteExpress.bind(expressApp, httpServer);

// start http server
httpServer.listen(PORT, (...args) => {
  console.log(`Server running on port ${PORT}`);
});

// create socket.io server
const io = new Server(httpServer);

// match-making lobby
lobby(io);

// add socket.io admin ui
instrument(io, {
  auth: false,
  mode: "development",
});
