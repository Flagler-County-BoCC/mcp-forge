Create a brand-new, hardened MCP server from an API specification using mcp-forge.
Use this when there is NO existing project to rewrite — you are generating one from
scratch. To improve an existing project instead, use /forge-audit.

Steps:

1. Call the `get_create_prompt` tool from mcp-forge
2. Apply the returned Create-mode prompt to produce the manifest:
   - If an OpenAPI/Swagger document (openapi.json, openapi.yaml, swagger.json) is
     available, use it as the source.
   - Otherwise, fill in the BUILD_SPEC template the prompt provides (project name,
     base URL, auth, operations, and each operation's response fields).
3. Emit the AUDIT_MANIFEST JSON block (projectType will be "mcp-server"), with one
   mcpTools entry per operation and responseFields populated per tool.
4. Call the `validate_manifest` tool to confirm the manifest is valid. If it reports
   errors, fix them and re-validate before continuing.
5. Generate the server from the manifest: apply steps 1–7 via `get_step`, then
   `get_entrypoint` for mcp-server (step 8), then steps 9–14. Write every file in full.
6. Show a summary: the tools generated, modules, the environment variables the user
   must set, and the next action — `npm install && npm run setup` to build and
   register the new server.

Note: this produces a NEW project. Run it in an empty directory (or one you intend
to populate), not on top of unrelated code.
