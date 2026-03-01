import * as fs from "node:fs";
import * as path from "node:path";

const TEMPLATES_DIR = path.join(__dirname);

export function loadTemplate(
  name: string,
  vars?: Record<string, string>,
): string {
  const filePath = path.join(TEMPLATES_DIR, name);
  let content = fs.readFileSync(filePath, "utf-8");

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, value);
    }
  }

  return content;
}
