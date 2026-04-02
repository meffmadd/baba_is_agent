import { type Direction, getRules, parseGameState, applyMove, getStatePositions, gameStateCoords } from "./base.js";
import type { Rule, ReachableEntity } from "./models.js";

interface PriorityQueueItem {
  priority: number;
  position: { x: number; y: number };
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

export function blockedEntities(gameState: string, avoidText: boolean = true): number[][] {
  const rules = getRules(gameState);
  const blockedStates: [string | null, string][] = [[null, "stop"], [null, "defeat"], [null, "sink"], ["melt", "hot"]];
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

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

type Node = { x: number; y: number };

export function aStar(
  grid: number[][],
  start: Node,
  goal: Node
): Node[] | null {
  if (
    grid[start.y]?.[start.x] === 1 ||
    grid[goal.y]?.[goal.x] === 1
  ) {
    return null;
  }

  const neighbors: { x: number; y: number }[] = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];
  const shape: { x: number; y: number } = { x: grid[0]!.length, y: grid.length };

  const closeSet = new Set<string>();
  const cameFrom = new Map<string, Node>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const oheap: PriorityQueueItem[] = [];

  const startKey = `${start.x},${start.y}`;
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, goal));
  pushHeap(oheap, { priority: heuristic(start, goal), position: start });

  while (oheap.length > 0) {
    const current = popHeap(oheap)!.position;
    const currentKey = `${current.x},${current.y}`;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Node[] = [];
      let curr: Node | undefined = current;
      while (curr) {
        path.unshift(curr);
        curr = cameFrom.get(`${curr.x},${curr.y}`);
      }
      return path;
    }

    closeSet.add(currentKey);

    for (const { x: di, y: dj } of neighbors) {
      const neighbor: Node = { x: current.x + di, y: current.y + dj };
      const neighborKey = `${neighbor.x},${neighbor.y}`;

      if (
        0 <= neighbor.x &&
        neighbor.x < shape.x &&
        0 <= neighbor.y &&
        neighbor.y < shape.y
      ) {
        if (grid[neighbor.y][neighbor.x] === 1) {
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
        !oheap.some((item) => item.position.x === neighbor.x && item.position.y === neighbor.y)
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
  const diffs: { x: number; y: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    diffs.push({ x: b.x - a.x, y: b.y - a.y });
  }
  return diffs.map((d) => directionLookup[`${d.x},${d.y}`] as Direction);
}

export function shortestPath(
  gameState: string,
  goal: { x: number; y: number },
  lastMove: Direction
): Direction[] {
  const goalCoord: { x: number; y: number } = { x: goal.x - 1, y: goal.y - 1 };
  const goalPrev = applyMove(goalCoord, lastMove, true);
  const blocked = blockedEntities(gameState);
  const blockedNoText = blockedEntities(gameState, false);

  if (blockedNoText[goalCoord.y]?.[goalCoord.x]) {
    return [];
  }

  if (blocked[goalPrev.y]?.[goalPrev.x]) {
    return [];
  }

  const youPositions = getStatePositions(gameState, "you");
  
  let shortestMoves: Direction[] | null = null;
  
  for (const you of youPositions) {
    const youCoord: { x: number; y: number } = { x: you.x - 1, y: you.y - 1 };
    const path = aStar(blocked, youCoord, goalPrev);

    if (path === null) {
      continue;
    }

    const moves = convertPathToMoves(path);
    const fullPath = [...moves, lastMove];
    
    if (shortestMoves === null || fullPath.length < shortestMoves.length) {
      shortestMoves = fullPath;
    }
  }

  return shortestMoves ?? [];
}

export function reachableEntities(
  gameState: string
): ReachableEntity[] {
  const coords = gameStateCoords(gameState);
  const reachable: ReachableEntity[] = [];

  for (const { x, y, entity } of coords) {
    const lastMoves: Direction[] = ["up", "down", "left", "right"];
    let pathFound = false;

    for (const lastMove of lastMoves) {
      const p = shortestPath(gameState, { x, y }, lastMove);
      if (p.length > 0) {
        pathFound = true;
        break;
      }
    }

    if (pathFound) {
      reachable.push({ x, y, entity });
    }
  }

  return reachable;
}
