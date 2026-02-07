# Task Runner Docker

Run shell commands inside Docker containers for isolated, reproducible execution.

## Usage

```typescript
import { DockerTaskRunner } from '@lde/task-runner-docker';

const runner = new DockerTaskRunner({
  image: 'ubuntu:latest',
  containerName: 'my-task', // Optional container name
  mountDir: '/path/to/data', // Optional directory to mount at /mount
  port: 8080, // Optional port to expose
});

// Run a command in the container
const container = await runner.run('ls -la /mount');

// Wait for completion
const output = await runner.wait(container);
console.log(output);

// Or stop a running container
await runner.stop(container);
```

## Options

| Option          | Type     | Required | Description                                          |
| --------------- | -------- | -------- | ---------------------------------------------------- |
| `image`         | `string` | Yes      | Docker image to use                                  |
| `containerName` | `string` | No       | Name for the container (auto-removed on restart)     |
| `mountDir`      | `string` | No       | Host directory to mount at `/mount` in the container |
| `port`          | `number` | No       | Port to expose from the container                    |
| `docker`        | `Docker` | No       | Custom Dockerode instance                            |

## Features

- Automatically pulls the Docker image before running
- Mounts a host directory as `/mount` with the `mountDir` option
- Runs commands as the current user (UID/GID) for file permissions
- Exposes ports with `port` option
- Removes previous containers with the same name on restart
- Streams container logs to stdout
