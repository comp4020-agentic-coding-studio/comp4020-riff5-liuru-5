// Pure game logic, no DOM: one or more bubbles drift inside the unit square.
// Different kinds score differently, cost lives, or split on catch. Missing
// a bubble or catching a bomb costs a life; losing the third ends the round.
export type GameStatus = "playing" | "over";

export type BubbleKind = "normal" | "gold" | "tiny" | "large" | "bomb" | "split";

export interface BubbleState {
  id: number;
  kind: BubbleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  size: number; // relative to the baseline bubble, 1 = normal
}

interface KindProfile {
  value: number;
  size: number;
  speed: number;
  lifetime: number;
}

const MARGIN = 0.08;
const MIN_LIFETIME = 650;
const BASE_LIFETIME = 2200;
const LIFETIME_STEP = 90;
const BASE_SPEED = 0.06;
const SPEED_STEP = 0.006;
const START_LIVES = 3;
const MAX_ACTIVE = 3;
const MILESTONE_EVERY = 5;
const MILESTONE_DURATION = 1400;

const KIND_PROFILE: Record<BubbleKind, KindProfile> = {
  normal: { value: 1, size: 1, speed: 1, lifetime: 1 },
  gold: { value: 3, size: 0.85, speed: 1.1, lifetime: 0.85 },
  tiny: { value: 2, size: 0.55, speed: 1.6, lifetime: 0.9 },
  large: { value: 1, size: 1.6, speed: 0.65, lifetime: 1.2 },
  bomb: { value: 0, size: 1.1, speed: 0.9, lifetime: 1 },
  split: { value: 1, size: 1.1, speed: 1, lifetime: 1 },
};

// Weighted picks, checked in order; the remainder falls through to "normal".
// Every entry after the first three points is a variety kind, so the reader's
// first bubble is always plain.
const KIND_TABLE: Array<[BubbleKind, number]> = [
  ["gold", 0.08],
  ["bomb", 0.1],
  ["tiny", 0.16],
  ["large", 0.14],
  ["split", 0.1],
];

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
    this.bubbles = [this.spawnBubble(undefined, "normal")];
  }

  private pickKind(): BubbleKind {
    let r = this.random();
    for (const [kind, weight] of KIND_TABLE) {
      if (r < weight) return kind;
      r -= weight;
    }
    return "normal";
  }

  private spawnBubble(origin?: { x: number; y: number }, forceKind?: BubbleKind): BubbleState {
    const kind = forceKind ?? this.pickKind();
    const profile = KIND_PROFILE[kind];
    const angle = this.random() * Math.PI * 2;
    const speed = (BASE_SPEED + this.score * SPEED_STEP) * profile.speed;
    const lifetime =
      Math.max(MIN_LIFETIME, BASE_LIFETIME - this.score * LIFETIME_STEP) * profile.lifetime;
    return {
      id: this.nextId++,
      kind,
      x: origin ? origin.x : MARGIN + this.random() * (1 - 2 * MARGIN),
      y: origin ? origin.y : MARGIN + this.random() * (1 - 2 * MARGIN),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime,
      size: profile.size,
    };
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = "over";
      this.best = Math.max(this.best, this.score);
    }
  }

  private announceMilestone(origin: { x: number; y: number }): void {
    if (this.score >= this.nextTierAnnounced) {
      this.milestone = "Speed up!";
      this.milestoneRemaining = MILESTONE_DURATION;
      this.nextTierAnnounced += MILESTONE_EVERY;
      if (this.bubbles.length < MAX_ACTIVE) {
        this.bubbles.push(this.spawnBubble(origin, "normal"));
      }
    }
  }

  update(dtMs: number): void {
    if (this.milestoneRemaining > 0) {
      this.milestoneRemaining -= dtMs;
      if (this.milestoneRemaining <= 0) this.milestone = null;
    }
    if (this.status !== "playing") return;

    const missed: BubbleState[] = [];
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
      if (b.age >= b.lifetime) missed.push(b);
    }

    if (missed.length > 0) {
      this.bubbles = this.bubbles.filter((b) => !missed.includes(b));
      for (const b of missed) {
        this.loseLife();
        if (this.status !== "playing") break;
      }
      if (this.status === "playing" && this.bubbles.length === 0) {
        this.bubbles = [this.spawnBubble()];
      }
    }
  }

  catch(id: number): void {
    if (this.status !== "playing") return;
    const bubble = this.bubbles.find((b) => b.id === id);
    if (!bubble) return;
    this.bubbles = this.bubbles.filter((b) => b.id !== id);
    const origin = { x: bubble.x, y: bubble.y };

    if (bubble.kind === "bomb") {
      this.loseLife();
      if (this.status === "playing" && this.bubbles.length === 0) {
        this.bubbles.push(this.spawnBubble(origin));
      }
      return;
    }

    this.score += KIND_PROFILE[bubble.kind].value;

    if (bubble.kind === "split" && this.bubbles.length < MAX_ACTIVE) {
      const slots = Math.min(2, MAX_ACTIVE - this.bubbles.length);
      for (let i = 0; i < slots; i++) {
        this.bubbles.push(this.spawnBubble(origin, "normal"));
      }
    } else if (this.bubbles.length === 0) {
      this.bubbles.push(this.spawnBubble(origin));
    }

    this.announceMilestone(origin);
  }

  restart(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.status = "playing";
    this.milestone = null;
    this.milestoneRemaining = 0;
    this.nextTierAnnounced = MILESTONE_EVERY;
    this.bubbles = [this.spawnBubble(undefined, "normal")];
  }
}
