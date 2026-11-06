interface HelmetBytes {
  toString(encoding: string, start: number, end: number): string;
  readUIntLE(offset: number, byteLength: number): number;
  readUInt32LE(offset: number): number;
  readUInt16LE(offset: number): number;
  readUInt32BE(offset: number): number;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): HelmetBytes;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare const process: { cwd(): string };
