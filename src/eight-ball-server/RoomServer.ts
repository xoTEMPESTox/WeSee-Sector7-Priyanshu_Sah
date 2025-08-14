import { Middleware } from "polymatic";

import { type ServerBilliardContext, type Auth } from "./ServerContext";

/**
 * This runs on server and is responsible for sending data to clients, and receiving user actions from clients.
 */
export class RoomServer extends Middleware<ServerBilliardContext> {
  inactiveRoomTimeout: any;

  constructor() {
    super();
    this.on("activate", this.handleActivate);
    this.on("deactivate", this.handleDeactivate);
    this.on("frame-loop", this.handleFrameLoop);

    this.on("update", this.sendFixedObjects);

    this.on("user-enter", this.handleUserEnter);
    this.on("user-exit", this.handleUserExit);
  }

  handleActivate() {
    this.extendRoomLease();

    this.context.io.on("connection", (socket) => {
      const auth = { ...socket.handshake.auth } as Auth;

      const room = this.context.room;

      if (!room || !auth) return;

      let record = this.context.auths.find((p) => p.id === auth.id);

      if (!record) {
        record = { id: auth.id, secret: auth.secret };
        this.context.auths.push(record);
      } else if (record.secret !== auth.secret) {
        return;
      }

      let player = this.context.players.find((p) => p.id === auth.id);
      if (!player) {
        player = { id: auth.id };
        this.context.players.push(player);
      }

      this.emit("user-enter", { player });

      socket.on("cue-shot", (data) => {
        if (this.context.turn.current !== player.turn) return;
        this.emit("cue-shot", data);

        this.extendRoomLease();
      });

      this.sendFixedObjects();

      socket.on("exit-room", (data) => {
        this.context.players = this.context.players.filter((p) => p.id !== player.id);
        this.emit("user-exit", { player });
      });

      socket.on("disconnect", () => {
        this.emit("user-exit", { player });
      });
    });
  }

  handleDeactivate = () => {
    clearTimeout(this.inactiveRoomTimeout);

    const io = this.context.io;
    if (io) {
      this.context.io = null;
      io.removeAllListeners("connection");
      io.local.disconnectSockets();
      io.server._nsps.delete(io.name);
    }
  };

  extendRoomLease = () => {
    clearTimeout(this.inactiveRoomTimeout);
    this.inactiveRoomTimeout = setTimeout(this.expireRoomLease, 30 * 60 * 1000);
  };

  expireRoomLease = () => {
    this.emit("terminate-room");
  };

  handleFrameLoop() {
    if (this.context.shotInProgress) {
      this.sendMovingObjects();
    }
  }

  sendMovingObjects = () => {
    const { balls, shotInProgress, gameOver, gameStarted, turn, winner } = this.context;
    this.context.io.emit("room-update", {
      balls,
      gameStarted,
      shotInProgress,
      gameOver,
      turn,
      winner,
    });
  };

  sendFixedObjects = () => {
    const { rails, pockets, table, players } = this.context;
    this.context.io.emit("room-update", {
      players,
      rails,
      pockets,
      table,
    });
    this.sendMovingObjects();
  };

  handleUserEnter = () => {
    const playersJoined = this.context.players.length === this.context.turn.turns.length;
    const notStarted = !this.context.gameStarted;
    if (playersJoined && notStarted) {
      this.context.gameStarted = true;
      this.emit("game-start");
    }
  };

  handleUserExit = () => {};
}
