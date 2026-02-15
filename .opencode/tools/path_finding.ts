import { type Direction, getRules, parseGameState, applyMove, getStatePositions, gameStateCoords } from "./base.js";
import type { Rule } from "./models.js";

interface PriorityQueueItem {
  priority: number;
  position: [number, number];
}

function pushHeap(heap: PriorityQueueItem[], item: PriorityQueueItem): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[parent]!.priority <= heap[i]!.priority) break;
    [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
    i = parent;
  }
}

function popHeap(heap: PriorityQueueItem[]): PriorityQueueItem | undefined {
  if (heap.length === 0) return undefined;
  const result = heap[0]!;
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < heap.length && heap[left]!.priority < heap[smallest]!.priority) {
        smallest = left;
      }
      if (right < heap.length && heap[right]!.priority < heap[smallest]!.priority) {
        smallest = right;
      }
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
      i = smallest;
    }
  }
  return result;
}

function blockedEntities(gameState: string, avoidText: boolean = true): number[][] {
  const rules = getRules(gameState);
  const blockedStates: [string | null, string][] = [[null, "stop"], [null, "defeat"], ["melt", "hot"]];
  const yous = rules.filter((r) => r.state === "you").map((r) => r.entity);
  const matrix = parseGameState(gameState);

  const blockedMatrix: number[][] = [];

  for (let y = 0; y < matrix.length; y++) {
    const rowBlocked: number[] = [];
    for (let x = 0; x < matrix[y]!.length; x++) {
      const entity = matrix[y]![x]!;
      const entities = entity.split("<");
      let blocked = 0;

      for (const e of entities) {
        for (const you of yous) {
          for (const [youReq, blockedState] of blockedStates) {
            const matchingRules = rules.filter((r) => r.entity === e);
            for (const r of matchingRules) {
              if (!youReq && r.state === blockedState) {
                blocked = 1;
              } else if (youReq === you && r.state === blockedState) {
                blocked = 1;
              }
            }
          }
        }
        if (avoidText && e.startsWith("text_")) {
          blocked = 1;
        }
      }
      rowBlocked.push(blocked);
    }
    blockedMatrix.push(rowBlocked);
  }
  return blockedMatrix;
}

function heuristic(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

type Node = [number, number];

function aStar(
  grid: number[][],
  start: Node,
  goal: Node
): Node[] | null {
  if (
    grid[start[1]]?.[start[0]] === 1 ||
    grid[goal[1]]?.[goal[0]] === 1
  ) {
    return null;
  }

  const neighbors: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const shape: [number, number] = [grid[0]!.length, grid.length];

  const closeSet = new Set<string>();
  const cameFrom = new Map<string, Node>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const oheap: PriorityQueueItem[] = [];

  const startKey = `${start[0]},${start[1]}`;
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, goal));
  pushHeap(oheap, { priority: heuristic(start, goal), position: start });

  while (oheap.length > 0) {
    const current = popHeap(oheap)!.position;
    const currentKey = `${current[0]},${current[1]}`;

    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path: Node[] = [];
      let curr: Node | undefined = current;
      while (curr) {
        path.unshift(curr);
        curr = cameFrom.get(`${curr[0]},${curr[1]}`);
      }
      return path;
    }

    closeSet.add(currentKey);

    for (const [di, dj] of neighbors) {
      const neighbor: Node = [current[0] + di, current[1] + dj];
      const neighborKey = `${neighbor[0]},${neighbor[1]}`;

      if (
        0 <= neighbor[0] &&
        neighbor[0] < shape[0] &&
        0 <= neighbor[1] &&
        neighbor[1] < shape[1]
      ) {
        if (grid[neighbor[1]][neighbor[0]] === 1) {
          continue;
        }
      } else {
        continue;
      }

      if (closeSet.has(neighborKey)) continue;

      const tentativeGScore =
        (gScore.get(currentKey) ?? Infinity) + heuristic(current, neighbor);

      if (
        tentativeGScore < (gScore.get(neighborKey) ?? Infinity) ||
        !oheap.some((item) => item.position[0] === neighbor[0] && item.position[1] === neighbor[1])
      ) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + heuristic(neighbor, goal));
        pushHeap(oheap, {
          priority: tentativeGScore + heuristic(neighbor, goal),
          position: neighbor,
        });
      }
    }
  }

  return null;
}

const directionLookup: Record<string, Direction> = {
  "0,1": "down",
  "0,-1": "up",
  "1,0": "right",
  "-1,0": "left",
};

export function convertPathToMoves(path: Node[]): Direction[] {
  const diffs: [number, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    diffs.push([b[0] - a[0], b[1] - a[1]]);
  }
  return diffs.map((d) => directionLookup[`${d[0]},${d[1]}`] as Direction);
}

export function shortestPath(
  gameState: string,
  goal: [number, number],
  lastMove: Direction
): Direction[] {
  const goalCoord: [number, number] = [goal[0] - 1, goal[1] - 1];
  const goalPrev = applyMove(goalCoord, lastMove, true);
  const blocked = blockedEntities(gameState);
  const blockedNoText = blockedEntities(gameState, false);

  if (blockedNoText[goalCoord[1]]?.[goalCoord[0]]) {
    return [];
  }

  if (blocked[goalPrev[1]]?.[goalPrev[0]]) {
    return [];
  }

  const youPositions = getStatePositions(gameState, "you");

  for (const you of youPositions) {
    const youCoord: [number, number] = [you[0] - 1, you[1] - 1];
    const path = aStar(blocked, youCoord, goalPrev);

    if (path === null) {
      continue;
    }

    const moves = convertPathToMoves([youCoord, ...path]);
    return [...moves, lastMove];
  }

  return [];
}

export function reachableEntities(
  gameState: string
): [number, number, string][] {
  const coords = gameStateCoords(gameState);
  const reachable: [number, number, string][] = [];

  for (const [x, y, entity] of coords) {
    const lastMoves: Direction[] = ["up", "down", "left", "right"];
    let pathFound = false;

    for (const lastMove of lastMoves) {
      const p = shortestPath(gameState, [x, y], lastMove);
      if (p.length > 0) {
        pathFound = true;
        break;
      }
    }

    if (pathFound) {
      reachable.push([x, y, entity]);
    }
  }

  return reachable;
}
