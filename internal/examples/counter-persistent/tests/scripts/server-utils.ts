#!/usr/bin/env bun
/**
 * Server Lifecycle Management Utilities for Playwright Tests
 *
 * Provides automatic server start/stop functionality so tests can manage
 * their own server configuration requirements.
 */

import { spawn, ChildProcess } from 'child_process';

const SERVER_URL = 'https://localhost:3443';
const SERVER_TIMEOUT = 30000; // 30 seconds
const POLL_INTERVAL = 500; // 500ms

/**
 * Start a development server using Task
 *
 * @param taskName - The task command to run (e.g., 'dev', 'dev-serve-url', 'dev-serve-both')
 * @returns Promise<ChildProcess> - The spawned server process
 */
export async function startServer(taskName: string): Promise<ChildProcess> {
  console.log(`🚀 Starting server: task ${taskName}`);

  // Kill any existing servers first
  await killAllServers();

  // Spawn the Task command
  const serverProcess = spawn('task', [taskName], {
    detached: true,
    stdio: 'ignore', // Don't pipe output to avoid blocking
    env: {
      ...process.env,
      // Disable TTY colors for cleaner logs
      NO_COLOR: '1',
    },
  });

  // Unref so test process doesn't wait for server
  serverProcess.unref();

  // Wait for server to be ready
  try {
    await waitForServer(SERVER_URL, SERVER_TIMEOUT);
    console.log(`✅ Server ready at ${SERVER_URL}`);
    return serverProcess;
  } catch (error) {
    // Server failed to start, clean up
    await stopServer(serverProcess);
    throw new Error(`Failed to start server: ${error}`);
  }
}

/**
 * Stop a running server process
 *
 * @param serverProcess - The server process to stop
 */
export async function stopServer(serverProcess: ChildProcess | null): Promise<void> {
  if (!serverProcess || !serverProcess.pid) {
    return;
  }

  console.log(`🛑 Stopping server (PID: ${serverProcess.pid})...`);

  try {
    // Kill the entire process group (negative PID)
    // This ensures child processes (air, caddy, main) are also killed
    process.kill(-serverProcess.pid, 'SIGTERM');

    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force kill if still running
    try {
      process.kill(-serverProcess.pid, 'SIGKILL');
    } catch {
      // Process already dead, ignore
    }
  } catch (error) {
    console.warn(`⚠️  Failed to kill server process: ${error}`);
  }

  // Extra cleanup using task dev-kill
  await killAllServers();

  console.log('✅ Server stopped');
}

/**
 * Kill all server processes using task dev-kill
 *
 * This is a fallback cleanup method that uses the Taskfile's
 * dev-kill command to ensure all server processes are stopped.
 */
export async function killAllServers(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const killProcess = spawn('task', ['dev-kill'], {
        stdio: 'ignore',
      });

      killProcess.on('close', () => resolve());
      killProcess.on('error', (err) => reject(err));

      // Timeout after 5 seconds
      setTimeout(() => {
        killProcess.kill();
        resolve();
      }, 5000);
    });
  } catch (error) {
    // Ignore errors - servers might not be running
  }
}

/**
 * Wait for server to respond to HTTP requests
 *
 * Polls the server URL until it responds or timeout is reached.
 *
 * @param url - The URL to poll
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Try to fetch the URL (ignore HTTPS errors for self-signed certs)
      const response = await fetch(url, {
        method: 'HEAD',
        // @ts-ignore - Bun supports this
        tls: { rejectUnauthorized: false },
      });

      if (response.ok || response.status === 404) {
        // Server is responding (even if 404, it's alive)
        return;
      }
    } catch (error) {
      // Server not ready yet, continue polling
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error(`Server did not start within ${timeout}ms`);
}

/**
 * Check if a port is available
 *
 * @param port - The port number to check
 * @returns Promise<boolean> - True if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response('test');
      },
    });
    server.stop();
    return true;
  } catch {
    return false;
  }
}
