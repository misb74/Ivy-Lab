// When the parent process (Claude Code) exits, stdin closes.
// The MCP SDK doesn't handle this, so servers become zombies.
// This preload ensures the process exits when stdin closes.
process.stdin.on('end', () => process.exit(0));
