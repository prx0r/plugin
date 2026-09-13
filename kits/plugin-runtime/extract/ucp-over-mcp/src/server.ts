import type { CallToolResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

export const getServer = () => {
  const server = new McpServer(
    {
      name: "ucp",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    "start-notification-stream",
    {
      description:
        "Starts sending periodic notifications for testing resumability",
      inputSchema: z.object({
        interval: z
          .number()
          .describe("Interval in milliseconds between notifications")
          .default(100),
        count: z
          .number()
          .describe("Number of notifications to send (0 for 100)")
          .default(10),
      }),
    },
    async ({ interval, count }, ctx): Promise<CallToolResult> => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await ctx.mcpReq.log(
            "info",
            `Periodic notification #${counter} at ${new Date().toISOString()}`,
          );
        } catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: "text",
            text: `Started sending periodic notifications every ${interval}ms`,
          },
        ],
      };
    },
  );

  return server;
};
