/**
# Paired Gain Scoring

The evidence behind promotion of a measured node.

## 1. What This Module Does
Normalizes paired metric measurements and computes a noise-aware interval.
## 2. Why This Module Exists
One noisy benchmark run must not silently promote a change.
## 3. How It Fits in the Architecture
The server applies this pure recipe to runner verdicts before policy review.
## 4. Key Concepts
Parent and node use the same baseline; a positive lower bound is improvement.
*/
export function summarize(samples: number[], noise: number): { mean: number; lo: number; hi: number; outcome: 'improved' | 'within_noise' | 'worse' } {
  if (samples.length < 2) throw new Error('at least two paired samples are required');
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (samples.length - 1);
  const margin = 1.96 * Math.sqrt(variance / samples.length + noise ** 2);
  const lo = mean - margin;
  const hi = mean + margin;
  return { mean, lo, hi, outcome: lo > 0 ? 'improved' : hi < 0 ? 'worse' : 'within_noise' };
}

export function normalized(value: number, baseline: number, direction: 'max' | 'min'): number {
  if (value <= 0 || baseline <= 0) throw new Error('metric values must be positive');
  return direction === 'max' ? value / baseline : baseline / value;
}
