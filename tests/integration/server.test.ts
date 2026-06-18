import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';

interface TextContent {
  type: 'text';
  text: string;
}

interface ToolResult {
  content: TextContent[];
  isError?: boolean;
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  return result as unknown as ToolResult;
}

describe('MCP server integration', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('registers all expected tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_steps');
    expect(names).toContain('get_step');
    expect(names).toContain('get_entrypoint');
    expect(names).toContain('get_master_prompt');
    expect(names).toContain('validate_manifest');
    expect(names).toContain('get_create_prompt');
  });

  it('list_steps returns content for all 15 steps', async () => {
    const result = await callTool(client, 'list_steps', {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('Step 00');
    expect(result.content[0]?.text).toContain('Step 14');
  });

  it('list_steps marks applicable steps for mcp-server type', async () => {
    const result = await callTool(client, 'list_steps', { projectType: 'mcp-server' });
    expect(result.content[0]?.text).toContain('[APPLIES]');
    expect(result.content[0]?.text).toContain('[SKIP]');
  });

  it('get_step returns prompt content for step 0', async () => {
    const result = await callTool(client, 'get_step', { step: 0 });
    expect(result.isError).toBeFalsy();
    expect((result.content[0]?.text ?? '').length).toBeGreaterThan(100);
  });

  it('get_step returns isError for step 8 without projectType', async () => {
    const result = await callTool(client, 'get_step', { step: 8 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('projectType');
  });

  it('get_entrypoint returns mcp-server entrypoint', async () => {
    const result = await callTool(client, 'get_entrypoint', { projectType: 'mcp-server' });
    expect(result.isError).toBeFalsy();
    expect((result.content[0]?.text ?? '').length).toBeGreaterThan(100);
  });

  it('get_master_prompt returns the master prompt', async () => {
    const result = await callTool(client, 'get_master_prompt', {});
    expect(result.isError).toBeFalsy();
    expect((result.content[0]?.text ?? '').length).toBeGreaterThan(100);
  });

  it('get_create_prompt returns the create prompt', async () => {
    const result = await callTool(client, 'get_create_prompt', {});
    expect(result.isError).toBeFalsy();
    expect((result.content[0]?.text ?? '').length).toBeGreaterThan(100);
  });

  it('validate_manifest returns valid for a correct manifest', async () => {
    const manifest = {
      schemaVersion: '3.0.0',
      projectName: 'test',
      projectType: 'http-api',
      detectedFramework: 'fastify',
      detectedOrm: 'prisma',
      detectedTestRunner: 'vitest',
      detectedLanguage: 'typescript',
      nodeVersionRequired: '22',
      isPublishedPackage: false,
      entryPoints: ['src/server.ts'],
      mcpTransport: null,
      testCoverage: { exists: false, coveragePercent: null },
      hasDockerfile: false,
      hasCIConfig: false,
      hasLinter: false,
      hasFormatter: false,
      hasErrorHandling: false,
      hasStructuredLogging: false,
      hasInputValidation: false,
    };
    const result = await callTool(client, 'validate_manifest', {
      manifestJson: JSON.stringify(manifest),
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('valid');
  });

  it('validate_manifest returns isError for invalid manifest', async () => {
    const result = await callTool(client, 'validate_manifest', {
      manifestJson: '{"projectType":"not-a-real-type"}',
    });
    expect(result.isError).toBe(true);
  });
});
