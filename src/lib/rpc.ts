// Typed wrapper around google.script.run.
//
// In the deployed Google Apps Script environment, `google.script.run` exists and
// each backend function is invoked by name. During local `vite dev` it is absent,
// so we fall back to an in-memory mock (./mock) to let the UI run standalone.

import { mockCall } from './mock';

interface GoogleScriptRunner {
  withSuccessHandler(cb: (value: unknown) => void): GoogleScriptRunner;
  withFailureHandler(cb: (err: unknown) => void): GoogleScriptRunner;
}

/** The runner after handlers are attached, indexed by backend function name. */
type RunnerWithFns = GoogleScriptRunner & Record<string, (...args: unknown[]) => void>;

function getRunner(): GoogleScriptRunner | null {
  const g = (globalThis as unknown as { google?: { script?: { run?: GoogleScriptRunner } } }).google;
  return g?.script?.run ?? null;
}

export const IS_GAS = getRunner() !== null;

export function callGAS<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  const runner = getRunner();
  if (!runner) {
    return mockCall<T>(fn, args);
  }
  return new Promise<T>((resolve, reject) => {
    const ready = runner
      .withSuccessHandler((value) => resolve(value as T))
      .withFailureHandler((err) => reject(err)) as RunnerWithFns;
    ready[fn](...args);
  });
}
