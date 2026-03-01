import * as fs from "node:fs";
import * as path from "node:path";
import { DirectoryChild } from "./directory";

export class AgentFilesystem {
  constructor(
    public readonly rootDir: string,
    public readonly tree: DirectoryChild[],
  ) {}

  generate(): void {
    this.writeNodes(this.rootDir, this.tree);
  }

  private writeNodes(parentPath: string, nodes: DirectoryChild[]): void {
    fs.mkdirSync(parentPath, { recursive: true });
    for (const node of nodes) {
      const fullPath = path.join(parentPath, node.name);
      if ("children" in node) {
        this.writeNodes(fullPath, node.children);
      } else {
        fs.writeFileSync(fullPath, node.content);
      }
    }
  }
}
