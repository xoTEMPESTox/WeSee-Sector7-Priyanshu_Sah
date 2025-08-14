import { Middleware } from "polymatic";

import { Terminal } from "./Terminal";
import { FrameLoop } from "./FrameLoop";
import { CueShot } from "../eight-ball/CueShot";
import { RoomClient } from "./RoomClient";
import { StatusOnline } from "./StatusOnline";
import { type ClientBilliardContext } from "./ClientContext";

/**
 * Main class for the billiard game client.
 */
export class MainClient extends Middleware<ClientBilliardContext> {
  constructor() {
    super();
    this.use(new FrameLoop());
    this.use(new CueShot());
    this.use(new Terminal());
    this.use(new RoomClient());
    this.use(new StatusOnline());
  }
}
