import { File } from "./file";

export type DirectoryChild = File | Directory;

export interface Directory {
  name: string;
  children: DirectoryChild[];
}

export function directory(name: string, children: DirectoryChild[]): Directory {
  return { name, children };
}
