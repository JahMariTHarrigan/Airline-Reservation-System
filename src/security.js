import {
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
export const token = () => randomBytes(24).toString("hex");
export const digest = (x) => createHash("sha256").update(x).digest("hex");
export async function hash(password) {
  const salt = token();
  return salt + ":" + (await scrypt(password, salt, 64)).toString("hex");
}
export async function verify(password, encoded) {
  const [salt, key] = encoded.split(":");
  const value = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(key, "hex"), value);
}
