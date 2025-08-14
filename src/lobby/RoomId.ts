import { customAlphabet } from "nanoid";

const roomNanoId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ");

export const randomRoomId = () => {
  const id = roomNanoId(9);
  return id.substring(0, 3) + "-" + id.substring(3, 6) + "-" + id.substring(6, 9);
};

export const normalizeRoomId = (id: string) => {
  id = id.toUpperCase();
  id = id.replace(/ROOM[^a-zA-Z0-9]/g, "");
  id = id.replace(/[^a-zA-Z0-9]/g, "");
  id = id.substring(0, 3) + "-" + id.substring(3, 6) + "-" + id.substring(6);
  return id;
};

export const isValidRoomId = (id: string) => {
  const isValid = typeof id === "string" && /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(id);
  return isValid;
};
