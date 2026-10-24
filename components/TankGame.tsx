"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  GameState,
  createInitialState,
  updateGame,
  TILE,
  WIDTH,
  HEIGHT,
  TANK_SIZE,
  Direction,
} from "@/lib/game";

export default function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(1));
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  });
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const [ui, setUi] = useState({
    score: 0,
    lives: 3,
    level: 1,
    status: "playing" as GameState["status"],
  });
  const [started, setStarted] = useState(false);

  const draw = useCallback((state: GameState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 背景
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 地板网格
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let c = 0; c <= WIDTH / TILE; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, 0);
      ctx.lineTo(c * TILE, HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= HEIGHT / TILE; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE);
      ctx.lineTo(WIDTH, r * TILE);
      ctx.stroke();
    }

    // 地图
    for (let r = 0; r < state.map.length; r++) {
      for (let c = 0; c < state.map[r].length; c++) {
        const t = state.map[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (t === "brick") {
          ctx.fillStyle = "#a0522d";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "#5c2e16";
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y + i * 8);
            ctx.lineTo(x + TILE, y + i * 8);
            ctx.stroke();
            const off = i % 2 === 0 ? 0 : 8;
            for (let j = off; j < TILE; j += 16) {
              ctx.beginPath();
              ctx.moveTo(x + j, y + i * 8);
              ctx.lineTo(x + j, y + i * 8 + 8);
              ctx.stroke();
            }
          }
        } else if (t === "steel") {
          ctx.fillStyle = "#8899aa";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "#c8d8e8";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "#5f6f80";
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        } else if (t === "water") {
          ctx.fillStyle = "#1e4d8c";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "#3a7bd5";
          ctx.lineWidth = 1;
          for (let i = 6; i < TILE; i += 8) {
            ctx.beginPath();
            ctx.moveTo(x, y + i);
            ctx.bezierCurveTo(x + 8, y + i - 3, x + 16, y + i + 3, x + TILE, y + i);
            ctx.stroke();
          }
        } else if (t === "grass") {
          ctx.fillStyle = "#1f6b2f";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#2f9c45";
          for (let k = 0; k < 6; k++) {
            ctx.fillRect(x + Math.random() * (TILE - 4), y + Math.random() * (TILE - 4), 3, 3);
          }
        }
      }
    }

    // 坦克绘制
    const drawTank = (x: number, y: number, dir: Direction, isPlayer: boolean) => {
      ctx.save();
      ctx.translate(x + TANK_SIZE / 2, y + TANK_SIZE / 2);
      const angle =
        dir === "up" ? 0 : dir === "right" ? Math.PI / 2 : dir === "down" ? Math.PI : -Math.PI / 2;
      ctx.rotate(angle);

      // 履带
      ctx.fillStyle = isPlayer ? "#2e7d32" : "#8b1a1a";
      ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, 6, TANK_SIZE);
      ctx.fillRect(TANK_SIZE / 2 - 6, -TANK_SIZE / 2, 6, TANK_SIZE);
      ctx.fillStyle = isPlayer ? "#1b5e20" : "#5c1010";
      for (let i = -TANK_SIZE / 2 + 2; i < TANK_SIZE / 2; i += 5) {
        ctx.fillRect(-TANK_SIZE / 2, i, 6, 2);
        ctx.fillRect(TANK_SIZE / 2 - 6, i, 6, 2);
      }

      // 车身
      ctx.fillStyle = isPlayer ? "#43a047" : "#c62828";
      ctx.fillRect(-TANK_SIZE / 2 + 6, -TANK_SIZE / 2 + 3, TANK_SIZE - 12, TANK_SIZE - 6);

      // 炮塔
      ctx.fillStyle = isPlayer ? "#66bb6a" : "#ef5350";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // 炮管
      ctx.fillStyle = isPlayer ? "#a5d6a7" : "#ff8a80";
      ctx.fillRect(-2, -TANK_SIZE / 2 - 2, 4, TANK_SIZE / 2 + 2);

      ctx.restore();
    };

    for (const e of state.enemies) {
      if (!e.dead) drawTank(e.x, e.y, e.dir, false);
    }
    if (!state.player.dead) {
      drawTank(state.player.x, state.player.y, state.player.dir, true);
    }

    // 子弹
    for (const b of state.bullets) {
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(b.x + 3, b.y + 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff59d";
      ctx.beginPath();
      ctx.arc(b.x + 3, b.y + 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 爆炸
    for (const ex of state.explosions) {
      const t = ex.age / ex.max;
      const r = 6 + t * 26;
      const alpha = 1 - t;
      ctx.globalAlpha = alpha;
      const grd = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
      grd.addColorStop(0, "#fff9c4");
      grd.addColorStop(0.4, "#ff9800");
      grd.addColorStop(1, "rgba(183,28,28,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, []);

  const loop = useCallback(
    (time: number) => {
      const last = lastTimeRef.current || time;
      let dt = (time - last) / 1000;
      lastTimeRef.current = time;
      if (dt > 0.1) dt = 0.1; // 防止切后台跳变
      const state = stateRef.current;

      if (state.status === "playing") {
        updateGame(state, dt, {
          ...keysRef.current,
          fire: keysRef.current.fire,
        });
      }

      draw(state);

      setUi((prev) => {
        if (prev.score !== state.score || prev.lives !== state.lives || prev.level !== state.level || prev.status !== state.status) {
          return { score: state.score, lives: state.lives, level: state.level, status: state.status };
        }
        return prev;
      });

      rafRef.current = requestAnimationFrame(loop);
    },
    [draw]
  );

  const startGame = useCallback((level = 1) => {
    stateRef.current = createInitialState(level);
    setStarted(true);
    lastTimeRef.current = 0;
  }, []);

  const restart = useCallback(() => {
    startGame(1);
  }, [startGame]);

  // 输入监听
  useEffect(() => {
    const keyMap: Record<string, keyof typeof keysRef.current> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
      W: "up",
      S: "down",
      A: "left",
      D: "right",
      " ": "fire",
      j: "fire",
      J: "fire",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = keyMap[e.key];
      if (k) {
        keysRef.current[k] = true;
        if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
      }
      if ((e.key === "r" || e.key === "R") && stateRef.current.status !== "playing") {
        restart();
      }
      if (e.key === "Enter" && !started) {
        startGame(1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = keyMap[e.key];
      if (k) keysRef.current[k] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [restart, startGame, started]);

  // 游戏循环
  useEffect(() => {
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[480px] items-center justify-between font-mono text-sm text-green-300">
        <div className="flex gap-4">
          <span>
            分数: <span className="text-yellow-300">{ui.score}</span>
          </span>
          <span>
            生命: <span className="text-red-400">{"❤".repeat(Math.max(0, ui.lives))}</span>
          </span>
        </div>
        <span>关卡 {ui.level}</span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="rounded border-4 border-gray-700 shadow-2xl"
        />

        {(!started || ui.status !== "playing") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
            {!started ? (
              <>
                <h2 className="text-2xl font-bold text-green-400">坦克大战</h2>
                <p className="text-sm text-gray-300">方向键 / WASD 移动 · 空格 / J 开火</p>
                <button
                  onClick={() => startGame(1)}
                  className="rounded bg-green-600 px-6 py-2 font-bold text-white hover:bg-green-500"
                >
                  开始游戏
                </button>
              </>
            ) : ui.status === "win" ? (
              <>
                <h2 className="text-3xl font-bold text-yellow-400">关卡胜利!</h2>
                <p className="text-gray-200">得分: {ui.score}</p>
                <button
                  onClick={() => startGame(ui.level + 1)}
                  className="rounded bg-yellow-600 px-6 py-2 font-bold text-white hover:bg-yellow-500"
                >
                  进入下一关
                </button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-red-500">游戏结束</h2>
                <p className="text-gray-200">得分: {ui.score}</p>
                <button
                  onClick={restart}
                  className="rounded bg-red-600 px-6 py-2 font-bold text-white hover:bg-red-500"
                >
                  重新开始 (R)
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex max-w-[480px] flex-col items-center gap-1 text-center text-xs text-gray-400">
        <p>方向键 / WASD 移动 · 空格 / J 开火 · 消灭敌人得分，达到目标分数即可过关</p>
        <p>砖块可被击毁，钢块不可摧毁，水域无法通行</p>
      </div>
    </div>
  );
}
