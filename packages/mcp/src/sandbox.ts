import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface SandboxExecutionResult {
  success: boolean;
  result: unknown;
  logs: string[];
  error?: {
    name: string;
    value: string;
    traceback?: string;
  };
}

export async function executeInSandbox(
  sandboxNamespace: DurableObjectNamespace<Sandbox<unknown>>,
  datasetId: string,
  rawDatasetJson: string,
  generatedCode: string,
  contextId?: string,
  timeout: number = 60_000
): Promise<{ contextId: string; execution: SandboxExecutionResult }> {
  const sandboxId = `dataset-${datasetId}`;
  // @ts-expect-error - Type incompatibility between workers-types versions
  const sandbox = getSandbox(sandboxNamespace, sandboxId);

  const sessionId = contextId ?? `session-${datasetId}-${Date.now()}`;
  const codePath = "/workspace/analyze.py";

  console.log(
    "[sandbox] sandbox_execute_start",
    JSON.stringify({
      sandboxId,
      sessionId,
      codePath,
      codeLength: generatedCode.length,
      timeoutMs: timeout,
    })
  );

  try {
    console.log(
      "[sandbox] sandbox_write_code_start",
      JSON.stringify({
        sandboxId,
        sessionId,
        path: codePath,
        codeLength: generatedCode.length,
      })
    );
    const writeCodeStartTime = Date.now();
    await sandbox.writeFile(codePath, generatedCode);
    const writeCodeDuration = Date.now() - writeCodeStartTime;
    console.log(
      "[sandbox] sandbox_write_code_complete",
      JSON.stringify({
        sandboxId,
        sessionId,
        path: codePath,
        durationMs: writeCodeDuration,
      })
    );

    console.log(
      "[sandbox] sandbox_exec_python_start",
      JSON.stringify({
        sandboxId,
        sessionId,
        command: `python3 ${codePath}`,
        timeoutMs: timeout,
      })
    );
    const execStartTime = Date.now();
    const execResult = await sandbox.exec(`python3 ${codePath}`, {
      sessionId,
      timeout,
    });
    const execDuration = Date.now() - execStartTime;
    console.log(
      "[sandbox] sandbox_exec_python_complete",
      JSON.stringify({
        sandboxId,
        sessionId,
        success: execResult.success,
        exitCode: execResult.exitCode,
        durationMs: execDuration,
        stdoutLength: execResult.stdout?.length ?? 0,
        stderrLength: execResult.stderr?.length ?? 0,
      })
    );

    if (!execResult.success || execResult.exitCode !== 0) {
      return {
        contextId: sessionId,
        execution: {
          success: false,
          result: null,
          logs: [execResult.stdout, execResult.stderr].filter(Boolean),
          error: {
            name: "ExecutionError",
            value:
              execResult.stderr ||
              `Process exited with code ${execResult.exitCode}`,
            traceback: execResult.stdout,
          },
        },
      };
    }

    let result: unknown = null;
    try {
      const output = execResult.stdout.trim();
      if (output) {
        result = JSON.parse(output);
      }
    } catch {
      result = execResult.stdout.trim() || null;
    }

    console.log(
      "[sandbox] sandbox_execute_success",
      JSON.stringify({
        sandboxId,
        sessionId,
        hasResult: result !== null,
      })
    );

    return {
      contextId: sessionId,
      execution: {
        success: true,
        result,
        logs: [execResult.stdout, execResult.stderr].filter(Boolean),
      },
    };
  } catch (error) {
    console.error(
      "[sandbox] sandbox_execute_error",
      JSON.stringify({
        sandboxId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        errorName:
          error instanceof Error ? error.constructor.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    return {
      contextId: sessionId,
      execution: {
        success: false,
        result: null,
        logs: [],
        error: {
          name:
            error instanceof Error ? error.constructor.name : "UnknownError",
          value: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}
