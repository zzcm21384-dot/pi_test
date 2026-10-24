// 坦克大战 - 游戏核心逻辑与类型定义

export const TILE = 32; // 每个格子像素
export const COLS = 15; // 横向格子数
export const ROWS = 15; // 纵向格子数
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const TANK_SIZE = 28;

export type Direction = "up" | "down" | "left" | "right";

export interface Vec {
  x: number;
  y: number;
}

export type TileType = "empty" | "brick" | "steel" | "water" | "grass";

export interface Bullet {
  id: number;
  x: number;
  y: number;
  dir: Direction;
  owner: "player" | "enemy";
  speed: number;
  dead: boolean;
}

export interface Tank {
  id: number;
  x: number;
  y: number;
  dir: Direction;
  isPlayer: boolean;
  speed: number;
  hp: number;
  cooldown: number;
  dead: boolean;
  // AI 用
  aiDirTimer?: number;
}

export interface Explosion {
  x: number;
  y: number;
  age: number; // 0..1
  max: number;
}

export interface GameState {
  map: TileType[][];
  player: Tank;
  enemies: Tank[];
  bullets: Bullet[];
  explosions: Explosion[];
  score: number;
  lives: number;
  level: number;
  status: "playing" | "win" | "lose";
  nextId: number;
  spawnTimer: number;
}

const DIR_VECTORS: Record<Direction, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function dirVector(dir: Direction): Vec {
  return DIR_VECTORS[dir];
}

// 生成关卡地图
export function createMap(level: number): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push("empty");
    }
    map.push(row);
  }

  // 随机 + 对称摆放砖块
  const rand = mulberry32(level * 9973 + 12345);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < Math.ceil(COLS / 2); c++) {
      // 出生点附近留空
      const nearPlayerSpawn = r >= ROWS - 3 && c >= Math.floor(COLS / 2) - 1 && c <= Math.floor(COLS / 2) + 1;
      const nearEnemySpawn = r <= 2 && (c <= 1 || c >= COLS - 2);
      if (nearPlayerSpawn || nearEnemySpawn) continue;

      const v = rand();
      let tile: TileType = "empty";
      if (v < 0.28) tile = "brick";
      else if (v < 0.34) tile = "steel";
      else if (v < 0.38) tile = "water";
      else if (v < 0.44) tile = "grass";

      map[r][c] = tile;
      map[r][COLS - 1 - c] = tile;
    }
  }
  return map;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTank(id: number, x: number, y: number, isPlayer: boolean, dir: Direction): Tank {
  return {
    id,
    x,
    y,
    dir,
    isPlayer,
    speed: isPlayer ? 2.4 : 1.2 + Math.random() * 0.6,
    hp: isPlayer ? 1 : 1,
    cooldown: 0,
    dead: false,
    aiDirTimer: 0,
  };
}

export function createInitialState(level = 1): GameState {
  const map = createMap(level);
  const state: GameState = {
    map,
    player: makeTank(1, WIDTH / 2 - TANK_SIZE / 2, HEIGHT - TILE - TANK_SIZE / 2, true, "up"),
    enemies: [],
    bullets: [],
    explosions: [],
    score: 0,
    lives: 3,
    level,
    status: "playing",
    nextId: 2,
    spawnTimer: 0,
  };
  return state;
}

// 与地图的碰撞检测（坦克）
export function tankCanMove(
  map: TileType[][],
  x: number,
  y: number,
  ignoreWater = false
): boolean {
  if (x < 0 || y < 0 || x + TANK_SIZE > WIDTH || y + TANK_SIZE > HEIGHT) return false;
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + TANK_SIZE - 1) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + TANK_SIZE - 1) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const t = map[r]?.[c];
      if (t === "brick" || t === "steel") return false;
      if (t === "water" && !ignoreWater) return false;
    }
  }
  return true;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function moveTank(map: TileType[][], tank: Tank, dir: Direction, otherTanks: Tank[]) {
  tank.dir = dir;
  const v = dirVector(dir);
  const nx = tank.x + v.x * tank.speed;
  const ny = tank.y + v.y * tank.speed;

  if (!tankCanMove(map, nx, ny)) return;

  // 与其他坦克碰撞
  for (const o of otherTanks) {
    if (o.id === tank.id || o.dead) continue;
    if (rectsOverlap(nx, ny, TANK_SIZE, TANK_SIZE, o.x, o.y, TANK_SIZE, TANK_SIZE)) {
      return;
    }
  }

  tank.x = nx;
  tank.y = ny;
}

