Run the mcp-forge Step 0 audit on this codebase.

1. Call the `get_step` tool from mcp-forge with `{ step: 0 }`
2. Apply the returned audit prompt to the entire current codebase — read every relevant source file
3. Emit the complete AUDIT_MANIFEST JSON when done
4. Do not make any file changes — this step is read-only analysis only

After emitting the manifest, tell the user to run `/forge-plan` to see which steps apply to their project type, or `/forge-rewrite` if the project is under 2,000 lines.
