/**
 * Dataset Splitting Types
 */

export type SplitStrategy = 'random' | 'stratified' | 'temporal' | 'group' | 'kfold';

export interface SplitConfig {
  /** Split strategy */
  strategy: SplitStrategy;
  /** Split ratios (must sum to 1.0) */
  ratios: { train: number; val: number; test: number };
  /** Column to stratify by (for stratified split) */
  stratifyColumn?: string;
  /** Column to group by (for group split) */
  groupColumn?: string;
  /** Column for temporal ordering (for temporal split) */
  timeColumn?: string;
  /** Random seed for reproducibility */
  seed?: number;
  /** Number of folds (for kfold) */
  kFolds?: number;
}

export interface SplitResult {
  splits: {
    train: { rowCount: number; table: string };
    val: { rowCount: number; table: string };
    test: { rowCount: number; table: string };
  };
  metadata: {
    strategy: SplitStrategy;
    seed: number;
    ratios: { train: number; val: number; test: number };
    distribution?: Record<string, Record<string, number>>;
  };
}
