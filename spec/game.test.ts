import { describe, expect, it } from "vitest";
import { Game } from "../game.ts";

// This riff replaced the crit brief's single rule (one miss ends the round)
// with variety, lives and a difficulty curve. These tests encode that new
// contract instead of the old one.
describe("game: three lives absorb misses before a round ends", () => {
  it("a missed bubble costs a life but keeps the round going", () => {
    const game = new Game(() => 0.99); // always resolves to a "normal" bubble
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

    game.update(100);
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(1);

    for (let i = 0; i < 3; i++) {
      game.update(game.bubbles[0].lifetime + 1);
    }

    expect(game.status).toBe("over");
    expect(game.lives).toBe(0);
    expect(game.best).toBe(1);
  });

  it("a finished round can restart with full lives and zero score", () => {
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
  });
});

describe("game: bubble variety reads consistently on catch", () => {
  it("a gold bubble is worth three points", () => {
    const game = new Game(() => 0.99);
    game.bubbles[0].kind = "gold";
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(3);
  });

  it("a tiny bubble is worth two points", () => {
    const game = new Game(() => 0.99);
    game.bubbles[0].kind = "tiny";
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(2);
  });

  it("a large bubble is worth one point, same as normal", () => {
    const game = new Game(() => 0.99);
    game.bubbles[0].kind = "large";
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(1);
  });

  it("catching a bomb costs a life instead of scoring", () => {
    const game = new Game(() => 0.99);
    game.bubbles[0].kind = "bomb";
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(0);
    expect(game.lives).toBe(2);
    expect(game.status).toBe("playing");
    expect(game.bubbles).toHaveLength(1);
  });

  it("a caught split bubble becomes two bubbles", () => {
    const game = new Game(() => 0.99);
    game.bubbles[0].kind = "split";
    game.catch(game.bubbles[0].id);
    expect(game.score).toBe(1);
    expect(game.bubbles).toHaveLength(2);
  });
});

describe("game: the difficulty curve announces itself", () => {
  it("crossing a multiple of five catches announces a milestone", () => {
    const game = new Game(() => 0.99);
    expect(game.milestone).toBeNull();

    for (let i = 0; i < 5; i++) {
      game.catch(game.bubbles[game.bubbles.length - 1].id);
    }

    expect(game.score).toBe(5);
    expect(game.milestone).toBe("Speed up!");
  });

  it("the milestone announcement clears itself after its duration", () => {
    const game = new Game(() => 0.99);
    for (let i = 0; i < 5; i++) {
      game.catch(game.bubbles[game.bubbles.length - 1].id);
    }
    expect(game.milestone).not.toBeNull();

    game.update(5000);
    expect(game.milestone).toBeNull();
  });
});
