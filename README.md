# Cloud IDE Starter

An intentionally designed Cloud IDE starter with a React frontend, Monaco editor, Xterm terminal, and a Fastify plus Socket.IO control plane.

## Stack

- `apps/web`: React, Vite, TypeScript, Monaco, Xterm
- `apps/server`: Fastify, Socket.IO, TypeScript

## Run

```bash
npm install
npm run dev
```

- Web UI: `http://localhost:5173`
- API and runtime socket: `http://localhost:8787`

## What is implemented

- Asymmetric editor and runtime layout that avoids template-like SaaS defaults
- Multi-file Monaco workspace shell
- Terminal stream via Socket.IO
- Mock runtime controller that simulates queueing, execution, log streaming, and basic stdin handling
- Clean boundary for swapping the mock runner with a Docker-backed executor later

## Where to replace the mock runtime

The current execution flow is isolated in [apps/server/src/runtime.ts](./apps/server/src/runtime.ts). Replace `createMockRuntimeController()` with a Docker runner that:

1. Creates an ephemeral workspace directory
2. Writes the requested file contents
3. Boots a locked-down container with resource limits
4. Streams stdout and stderr back through the same `emitLine`, `emitStatus`, and `emitFeed` bridge
5. Destroys the container and workspace after completion
