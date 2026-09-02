// Pure game logic, no DOM: bubbles drift inside the unit square. Most are
// plain "normal" bubbles worth a point. Occasionally one splits into 2-5
// bubbles at once — exactly one of them is "real" (distinctively colored)
// and the rest are "fake" decoys. Catching the real one scores and clears
// the decoys; catching a fake just pops it. Missing a normal or real bubble
// costs a life (a fake timing out is harmless); losing the third life ends
// the round.
export type GameStatus = "playing" | "over";

export type BubbleKind = "normal" | "real" | "fake";

export interface BubbleState {
  id: number;
  kind: BubbleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
}

const MARGIN = 0.08;
const MIN_LIFETIME = 650;
const BASE_LIFETIME = 2200;
const LIFETIME_STEP = 90;
const BASE_SPEED = 0.06;
const SPEED_STEP = 0.006;
const START_LIVES = 3;
const MILESTONE_EVERY = 5;
const MILESTONE_DURATION = 1400;
const SPLIT_CHANCE = 0.22;
const SPLIT_MIN = 2;
const SPLIT_MAX = 5;

export const KIND_PROFILE: Record<BubbleKind, { value: number }> = {
  normal: { value: 1 },
  real: { value: 3 },
  fake: { value: 0 },
};

export class Game {
  score = 0;
  best = 0;
  lives = START_LIVES;
  status: GameStatus = "playing";
  bubbles: BubbleState[];
  milestone: string | null = null;
  private milestoneRemaining = 0;
  private nextId = 0;
  private nextTierAnnounced = MILESTONE_EVERY;

  constructor(private readonly random: () => number = Math.random) {
    this.bubbles = [this.spawnBubble("normal")];
  }

  private spawnBubble(
    kind: BubbleKind,
    origin?: { x: number; y: number },
    angle: number = this.random() * Math.PI * 2,
  ): BubbleState {
    const speed = BASE_SPEED + this.score * SPEED_STEP;
    const lifetime = Math.max(MIN_LIFETIME, BASE_LIFETIME - this.score * LIFETIME_STEP);
    return {
      id: this.nextId++,
      kind,
      x: origin ? origin.x : MARGIN + this.random() * (1 - 2 * MARGIN),
      y: origin ? origin.y : MARGIN + this.random() * (1 - 2 * MARGIN),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime,
    };
  }

  private spawnSplitEvent(origin?: { x: number; y: number }): void {
    const count = SPLIT_MIN + Math.floor(this.random() * (SPLIT_MAX - SPLIT_MIN + 1));
    const realIndex = Math.floor(this.random() * count);
    // Evenly spaced angles (with a shared random rotation) so the burst
    // reads as bubbles radiating outward from the split point, not a
    // random scatter.
    const rotation = this.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = rotation + (i / count) * Math.PI * 2;
      this.bubbles.push(this.spawnBubble(i === realIndex ? "real" : "fake", origin, angle));
    }
  }

  private spawnNext(origin?: { x: number; y: number }): void {
    if (this.random() < SPLIT_CHANCE) {
      this.spawnSplitEvent(origin);
    } else {
      this.bubbles.push(this.spawnBubble("normal", origin));
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = "over";
      this.best = Math.max(this.best, this.score);
    }
  }

  private announceMilestone(): void {
    if (this.score >= this.nextTierAnnounced) {
      this.milestone = "Speed up!";
      this.milestoneRemaining = MILESTONE_DURATION;
      this.nextTierAnnounced += MILESTONE_EVERY;
    }
  }

  update(dtMs: number): void {
    if (this.milestoneRemaining > 0) {
      this.milestoneRemaining -= dtMs;
      if (this.milestoneRemaining <= 0) this.milestone = null;
    }
    if (this.status !== "playing") return;

    let criticalMiss = false;
    const survivors: BubbleState[] = [];
    for (const b of this.bubbles) {
      b.age += dtMs;
      b.x += b.vx * (dtMs / 1000);
      b.y += b.vy * (dtMs / 1000);
      if (b.x < MARGIN || b.x > 1 - MARGIN) {
        b.vx *= -1;
        b.x = Math.min(1 - MARGIN, Math.max(MARGIN, b.x));
      }
      if (b.y < MARGIN || b.y > 1 - MARGIN) {
        b.vy *= -1;
        b.y = Math.min(1 - MARGIN, Math.max(MARGIN, b.y));
      }
      if (b.age >= b.lifetime) {
        if (b.kind !== "fake") criticalMiss = true;
      } else {
        survivors.push(b);
      }
    }

    if (criticalMiss) {
      this.bubbles = [];
      this.loseLife();
    } else {
      this.bubbles = survivors;
    }

    if (this.status === "playing" && this.bubbles.length === 0) {
      this.spawnNext();
    }
  }

  catch(id: number): void {
    if (this.status !== "playing") return;
    const bubble = this.bubbles.find((b) => b.id === id);
    if (!bubble) return;
    const origin = { x: bubble.x, y: bubble.y };
    this.bubbles = this.bubbles.filter((b) => b.id !== id);

    if (bubble.kind === "fake") return;

    this.score += KIND_PROFILE[bubble.kind].value;
    this.bubbles = [];
    this.announceMilestone();
    this.spawnNext(origin);
  }

  restart(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.status = "playing";
    this.milestone = null;
    this.milestoneRemaining = 0;
    this.nextTierAnnounced = MILESTONE_EVERY;
    this.bubbles = [this.spawnBubble("normal")];
  }
}
