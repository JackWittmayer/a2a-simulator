import * as fs from "node:fs";
import * as path from "node:path";

export class LogTailer {
  private offset = 0;
  private watcher: fs.FSWatcher | null = null;
  private dirWatcher: fs.FSWatcher | null = null;
  private stopped = false;
  private currentLogFile: string | null = null;

  constructor(
    private logsBaseDir: string,
    private onLine: (line: string) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.offset = 0;
    this.currentLogFile = null;
    this.watchForNewLog();
  }

  stop(): void {
    this.stopped = true;
    this.watcher?.close();
    this.watcher = null;
    this.dirWatcher?.close();
    this.dirWatcher = null;
    this.currentLogFile = null;
  }

  private watchForNewLog(): void {
    if (!fs.existsSync(this.logsBaseDir)) {
      fs.mkdirSync(this.logsBaseDir, { recursive: true });
    }

    // Snapshot existing combined.log files so we can detect new ones
    const existingLogs = new Set(this.findAllCombinedLogs());

    // Check every second for a new combined.log (more reliable than fs.watch recursive)
    const pollInterval = setInterval(() => {
      if (this.stopped) {
        clearInterval(pollInterval);
        return;
      }

      const currentLogs = this.findAllCombinedLogs();
      for (const logPath of currentLogs) {
        if (!existingLogs.has(logPath)) {
          clearInterval(pollInterval);
          this.tailFile(logPath);
          return;
        }
      }
    }, 1000);

    // Store so we can clean up on stop
    this.dirWatcher = { close: () => clearInterval(pollInterval) } as fs.FSWatcher;
  }

  private findAllCombinedLogs(): string[] {
    if (!fs.existsSync(this.logsBaseDir)) return [];

    const logs: string[] = [];
    this.walkDir(this.logsBaseDir, (filePath) => {
      if (path.basename(filePath) === "combined.log") {
        logs.push(filePath);
      }
    });
    return logs;
  }

  private walkDir(dir: string, cb: (filePath: string) => void): void {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.walkDir(full, cb);
        } else {
          cb(full);
        }
      }
    } catch {
      // directory may not exist yet
    }
  }

  private tailFile(filePath: string): void {
    if (this.stopped) return;

    this.currentLogFile = filePath;
    this.offset = 0;

    this.readNewContent(filePath);

    this.watcher = fs.watch(filePath, () => {
      if (!this.stopped) this.readNewContent(filePath);
    });
  }

  private readNewContent(filePath: string): void {
    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (stat.size <= this.offset) return;

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(stat.size - this.offset);
    fs.readSync(fd, buf, 0, buf.length, this.offset);
    fs.closeSync(fd);
    this.offset = stat.size;

    const text = buf.toString("utf-8");
    for (const line of text.split("\n")) {
      if (line.trim()) {
        this.onLine(line);
      }
    }
  }
}
