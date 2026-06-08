Show the mcp-forge rewrite plan for this project.

Usage:
  /forge-plan              — auto-detect project type from AUDIT_MANIFEST
  /forge-plan mcp-server   — specify project type directly

Arguments: $ARGUMENTS

Steps:
1. If a project type was given in $ARGUMENTS, use it
2. Otherwise look for an AUDIT_MANIFEST in the current conversation and extract the projectType field
3. If no manifest exists, ask the user to run /forge-audit first
4. Call the `list_steps` tool from mcp-forge with the detected or provided project type
5. Display the full step list, clearly marking each step as APPLIES or SKIP for this project type
6. Recommend the next step to run — suggest `/forge-step <n>` for the first unapplied step