export function spawnBullet(state: GameState, tank: Tank): Bullet | null {
  if (tank.dead || tank.cooldown > 0) return null;
  tank.cooldown = tank.isPlayer ? 0.35 : 0.9;
  const v = dirVector(tank.dir);
  const cx = tank.x + TANK_SIZE / 2 + v.x * (TANK_SIZE / 2 + 2);
  const cy = tank.y + TANK_SIZE / 2 + v.y * (TANK_SIZE / 2 + 2);
  return {
    id: state.nextId++,
    x: cx - 3,
    y: cy - 3,
    dir: tank.dir,
    owner: tank.isPlayer ? "player" : "enemy",
    speed: tank.isPlayer ? 6 : 4,
    dead: false,
  };
}

export function updateBullets(state: GameState, dt: number) {
  const BULLET_R = 6;
  for (const b of state.bullets) {
    if (b.dead) continue;
    const steps = 4;
    const v = dirVector(b.dir);
    let hit = false;

    for (let s = 0; s < steps && !hit; s++) {
      b.x += (v.x * b.speed) / steps;
      b.y += (v.y * b.speed) / steps;

      // 边界
      if (b.x < 0 || b.y < 0 || b.x + BULLET_R * 2 > WIDTH || b.y + BULLET_R * 2 > HEIGHT) {
        hit = true;
        break;
      }

      // 地图碰撞
      const c = Math.floor((b.x + BULLET_R) / TILE);
      const r = Math.floor((b.y + BULLET_R) / TILE);
      const tile = state.map[r]?.[c];
      if (tile === "brick") {
        state.map[r][c] = "empty";
        hit = true;
        break;
      }
      if (tile === "steel") {
        hit = true;
        break;
      }

      // 子弹互相碰撞
      for (const other of state.bullets) {
        if (other === b || other.dead) continue;
        if (rectsOverlap(b.x, b.y, BULLET_R * 2, BULLET_R * 2, other.x, other.y, BULLET_R * 2, BULLET_R * 2)) {
          if (b.owner !== other.owner) {
            b.dead = true;
            other.dead = true;
          }
          hit = true;
          break;
        }
      }
      if (hit) break;

      // 命中坦克
      if (b.owner === "player") {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (rectsOverlap(b.x, b.y, BULLET_R * 2, BULLET_R * 2, e.x, e.y, TANK_SIZE, TANK_SIZE)) {
            e.hp -= 1;
            b.dead = true;
            hit = true;
            if (e.hp <= 0) {
              e.dead = true;
              state.score += 100;
              addExplosion(state, e.x + TANK_SIZE / 2, e.y + TANK_SIZE / 2, 1.6);
            }
            break;
          }
        }
      } else {
        const p = state.player;
        if (!p.dead && rectsOverlap(b.x, b.y, BULLET_R * 2, BULLET_R * 2, p.x, p.y, TANK_SIZE, TANK_SIZE)) {
          b.dead = true;
          hit = true;
          p.hp -= 1;
          if (p.hp <= 0) {
            p.dead = true;
            state.lives -= 1;
            addExplosion(state, p.x + TANK_SIZE / 2, p.y + TANK_SIZE / 2, 1.8);
          }
        }
      }
    }

    if (hit && !b.dead) {
      b.dead = true;
      addExplosion(state, b.x + BULLET_R, b.y + BULLET_R, 0.5);
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

export function addExplosion(state: GameState, x: number, y: number, max = 1) {
  state.explosions.push({ x, y, age: 0, max });
}

export function updateExplosions(state: GameState, dt: number) {
  for (const ex of state.explosions) {
    ex.age += dt * 2.5;
  }
  state.explosions = state.explosions.filter((e) => e.age < e.max);
}

// 简单的敌人 AI
export function updateEnemyAI(state: GameState, dt: number) {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.aiDirTimer = (e.aiDirTimer ?? 0) - dt;

    // 靠近玩家时尝试朝向玩家
    const p = state.player;
    let chosen: Direction | null = null;
    if (!p.dead && Math.random() < 0.6) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (Math.abs(dx) > Math.abs(dy)) chosen = dx > 0 ? "right" : "left";
      else chosen = dy > 0 ? "down" : "up";
    }

    if ((e.aiDirTimer ?? 0) <= 0 || e.dir === chosen) {
      // 检查前方是否可走
      const v = dirVector(e.dir);
      if (!tankCanMove(state.map, e.x + v.x * e.speed, e.y + v.y * e.speed) || Math.random() < 0.02) {
        chosen = dirs[Math.floor(Math.random() * dirs.length)];
      }
      e.aiDirTimer = 0.6 + Math.random() * 1.2;
    }

    const dir = chosen ?? e.dir;
    moveTank(state.map, e, dir, [state.player, ...state.enemies]);

    // 随机开火
    if (Math.random() < dt * 0.6) {
      const b = spawnBullet(state, e);
      if (b) state.bullets.push(b);
    }
  }
}

