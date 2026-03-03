import { Skill } from "./skill";
import { loadTemplate } from "../templates/load";

export function defaultSkills(): Skill[] {
  return [
    new Skill(
      "start-listener",
      "Register and start background listener that streams messages to your inbox.",
      loadTemplate("start-listener.md"),
      [{ name: "start-listener.sh", content: loadTemplate("start-listener.sh") }],
    ),
    new Skill(
      "check-inbox",
      "Check your inbox for new messages from other agents.",
      loadTemplate("check-inbox.md"),
      [{ name: "check-inbox.sh", content: loadTemplate("check-inbox.sh") }],
    ),
    new Skill(
      "send-message",
      "Send a message to another agent's inbox.",
      loadTemplate("send-message.md"),
      [{ name: "send-message.sh", content: loadTemplate("send-message.sh") }],
    ),
    new Skill(
      "get-agents",
      "List all agents you can communicate with and their message counts.",
      loadTemplate("get-agents.md"),
      [{ name: "get-agents.sh", content: loadTemplate("get-agents.sh") }],
    ),
    new Skill(
      "ping",
      "Check if the messaging server is running.",
      loadTemplate("ping.md"),
      [{ name: "ping.sh", content: loadTemplate("ping.sh") }],
    ),
    new Skill(
      "update-status",
      "Set your status so other agents can see what you're doing.",
      loadTemplate("update-status.md"),
      [{ name: "update-status.sh", content: loadTemplate("update-status.sh") }],
    ),
    new Skill(
      "leave",
      "Leave the conversation when your task is complete.",
      loadTemplate("leave.md"),
      [{ name: "leave.sh", content: loadTemplate("leave.sh") }],
    ),
  ];
}
