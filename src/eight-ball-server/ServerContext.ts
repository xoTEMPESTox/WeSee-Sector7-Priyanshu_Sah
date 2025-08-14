import type { Namespace } from "socket.io";
import { BilliardContext } from "../eight-ball/BilliardContext";
import type { Room } from "../lobby-server/LobbyServer";

export interface Auth {
  id: string;
  secret: string;
}

export class ServerBilliardContext extends BilliardContext {
  io: Namespace;
  room?: Room;

  auths: Auth[] = [];
}
