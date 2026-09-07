import { customAlphabet } from "nanoid";

// Alphabet sans caractères ambigus (0/O, 1/I) pour un code facile à lire/dicter.
const nanoid = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 4);

export function generateRoomCode(): string {
  return `NF-${nanoid()}`;
}

const CODE_REGEX = /^NF-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

export function isValidRoomCode(code: string): boolean {
  return CODE_REGEX.test(code);
}
