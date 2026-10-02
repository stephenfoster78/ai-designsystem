import dictionary from "../content/en-GB.json" with { type: "json" };

/** Copy for the motor journey, keyed by content key. Bump the version when copy changes. */
export const motorContent: Record<string, string> = dictionary;
export const MOTOR_CONTENT_VERSION = "motor-en-GB-2026-10-02";
