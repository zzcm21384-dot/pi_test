# 坦克大战 (Tank Battle)

用 Next.js 14 (App Router) + TypeScript + Canvas 实现的经典坦克大战小游戏。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000

生产构建：

```bash
npm run build
npm start
```

## 操作

| 操作 | 按键 |
| --- | --- |
| 移动 | 方向键 或 WASD |
| 开火 | 空格 或 J |
| 重新开始（结束时） | R |
| 开始游戏 | Enter 或点击按钮 |

## 玩法

- 消灭敌人坦克，每个 +100 分。
- 达到 `关卡 × 1000` 分即可过关，进入下一关（地图更复杂、敌人更快）。
- 生命 3 条，被击中且生命耗尽会扣除一条命，命尽则游戏结束。
- 地形：
  - 砖块：可被子弹击毁
  - 钢块：不可摧毁
  - 水域：无法通行，子弹可飞过
  - 草地：可通行（渲染在地面层）

## 项目结构

```
app/
  layout.tsx      # 根布局
  page.tsx        # 首页
  globals.css     # Tailwind 样式
components/
  TankGame.tsx    # Canvas 渲染 + 输入 + 游戏循环
lib/
  game.ts         # 游戏核心逻辑（地图、移动、碰撞、AI、子弹、爆炸）
```

## 实现要点

- `lib/game.ts` 是与渲染无关的纯逻辑：地图生成、坦克移动与碰撞、子弹分步推进检测、敌人 AI、爆炸粒子。
- `components/TankGame.tsx` 使用 `requestAnimationFrame` 驱动固定循环，`dt` 做时间步长限制；键盘状态放入 `useRef` 避免频繁 re-render。
- 渲染使用 Canvas 2D，绘制砖块、钢块、水波、草地、坦克（含履带/炮塔/炮管）、子弹与径向渐变爆炸效果。