export function updateSpawns(state: GameState, dt: number) {
  const aliveEnemies = state.enemies.filter((e) => !e.dead).length;
  if (aliveEnemies >= 4) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = 2.0;

  const spawnPoints = [
    { x: TILE * 0.5, y: TILE * 0.5 },
    { x: WIDTH - TILE * 1.5, y: TILE * 0.5 },
    { x: WIDTH / 2 - TANK_SIZE / 2, y: TILE * 0.5 },
  ];
  const sp = spawnPoints[state.nextId % spawnPoints.length];
  if (!tankCanMove(state.map, sp.x, sp.y)) return;

  const e = makeTank(state.nextId++, sp.x, sp.y, false, "down");
  // 关卡越高速度略快
  e.speed = 1.0 + state.level * 0.1 + Math.random() * 0.4;
  state.enemies.push(e);
  state.enemies = state.enemies.filter((en) => !en.dead);
}

export function updateGame(state: GameState, dt: number, input: { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }): GameState {
  if (state.status !== "playing") return state;

  // 冷却
  if (state.player.cooldown > 0) state.player.cooldown -= dt;
  for (const e of state.enemies) if (e.cooldown > 0) e.cooldown -= dt;

  // 玩家复活
  if (state.player.dead) {
    if (state.lives <= 0) {
      state.status = "lose";
      return state;
    }
    // 简单立即复活
    state.player.dead = false;
    state.player.hp = 1;
    state.player.x = WIDTH / 2 - TANK_SIZE / 2;
    state.player.y = HEIGHT - TILE - TANK_SIZE / 2;
    state.player.dir = "up";
    state.player.cooldown = 1.0;
  }

  // 玩家移动
  let dir: Direction | null = null;
  if (input.up) dir = "up";
  else if (input.down) dir = "down";
  else if (input.left) dir = "left";
  else if (input.right) dir = "right";

  if (dir) {
    moveTank(state.map, state.player, dir, state.enemies);
  }

  if (input.fire) {
    const b = spawnBullet(state, state.player);
    if (b) state.bullets.push(b);
  }

  updateEnemyAI(state, dt);
  updateBullets(state, dt);
  updateExplosions(state, dt);
  updateSpawns(state, dt);

  // 判定胜利：达到分数目标或清空敌人足够多
  if (state.score >= state.level * 1000) {
    state.status = "win";
  }

  return state;
}
