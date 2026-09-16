import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * ThreadCap MCP server (docs/06-mcp.md).
 * Deployed merged with the REST api on one Railway service (D-021);
 * wired tools call the REST /v1/* surface via THREADCAP_API_BASE_URL.
 */
const server = new McpServer(
  { name: 'threadcap', version: '0.0.0' },
  { capabilities: { tools: {} } },
);

server.registerTool(
  'echo',
  { text: z.string() },
  async ({ text }) => ({ content: [{ type: 'text', text }] }),
);

server.registerTool(
  'server_info',
  {
    workspaceId: z.string().startsWith('ws_').describe('workspace id to target (replace with authed value)'),
  },
  async ({ workspaceId }) => {
    const apiBase = process.env.THREADCAP_API_BASE_URL ?? 'http://localhost:8080/v1';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { apiBase, workspaceId, status: 'ok', note: 'REST proxy wiring TODO — tools list in docs/06-mcp.md' },
            null,
            2,
          ),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);