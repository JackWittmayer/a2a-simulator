# A2A Simulator

A2A Simulator is a tool for simulating interactions between AI agents. Define multi-agent scenarios in YAML, run them in isolated Docker containers, and observe how agents collaborate, negotiate, and compete.

Use it to validate how an internal agent responds to external requests, or to run experiments in AI alignment research. Like [Petri](https://github.com/safety-research/petri) for multi-agent interactions.

## Features

- **Run agents using your Claude Max subscription** — no API key costs
- **Declarative YAML configs** — define agents, custom APIs, tools, and system prompts in a single file
- **Docker isolation** — each agent runs in its own container with its own filesystem
- **Custom APIs** — define HTTP endpoints with bash handlers for shared state (ticket systems, policies, databases)
- **AI-powered config generation** — describe a scenario in plain English and get a ready-to-run YAML config
- **Orchestrator mode** — an AI agent watches your simulation, analyzes results, tweaks configs, and iterates automatically
- **Parallel runs** — run N copies of the same simulation simultaneously for statistical comparison
- **Web dashboard** — browse and inspect simulation logs in a SvelteKit viewer

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [Docker](https://docs.docker.com/get-docker/)
- A Claude Max subscription with credentials at `~/.claude/.credentials.json`

### Install

```bash
git clone https://github.com/JackWittmayer/a2a-simulator.git
cd a2a-simulator
npm install
npm link   # makes the `a2a` command available globally
```

### Run Your First Simulation

The `refund-negotiation` example sets up a customer's personal AI agent trying to negotiate a refund against a policy-bound support agent:

```bash
a2a start examples/refund-negotiation.yaml
```

This will:
1. Build Docker images for each agent
2. Start a messaging server on port 3000
3. Launch agents in containers — they'll discover each other and start communicating
4. Stream formatted logs to your terminal

The customer agent (`alex-ai`) tries to get a refund on a speaker purchased 34 days ago (outside the 30-day return window). The support agent (`nova-support`) consults company policy, creates a ticket, and handles the request. This leads to a natural negotiation.

Stop the simulation when you're done:

```bash
a2a stop
```

### Generate a Simulation from a Prompt

Describe what you want instead of writing a YAML from hand.

```bash
a2a generate "Three diplomats from rival nations negotiate a peace treaty. Each has secret objectives."
```

Add `--run` to immediately start it:

```bash
a2a generate "Agent A has a secret. Agent B has to find it out using whatever means necessary." --run
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `a2a start <config.yaml>` | Build and launch a simulation |
| `a2a start <config.yaml> --runs N` | Run N copies in parallel on different ports |
| `a2a start <config.yaml> --orchestrate` | Run with AI orchestrator |
| `a2a start --orchestrate "prompt"` | Generate + orchestrate from a prompt |
| `a2a generate "prompt"` | Generate YAML config from natural language |
| `a2a generate "prompt" -o file.yaml` | Generate to a specific file |
| `a2a generate "prompt" --run` | Generate and immediately start |
| `a2a stop` | Kill all running agent containers |
| `a2a logs [agent]` | Tail logs from all agents or a specific one |
| `a2a status` | Show running containers and server info |

## Configuration Format

See [src/prompts/generate-simulation.md](src/prompts/generate-simulation.md) for the full YAML schema and design guidelines.

### Built-in Skills

Every agent automatically gets these skills:

| Skill | Description |
|-------|-------------|
| `/start-listener` | Start background message listener (agents run this first) |
| `/check-inbox` | Read new messages from other agents |
| `/send-message` | Send a message to another agent |
| `/get-agents` | List all available agents |
| `/ping` | Check if the server is reachable |
| `/update-status` | Set agent status (idle, thinking, left) |
| `/leave` | Exit the conversation gracefully |

## Orchestrator Mode

The orchestrator is an AI agent that runs your simulation, reads the logs, analyzes the outcome, tweaks the config, and iterates — hands-free experimentation.

```bash
a2a start examples/secret-language.yaml --orchestrate
```

Or generate and orchestrate from scratch:

```bash
a2a start --orchestrate "Can social pressure make an agent reveal a secret it was told to protect?"
```
## Dashboard

View simulation logs in a web UI:

```bash
npm run view
```

This starts a SvelteKit viewer on port 3001. Navigate to `http://<host>:3001` to browse simulation runs and inspect agent conversations.

![Dashboard Home](assets/dashboard_home.png)

![Dashboard Run View](assets/dashboard_run.png)

## How It Works

1. **Parse** — The YAML config is parsed into agent definitions, skills, and API handlers
2. **Build** — A Docker image is built for each agent with its skills installed at `~/.claude/skills/`
3. **Server** — An Express.js messaging server starts with the custom API endpoints
4. **Launch** — Agent containers start with `claude` CLI in agent mode, connected to the server
5. **Communicate** — Agents discover each other via `/get-agents`, then exchange messages through the server's inbox system
6. **Log** — All agent output is captured, parsed from Claude's stream-json format, and written to disk

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Agent A    │────▶│  Messaging Server │◀────│   Agent B    │
│  (Docker)    │◀────│   (Express.js)    │────▶│  (Docker)    │
└─────────────┘     │                  │     └─────────────┘
                    │  Custom APIs     │
                    │  Message routing  │
                    │  Agent registry   │
                    └──────────────────┘
```

## Limitations

- The messaging system is intentionally simple (inbox-based `send_message`/`check_inbox`) to simulate a rudimentary way of how agents will communicate over the internet. This could evolve to A2A protocol communication.
- There are formatting and display quirks in console logs and the dashboard. The log files on disk are the source of truth.
- Currently only supports Anthropic models via the Claude CLI.
