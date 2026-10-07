"use client"

import * as React from "react"

const CELL = 7
const STEP = CELL + 1
const ROWS = 5
const HEIGHT = 44
const TOP = (HEIGHT - (ROWS * STEP - 1)) / 2
const TICK = 110
const START = 5 // segments to begin with
const MAX = 16 // after this many it sheds back to the start length

type Cell = [x: number, y: number]
type Game = { body: Cell[]; food: Cell } // the head is the last segment

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]

function start(cols: number): Game {
  const body = Array.from({ length: START }, (_, i): Cell => [i + 2, 2])
  return { body, food: [Math.min(cols - 2, START + 12), 1] }
}

function placeFood(body: Cell[], cols: number): Cell {
  for (let tries = 0; tries < 40; tries++) {
    const cell: Cell = [Math.floor(Math.random() * cols), Math.floor(Math.random() * ROWS)]
    if (!body.some((b) => same(b, cell))) return cell
  }
  return [cols - 1, 0]
}

// One move: towards the food, around its own body, growing by a segment when it eats.
function step({ body, food }: Game, cols: number): Game {
  const [x, y] = body[body.length - 1]
  const towards = (d: number): number[] => (d ? [Math.sign(d), -Math.sign(d)] : [1, -1])
  const [dx, dy] = [food[0] - x, food[1] - y]
  const moves: Cell[] = [
    ...(dx ? [[x + towards(dx)[0], y] as Cell] : []),
    ...(dy ? [[x, y + towards(dy)[0]] as Cell] : []),
    [x, y + towards(dy)[1]],
    [x + towards(dx)[1], y],
    [x, y + towards(dy)[0]],
    [x + towards(dx)[0], y],
  ]
  const rest = body.slice(1) // the tail moves out of the way
  const next = moves.find(([cx, cy]) => cx >= 0 && cx < cols && cy >= 0 && cy < ROWS && !rest.some((b) => same(b, [cx, cy])))
  if (!next) return start(cols) // boxed in
  if (!same(next, food)) return { body: [...rest, next], food }
  const grown = [...body, next]
  const kept = grown.length > MAX ? grown.slice(-START) : grown
  return { body: kept, food: placeFood(kept, cols) }
}

// A snake that plays itself in a strip above the composer while an agent is working.
export function WorkingSnake({ label }: { label: string }) {
  const strip = React.useRef<HTMLDivElement>(null)
  const [cols, setCols] = React.useState(0)
  const [game, setGame] = React.useState<Game | null>(null)

  React.useEffect(() => {
    const node = strip.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width / STEP)
      setCols(next)
      setGame(next > START + 4 ? start(next) : null)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    // With reduced motion the snake is shown still.
    if (!cols || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => setGame((prev) => prev && step(prev, cols)), TICK)
    return () => clearInterval(timer)
  }, [cols])

  return (
    <div ref={strip} aria-hidden className="relative h-11 border-y">
      <span className="absolute top-0.5 right-0.5 text-[11px] text-subtle">{label}</span>
      {game && (
        <svg width="100%" height={HEIGHT} className="block">
          {game.body.map(([x, y], i) => {
            const head = i === game.body.length - 1
            return (
              <rect
                key={i}
                x={x * STEP}
                y={TOP + y * STEP}
                width={CELL}
                height={CELL}
                rx={1.5}
                className={head ? "fill-foreground" : i < 2 ? "fill-subtle" : "fill-muted-foreground"}
              />
            )
          })}
          <circle cx={game.food[0] * STEP + CELL / 2} cy={TOP + game.food[1] * STEP + CELL / 2} r={2} className="fill-foreground" />
        </svg>
      )}
    </div>
  )
}
