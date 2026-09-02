import { Game, KIND_PROFILE, type BubbleKind } from "./game.ts";

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const bubbleEls = [
  document.querySelector<HTMLButtonElement>("#bubble-0")!,
  document.querySelector<HTMLButtonElement>("#bubble-1")!,
  document.querySelector<HTMLButtonElement>("#bubble-2")!,
];
const scoreEl = document.querySelector<HTMLDivElement>("#score")!;
const bestEl = document.querySelector<HTMLDivElement>("#best")!;
const livesEl = document.querySelector<HTMLDivElement>("#lives")!;
const introEl = document.querySelector<HTMLDivElement>("#intro")!;
const milestoneEl = document.querySelector<HTMLDivElement>("#milestone")!;
const flashEl = document.querySelector<HTMLDivElement>("#flash")!;

const MIN_SIZE = 22;
const MAX_SIZE = 72;
const RESTART_DELAY = 1100;
const KIND_CLASSES: BubbleKind[] = ["gold", "tiny", "large", "bomb", "split"];

const game = new Game();
let lastTime: number | null = null;
let restartAt: number | null = null;
let wasPlaying = game.status === "playing";
let lastLives = game.lives;
let stageWidth = 0;
let stageHeight = 0;

// Status can flip to "over" either inside game.update() (a miss, driven by
// frame()) or inside game.catch() (a bomb, driven by a click handler). Both
// paths funnel through here so the restart timer always gets armed.
function checkRoundOver(now: number): void {
  if (wasPlaying && game.status === "over") {
    flashEl.textContent = String(game.score);
    flashEl.classList.add("show");
    restartAt = now + RESTART_DELAY;
  }
  wasPlaying = game.status === "playing";
}

function measure(): void {
  const rect = stage.getBoundingClientRect();
  stageWidth = rect.width;
  stageHeight = rect.height;
}

function sizeFor(age: number, lifetime: number, kindSize: number): number {
  const remaining = Math.max(0, 1 - age / lifetime);
  return (MIN_SIZE + (MAX_SIZE - MIN_SIZE) * remaining) * kindSize;
}

function spawnFeedback(x: number, y: number, text: string, tone: "" | "gold" | "bad"): void {
  const el = document.createElement("span");
  el.className = tone ? `pop-feedback ${tone}` : "pop-feedback";
  el.textContent = text;
  el.style.left = `${x * stageWidth}px`;
  el.style.top = `${y * stageHeight}px`;
  stage.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function feedbackFor(kind: BubbleKind): { text: string; tone: "" | "gold" | "bad" } {
  if (kind === "bomb") return { text: "boom", tone: "bad" };
  const value = KIND_PROFILE[kind].value;
  return { text: `+${value}`, tone: kind === "gold" ? "gold" : "" };
}

const lastSlotId: (number | null)[] = [null, null, null];

function render(): void {
  bubbleEls.forEach((el, slot) => {
    const bubble = game.bubbles[slot];
    if (!bubble) {
      el.hidden = true;
      lastSlotId[slot] = null;
      return;
    }
    if (lastSlotId[slot] !== bubble.id) el.classList.remove("popped");
    lastSlotId[slot] = bubble.id;
    el.hidden = false;
    for (const kind of KIND_CLASSES) el.classList.remove(`kind-${kind}`);
    if (bubble.kind !== "normal") el.classList.add(`kind-${bubble.kind}`);
    el.dataset.bubbleId = String(bubble.id);
    const size = sizeFor(bubble.age, bubble.lifetime, bubble.size);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${bubble.x * stageWidth - size / 2}px`;
    el.style.top = `${bubble.y * stageHeight - size / 2}px`;
  });

  scoreEl.textContent = String(game.score);
  bestEl.textContent = game.best > 0 ? `best ${game.best}` : "";
  livesEl.textContent = "♥".repeat(Math.max(0, game.lives)) + "♡".repeat(3 - Math.max(0, game.lives));

  if (game.lives < lastLives && game.status === "playing") {
    livesEl.classList.add("hit");
    setTimeout(() => livesEl.classList.remove("hit"), 250);
  }
  lastLives = game.lives;

  milestoneEl.textContent = game.milestone ?? "";
  milestoneEl.classList.toggle("show", game.milestone !== null);

  const tierHue = (Math.floor(game.score / 10) * 37) % 360;
  stage.style.setProperty("--tier-hue", `${tierHue}deg`);
}

function frame(now: number): void {
  if (lastTime === null) lastTime = now;
  const dt = now - lastTime;
  lastTime = now;

  game.update(dt);
  checkRoundOver(now);
  if (game.status === "over" && restartAt !== null && now >= restartAt) {
    flashEl.classList.remove("show");
    game.restart();
    wasPlaying = true;
    lastLives = game.lives;
    restartAt = null;
  }

  render();
  requestAnimationFrame(frame);
}

bubbleEls.forEach((el) => {
  el.addEventListener("click", () => {
    if (game.status !== "playing") return;
    const idStr = el.dataset.bubbleId;
    if (idStr === undefined) return;
    const id = Number(idStr);
    const bubble = game.bubbles.find((b) => b.id === id);
    if (!bubble) return;
    el.classList.add("popped");
    setTimeout(() => el.classList.remove("popped"), 200);
    const { text, tone } = feedbackFor(bubble.kind);
    spawnFeedback(bubble.x, bubble.y, text, tone);
    game.catch(id);
    checkRoundOver(performance.now());
    render();
  });
});

window.addEventListener("resize", measure);
measure();
render();
requestAnimationFrame(frame);
setTimeout(() => introEl.classList.add("hide"), 0);
