import { Game, KIND_PROFILE, type BubbleKind } from "./game.ts";

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const bubbleEls = [
  document.querySelector<HTMLButtonElement>("#bubble-0")!,
  document.querySelector<HTMLButtonElement>("#bubble-1")!,
  document.querySelector<HTMLButtonElement>("#bubble-2")!,
  document.querySelector<HTMLButtonElement>("#bubble-3")!,
  document.querySelector<HTMLButtonElement>("#bubble-4")!,
];
const scoreEl = document.querySelector<HTMLDivElement>("#score")!;
const bestEl = document.querySelector<HTMLDivElement>("#best")!;
const livesEl = document.querySelector<HTMLDivElement>("#lives")!;
const introEl = document.querySelector<HTMLDivElement>("#intro")!;
const milestoneEl = document.querySelector<HTMLDivElement>("#milestone")!;
const gameoverEl = document.querySelector<HTMLDivElement>("#gameover")!;
const gameoverScoreEl = document.querySelector<HTMLDivElement>("#gameover-score")!;
const newGameEl = document.querySelector<HTMLButtonElement>("#new-game")!;

const MIN_SIZE = 22;
const MAX_SIZE = 72;
const KIND_CLASSES: BubbleKind[] = ["real"];

const game = new Game();
let lastTime: number | null = null;
let lastLives = game.lives;
let stageWidth = 0;
let stageHeight = 0;

function measure(): void {
  const rect = stage.getBoundingClientRect();
  stageWidth = rect.width;
  stageHeight = rect.height;
}

function sizeFor(age: number, lifetime: number): number {
  const remaining = Math.max(0, 1 - age / lifetime);
  return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * remaining;
}

function spawnFeedback(x: number, y: number, text: string, tone: "" | "gold"): void {
  const el = document.createElement("span");
  el.className = tone ? `pop-feedback ${tone}` : "pop-feedback";
  el.textContent = text;
  el.style.left = `${x * stageWidth}px`;
  el.style.top = `${y * stageHeight}px`;
  stage.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function feedbackFor(kind: BubbleKind): { text: string; tone: "" | "gold" } | null {
  if (kind === "fake") return null;
  return { text: `+${KIND_PROFILE[kind].value}`, tone: kind === "real" ? "gold" : "" };
}

const lastSlotId: (number | null)[] = bubbleEls.map(() => null);

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
    if (bubble.kind === "real") el.classList.add("kind-real");
    el.dataset.bubbleId = String(bubble.id);
    const size = sizeFor(bubble.age, bubble.lifetime);
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

  gameoverEl.hidden = game.status !== "over";
  if (game.status === "over") {
    gameoverScoreEl.textContent = `score ${game.score} · best ${game.best}`;
  }
}

function frame(now: number): void {
  if (lastTime === null) lastTime = now;
  const dt = now - lastTime;
  lastTime = now;

  game.update(dt);
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
    const feedback = feedbackFor(bubble.kind);
    if (feedback) spawnFeedback(bubble.x, bubble.y, feedback.text, feedback.tone);
    game.catch(id);
    render();
  });
});

newGameEl.addEventListener("click", () => {
  game.restart();
  lastLives = game.lives;
  render();
});

window.addEventListener("resize", measure);
measure();
render();
requestAnimationFrame(frame);
setTimeout(() => introEl.classList.add("hide"), 0);
