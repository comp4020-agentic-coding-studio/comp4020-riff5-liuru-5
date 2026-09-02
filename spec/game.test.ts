import { describe, expect, it } from "vitest";
import { Game } from "../game.ts";

// This riff simplified the crit brief down to one mechanic: normal bubbles,
// plus an occasional split event with exactly one real bubble hiding among
// decoys. These tests encode that contract, plus the pause-on-loss / restart
// contract the UI depends on.
describe("game: three lives absorb misses before a round ends", () => {
  it("a missed normal bubble costs a life but keeps the round going", () => {
    const game = new Game(() => 0.99); // never rolls a split event
    const lifetime = game.bubbles[0].lifetime;

    game.update(lifetime - 1);
    expect(game.status).toBe("playing");
    expect(game.lives).toBe(3);

    game.update(2);
    expect(game.status).toBe("playing");
    expect(game.lives).toBe(2);
    expect(game.bubbles).toHaveLength(1);
  });

  it("ends the round only once the third life is lost, recording the best score", () => {
    const game = new Game(() => 0.99);
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(1);

    for (let i = 0; i < 3; i++) {
      game.update(game.bubbles[0].lifetime + 1);
    }

    expect(game.status).toBe("over");
    expect(game.lives).toBe(0);
    expect(game.best).toBe(1);
  });

  it("a finished round can restart with full lives, zero score, and a fresh normal bubble", () => {
    const game = new Game(() => 0.99);
    for (let i = 0; i < 3; i++) {
      game.update(game.bubbles[0].lifetime + 1);
    }
    expect(game.status).toBe("over");

    game.restart();
    expect(game.status).toBe("playing");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(3);
    expect(game.bubbles).toHaveLength(1);
    expect(game.bubbles[0].kind).toBe("normal");
  });
});

describe("game: a split event hides one real bubble among fake decoys", () => {
  it("catching the real bubble scores and clears every decoy in the event", () => {
    const game = new Game(() => 0.99);
    const base = game.bubbles[0];
    const decoys = [
      { ...base, id: 101, kind: "fake" as const },
      { ...base, id: 103, kind: "fake" as const },
    ];
    game.bubbles = [decoys[0], { ...base, id: 102, kind: "real" }, decoys[1]];

    game.catch(102);

    expect(game.score).toBe(3);
    expect(game.bubbles).not.toContain(decoys[0]);
    expect(game.bubbles).not.toContain(decoys[1]);
  });

  it("catching a fake bubble scores nothing and leaves the rest of the event running", () => {
    const game = new Game(() => 0.99);
    const base = game.bubbles[0];
    game.bubbles = [
      { ...base, id: 1, kind: "fake" },
      { ...base, id: 2, kind: "real" },
    ];

    game.catch(1);

    expect(game.score).toBe(0);
    expect(game.status).toBe("playing");
    expect(game.bubbles.map((b) => b.id)).toEqual([2]);
  });

  it("letting a fake bubble time out costs nothing and leaves the real one active", () => {
    const game = new Game(() => 0.99);
    const base = game.bubbles[0];
    game.bubbles = [
      { ...base, id: 1, kind: "fake", age: 0, lifetime: 100 },
      { ...base, id: 2, kind: "real", age: 0, lifetime: 100000 },
    ];

    game.update(150);

    expect(game.lives).toBe(3);
    expect(game.bubbles.map((b) => b.id)).toEqual([2]);
  });

  it("letting the real bubble time out costs a life and ends the event", () => {
    const game = new Game(() => 0.99);
    const base = game.bubbles[0];
    game.bubbles = [
      { ...base, id: 1, kind: "fake", age: 0, lifetime: 100000 },
      { ...base, id: 2, kind: "real", age: 0, lifetime: 100 },
    ];

    game.update(150);

    expect(game.lives).toBe(2);
    expect(game.status).toBe("playing");
    expect(game.bubbles).toHaveLength(1); // a fresh bubble replaces the cleared event
  });
});

describe("game: losing a life resets both movement speed and shrink speed", () => {
  it("a bubble spawned right after a miss is back to the starting speed and lifetime", () => {
    const game = new Game(() => 0.99);
    const startingSpeed = Math.hypot(game.bubbles[0].vx, game.bubbles[0].vy);
    const startingLifetime = game.bubbles[0].lifetime;

    for (let i = 0; i < 5; i++) {
      game.catch(game.bubbles[0].id);
    }
    expect(Math.hypot(game.bubbles[0].vx, game.bubbles[0].vy)).toBeGreaterThan(startingSpeed);
    expect(game.bubbles[0].lifetime).toBeLessThan(startingLifetime);

    game.update(game.bubbles[0].lifetime + 1); // miss it, losing a life
    expect(game.lives).toBe(2);
    expect(Math.hypot(game.bubbles[0].vx, game.bubbles[0].vy)).toBeCloseTo(startingSpeed, 5);
    expect(game.bubbles[0].lifetime).toBeCloseTo(startingLifetime, 5);
  });
});

describe("game: the difficulty curve announces itself", () => {
  it("crossing a multiple of five catches announces a milestone", () => {
    const game = new Game(() => 0.99);
    expect(game.milestone).toBeNull();

    for (let i = 0; i < 5; i++) {
      game.catch(game.bubbles[0].id);
    }

    expect(game.score).toBe(5);
    expect(game.milestone).toBe("Speed up!");
  });

  it("the milestone announcement clears itself after its duration", () => {
    const game = new Game(() => 0.99);
    for (let i = 0; i < 5; i++) {
      game.catch(game.bubbles[0].id);
    }
    expect(game.milestone).not.toBeNull();

    game.update(5000);
    expect(game.milestone).toBeNull();
  });
});
