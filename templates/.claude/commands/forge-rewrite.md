Run a complete single-pass enterprise rewrite of this project using mcp-forge.
Best for projects under 2,000 lines. For larger projects, use /forge-audit instead.

Steps:
1. Call the `get_master_prompt` tool from mcp-forge
2. Apply the returned master prompt to the entire codebase — read every source file first
3. Detect the project type automatically as part of the rewrite (the master prompt handles this)
4. Emit every rewritten file in full
5. Show a final summary of all changes made and the detected project type
