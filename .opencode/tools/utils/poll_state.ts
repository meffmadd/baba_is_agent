import * as fs from "fs";
import * as path from "path";
import { getRawGameState } from "./get_game_state.js";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
export const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

const DEFAULT_MIN_WAIT_MS = 3000;
const DEFAULT_MAX_WAIT_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = 100;

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getLastProcessed(): number {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("last_processed=")) {
        return parseInt(line.split("=")[1].trim(), 10);
      }
    }
  } catch {
    return -1;
  }
  return -1;
}

export function checkWinStatus(): boolean {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    let currentSection = "";

    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        currentSection = trimmedLine.slice(1, -1);
        continue;
      }

      if (currentSection === "status" && trimmedLine.startsWith("level_won=")) {
        return trimmedLine.split("=")[1].trim() === "true";
      }
    }
  } catch {
    return false;
  }
  return false;
}

function getMtimeMs(): number {
  try {
    return fs.statSync(STATE_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

export interface PollResult {
  rawState: { grid: string[][]; width: number; height: number };
  lastProcessed: number;
  confirmed: boolean;
  stateFileChanged: boolean;
}

export interface PollOptions {
  minWaitMs?: number;
  maxWaitMs?: number;
  pollIntervalMs?: number;
}

export async function waitForStateSettle(options?: PollOptions): Promise<PollResult> {
  const minWaitMs = options?.minWaitMs ?? DEFAULT_MIN_WAIT_MS;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const startTime = Date.now();
  const beforeMtime = getMtimeMs();

  let stateFileChanged = false;

  while (Date.now() - startTime < maxWaitMs) {
    const currentMtime = getMtimeMs();
    if (currentMtime > beforeMtime) {
      stateFileChanged = true;
      break;
    }
    await sleep(pollIntervalMs);
  }

  const elapsed = Date.now() - startTime;
  if (elapsed < minWaitMs) {
    await sleep(minWaitMs - elapsed);
  }

  const rawState = await getRawGameState();
  const lastProcessed = getLastProcessed();

  return {
    rawState,
    lastProcessed,
    confirmed: stateFileChanged,
    stateFileChanged,
  };
}