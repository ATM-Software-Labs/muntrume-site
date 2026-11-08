interface HelmetBytes {
  toString(encoding: string, start: number, end: number): string;
  readUIntLE(offset: number, byteLength: number): number;
  readUInt32LE(offset: number): number;
  readUInt16LE(offset: number): number;
  readUInt32BE(offset: number): number;
  [key: string]: any;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, options?: any): any;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare const process: { cwd(): string };
