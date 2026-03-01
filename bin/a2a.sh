#!/bin/bash
set -euo pipefail

SOURCE="$0"
while [ -L "$SOURCE" ]; do
  SOURCE="$(readlink "$SOURCE")"
done
SCRIPT_DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  echo "Usage: a2a <command> [options]"
  echo ""
  echo "Commands:"
  echo "  start <simulation.yaml>  Build and launch a simulation from a config file"
  echo "  stop                    Stop all running agent containers"
  echo "  logs [agent]            Tail logs from all agents or a specific one"
  echo "  status                  Show running agents and message counts"
  echo ""
  echo "Examples:"
  echo "  a2a start examples/secret-language.yaml"
  echo "  a2a stop"
  echo "  a2a logs alice"
  echo "  a2a status"
}

cmd_start() {
  if [ $# -eq 0 ]; then
    echo "Error: provide a simulation YAML file"
    echo "Usage: a2a start <simulation.yaml>"
    exit 1
  fi
  cd "$PROJECT_DIR"
  "$PROJECT_DIR/node_modules/.bin/tsc"
  cp src/agent/templates/*.md src/agent/templates/*.sh dist/src/agent/templates/
  node dist/src/start.js "$@"
}

cmd_stop() {
  echo "Stopping all a2a agent containers..."
  local containers
  containers=$(docker ps --format '{{.Names}}' 2>/dev/null | while read -r name; do
    if docker inspect "$name" --format '{{.Config.Env}}' 2>/dev/null | grep -q 'AGENT_NAME='; then
      echo "$name"
    fi
  done || true)
  if [ -z "$containers" ]; then
    echo "No agent containers found."
    return
  fi
  echo "$containers" | xargs docker kill 2>/dev/null || true
  echo "$containers" | xargs docker rm 2>/dev/null || true
  echo "Done."
}

cmd_logs() {
  if [ $# -gt 0 ]; then
    docker logs -f "$1"
  else
    local names
    names=$(docker ps --format '{{.Names}}' 2>/dev/null | while read -r name; do
      if docker inspect "$name" --format '{{.Config.Env}}' 2>/dev/null | grep -q 'AGENT_NAME='; then
        echo "$name"
      fi
    done || true)
    if [ -z "$names" ]; then
      echo "No agent containers running."
      return
    fi
    for name in $names; do
      echo "=== $name ==="
      docker logs "$name" 2>&1 | tail -20
      echo ""
    done
  fi
}

cmd_status() {
  local port="${PORT:-3000}"
  echo "Containers:"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | while read -r line; do
    echo "  $line"
  done
  echo ""
  echo "Server (port $port):"
  curl -s "http://localhost:$port/agents" 2>/dev/null | jq . 2>/dev/null || echo "  Server not reachable"
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi

command="$1"
shift

case "$command" in
  start)  cmd_start "$@" ;;
  stop)   cmd_stop "$@" ;;
  logs)   cmd_logs "$@" ;;
  status) cmd_status "$@" ;;
  help|-h|--help) usage ;;
  *)
    echo "Unknown command: $command"
    usage
    exit 1
    ;;
esac
