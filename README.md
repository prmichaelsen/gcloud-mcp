# gcloud-mcp

Google Cloud MCP server for Cloud Build and Cloud Run log tools

> Built with [Agent Context Protocol](https://github.com/prmichaelsen/agent-context-protocol)

## Quick Start

[Add installation and usage instructions here]

## Features

- Cloud Build: list builds, get build details and logs
- Cloud Run: list services, get service logs

## Development

This project uses the Agent Context Protocol for development:

- `@acp.init` - Initialize agent context
- `@acp.plan` - Plan milestones and tasks
- `@acp.proceed` - Continue with next task
- `@acp.status` - Check project status

See [AGENT.md](./AGENT.md) for complete ACP documentation.

## Project Structure

```
project-root/
├── AGENT.md              # ACP methodology
├── agent/                # ACP directory
│   ├── design/          # Design documents
│   ├── milestones/      # Project milestones
│   ├── tasks/           # Task breakdown
│   ├── patterns/        # Architectural patterns
│   └── progress.yaml    # Progress tracking
└── src/                 # MCP server source
```

## Getting Started

1. Initialize context: `@acp.init`
2. Plan your project: `@acp.plan`
3. Start building: `@acp.proceed`

## License

MIT

## Author

Patrick Michaelsen
