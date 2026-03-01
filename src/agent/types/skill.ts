import * as fs from "node:fs";
import * as path from "node:path";
import { File } from "./file";

export class Skill {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly skillMd: string,
    public readonly files?: File[],
  ) {}

  generate(parentDir: string): void {
    const skillDir = path.join(parentDir, ".claude", "skills", this.name);
    fs.mkdirSync(skillDir, { recursive: true });
    const frontmatter = `---\nname: ${this.name}\ndescription: ${this.description}\n---\n\n`;
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), frontmatter + this.skillMd);

    if (this.files) {
      for (const file of this.files) {
        fs.writeFileSync(path.join(skillDir, file.name), file.content);
      }
    }
  }
}
