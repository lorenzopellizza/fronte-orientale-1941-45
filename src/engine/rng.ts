/**
 * Pure seeded PRNG using Mulberry32.
 * Never mutates global state or calls Math.random().
 */
export function nextRng(state: number): { value: number; nextState: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

/**
 * Roll 1d6 (1..6) using pure RNG state.
 */
export function rollD6(state: number): { roll: number; nextState: number } {
  const { value, nextState } = nextRng(state);
  const roll = Math.floor(value * 6) + 1;
  return { roll, nextState };
}

/**
 * Deterministic Fisher-Yates shuffle returning a new array and updated RNG state.
 */
export function shuffleArray<T>(items: readonly T[], state: number): { shuffled: T[]; nextState: number } {
  const arr = [...items];
  let current = state;
  for (let i = arr.length - 1; i > 0; i--) {
    const res = nextRng(current);
    current = res.nextState;
    const j = Math.floor(res.value * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return { shuffled: arr, nextState: current };
}
