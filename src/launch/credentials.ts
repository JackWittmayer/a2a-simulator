import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const CREDENTIALS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const KEYCHAIN_SERVICE = "Claude Code-credentials";

function isMacOS(): boolean {
  return os.platform() === "darwin";
}

function fileHasContent(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content.length > 0;
  } catch {
    return false;
  }
}

function extractFromKeychain(): string | null {
  try {
    return execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch {
    return null;
  }
}

export function resolveCredentials(): string {
  if (fileHasContent(CREDENTIALS_PATH)) {
    return CREDENTIALS_PATH;
  }

  if (!isMacOS()) {
    console.error(
      `Error: credentials file is empty or missing: ${CREDENTIALS_PATH}\n` +
      `Run "claude auth login" to authenticate.`,
    );
    process.exit(1);
  }

  const keychainData = extractFromKeychain();
  if (!keychainData) {
    console.error(
      `Error: no credentials found in ${CREDENTIALS_PATH} or macOS Keychain.\n` +
      `Run "claude auth login" to authenticate.`,
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, keychainData, { mode: 0o600 });
  console.log(`Exported credentials from macOS Keychain to ${CREDENTIALS_PATH}`);
  return CREDENTIALS_PATH;
}
