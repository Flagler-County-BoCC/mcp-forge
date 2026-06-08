Apply a specific mcp-forge rewrite step to this project.

Usage:
  /forge-step 1              — apply step 1 (all project types)
  /forge-step 8 mcp-server   — apply step 8 for a specific project type

Arguments: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS — first token is the step number, optional second token is the project type
2. If no step number is provided, tell the user the correct usage and stop
3. Call the `get_step` tool from mcp-forge with the parsed step number and project type
4. If the tool returns an error (e.g. step 8 needs a project type), surface the error clearly and stop
5. Apply the returned prompt to the current codebase — write or rewrite files as instructed
6. Show a clear summary of every file created or modified
7. Suggest the next step: `/forge-step <n+1>` (or `/forge-step 8 <projectType>` if step 7 just completed)

Note: always run /forge-audit first if no AUDIT_MANIFEST exists yet.
