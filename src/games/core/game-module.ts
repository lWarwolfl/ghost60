export type GameId = "pulse" | "snap" | "orbit" | "recall" | "shift" | "trace";
export type RunMode = "ranked" | "challenge" | "practice" | "past_self";

export type NormalizedPoint = { x: number; y: number }; // integer 0..10000

export type GameInputEvent =
  | { t: number; type: "tap"; p?: NormalizedPoint; value?: number }
  | { t: number; type: "pointer_down" | "pointer_move" | "pointer_up"; p: NormalizedPoint }
  | { t: number; type: "choice"; value: number };

export type DailyGamePayload<TConfig = unknown> = {
  id: string;
  gameDate: string;
  gameId: GameId;
  engineVersion: number;
  seed: string;
  config: TConfig;
  title: string;
  instruction: string;
  durationMs: number;
};

export type ScoreResult = {
  score: number;
  valid: boolean;
  invalidReason?: string;
  metrics: Record<string, number>;
};

export type SanitizedGhost = {
  gameId: GameId;
  engineVersion: number;
  score: number;
  timeline: Array<{
    t: number;
    progress?: number;
    score?: number;
    p?: NormalizedPoint;
    marker?: number;
  }>;
};

export interface SeededRng {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
}

export interface GameModule<TConfig = unknown> {
  id: GameId;
  engineVersion: number;
  durationMs(config: TConfig): number;
  validateConfig(config: unknown): TConfig;
  createScenario(seed: string, config: TConfig): unknown;
  scoreRun(args: {
    seed: string;
    config: TConfig;
    events: GameInputEvent[];
    visibilityInterruptions: number;
  }): ScoreResult;
  sanitizeGhost(args: {
    seed: string;
    config: TConfig;
    events: GameInputEvent[];
    score: number;
  }): SanitizedGhost;
  simulate?(args: {
    seed: string;
    config: TConfig;
    skill: number;
    rng: SeededRng;
  }): GameInputEvent[];
}
