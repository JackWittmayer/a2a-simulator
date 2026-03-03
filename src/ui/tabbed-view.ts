import blessed from "blessed";

export class TabbedView {
  private screen: blessed.Widgets.Screen;
  private tabs: blessed.Widgets.BoxElement[] = [];
  private tabBar: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private activeTab = 0;
  private unread = [false, false];
  private tabLabels = ["Orchestrator", "Simulation"];
  private autoScroll = [true, true];

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "a2a orchestrator",
      fullUnicode: true,
    });

    this.tabBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: 1,
      tags: true,
      style: { bg: "blue", fg: "white", bold: true },
    });

    for (let i = 0; i < 2; i++) {
      const box = blessed.box({
        parent: this.screen,
        top: 1,
        left: 0,
        width: "100%",
        height: "100%-2",
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: "│", style: { bg: "grey" } },
        mouse: true,
        keys: true,
        vi: true,
        hidden: i !== 0,
        style: { fg: "white" },
      });

      box.on("scroll", () => {
        const scrollHeight = (box as unknown as { getScrollHeight(): number }).getScrollHeight();
        const scrollPos = (box as unknown as { getScroll(): number }).getScroll();
        const visibleHeight = (box.height as number) || 0;
        this.autoScroll[i] = scrollPos + visibleHeight >= scrollHeight - 1;
      });

      this.tabs.push(box);
    }

    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      style: { bg: "grey", fg: "black" },
      content: " Tab/1/2: switch tabs | q: quit | ↑↓/scroll: navigate | Shift+drag: select text",
    });

    this.screen.key(["tab"], () => this.switchTab(this.activeTab === 0 ? 1 : 0));
    this.screen.key(["1"], () => this.switchTab(0));
    this.screen.key(["2"], () => this.switchTab(1));
    this.screen.key(["q", "C-c"], () => {
      this.destroy();
      process.exit(0);
    });

    this.renderTabBar();
    this.screen.render();
  }

  private renderTabBar(): void {
    const parts = this.tabLabels.map((label, i) => {
      const unreadMark = this.unread[i] ? " *" : "";
      if (i === this.activeTab) {
        return `{bold}{white-bg}{black-fg} ${i + 1}: ${label}${unreadMark} {/}`;
      }
      return ` ${i + 1}: ${label}${unreadMark} `;
    });
    this.tabBar.setContent(parts.join("  "));
  }

  switchTab(index: 0 | 1): void {
    if (index === this.activeTab) return;
    this.tabs[this.activeTab].hide();
    this.activeTab = index;
    this.unread[index] = false;
    this.tabs[index].show();
    this.tabs[index].focus();
    this.renderTabBar();
    this.screen.render();
  }

  appendOrchestrator(line: string): void {
    this.appendToTab(0, line);
  }

  appendSimulation(line: string): void {
    this.appendToTab(1, line);
  }

  private appendToTab(index: number, text: string): void {
    const box = this.tabs[index];
    const current = box.getContent();
    box.setContent(current + text);

    if (this.autoScroll[index]) {
      const scrollHeight = (box as unknown as { getScrollHeight(): number }).getScrollHeight();
      box.scrollTo(scrollHeight);
    }

    if (index !== this.activeTab) {
      this.unread[index] = true;
      this.renderTabBar();
    }

    this.screen.render();
  }

  destroy(): void {
    this.screen.destroy();
  }
}
