#!/usr/bin/env node

/**
 * Railway MCP Server
 * ให้คุณควบคุม Railway services ผ่าน Claude Code
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

class RailwayMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "railway-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_projects",
          description: "แสดงรายการ Railway projects ทั้งหมด",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "list_services",
          description: "แสดงรายการ services ใน project",
          inputSchema: {
            type: "object",
            properties: {
              projectId: {
                type: "string",
                description: "Railway Project ID",
              },
            },
            required: ["projectId"],
          },
        },
        {
          name: "get_service_status",
          description: "ตรวจสอบสถานะ service",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: {
                type: "string",
                description: "Railway Service ID",
              },
              environmentId: {
                type: "string",
                description: "Environment ID (production/staging)",
              },
            },
            required: ["serviceId", "environmentId"],
          },
        },
        {
          name: "redeploy_service",
          description: "Deploy service ใหม่ (สำหรับ start service ที่ปิดอยู่)",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: {
                type: "string",
                description: "Railway Service ID",
              },
              environmentId: {
                type: "string",
                description: "Environment ID",
              },
            },
            required: ["serviceId", "environmentId"],
          },
        },
        {
          name: "stop_service",
          description: "หยุด service (ใช้ numReplicas = 0)",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: {
                type: "string",
                description: "Railway Service ID",
              },
              environmentId: {
                type: "string",
                description: "Environment ID",
              },
            },
            required: ["serviceId", "environmentId"],
          },
        },
        {
          name: "start_service",
          description: "เปิด service (ใช้ numReplicas = 1)",
          inputSchema: {
            type: "object",
            properties: {
              serviceId: {
                type: "string",
                description: "Railway Service ID",
              },
              environmentId: {
                type: "string",
                description: "Environment ID",
              },
            },
            required: ["serviceId", "environmentId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }

  async makeRailwayRequest(query, variables = {}) {
    const apiToken = process.env.RAILWAY_API_TOKEN;
    if (!apiToken) {
      throw new Error("RAILWAY_API_TOKEN environment variable is not set");
    }

    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Railway API Error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async handleToolCall(request) {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case "list_projects":
          result = await this.listProjects();
          break;

        case "list_services":
          result = await this.listServices(args.projectId);
          break;

        case "get_service_status":
          result = await this.getServiceStatus(args.serviceId, args.environmentId);
          break;

        case "redeploy_service":
          result = await this.redeployService(args.serviceId, args.environmentId);
          break;

        case "stop_service":
          result = await this.stopService(args.serviceId, args.environmentId);
          break;

        case "start_service":
          result = await this.startService(args.serviceId, args.environmentId);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
            }
          }
        }
      }
    `;

    const data = await this.makeRailwayRequest(query);
    return data.projects.edges.map(e => e.node);
  }

  async listServices(projectId) {
    const query = `
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                createdAt
              }
            }
          }
        }
      }
    `;

    const data = await this.makeRailwayRequest(query, { projectId });
    return data.project.services.edges.map(e => e.node);
  }

  async getServiceStatus(serviceId, environmentId) {
    const query = `
      query($serviceId: String!, $environmentId: String!) {
        service(id: $serviceId) {
          id
          name
          serviceInstances(environmentId: $environmentId) {
            edges {
              node {
                id
                numReplicas
                nextCronJobRunAt
                latestDeployment {
                  id
                  status
                  createdAt
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.makeRailwayRequest(query, { serviceId, environmentId });
    return data.service;
  }

  async redeployService(serviceId, environmentId) {
    const mutation = `
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;

    const data = await this.makeRailwayRequest(mutation, { serviceId, environmentId });
    return { success: true, result: data.serviceInstanceRedeploy };
  }

  async stopService(serviceId, environmentId) {
    const mutation = `
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceUpdate(
          serviceId: $serviceId
          environmentId: $environmentId
          input: { numReplicas: 0 }
        )
      }
    `;

    const data = await this.makeRailwayRequest(mutation, { serviceId, environmentId });
    return { success: true, message: "Service stopped (numReplicas = 0)" };
  }

  async startService(serviceId, environmentId) {
    const mutation = `
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceUpdate(
          serviceId: $serviceId
          environmentId: $environmentId
          input: { numReplicas: 1 }
        )
      }
    `;

    const data = await this.makeRailwayRequest(mutation, { serviceId, environmentId });
    return { success: true, message: "Service started (numReplicas = 1)" };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Railway MCP server running on stdio");
  }
}

const server = new RailwayMCPServer();
server.run().catch(console.error);
