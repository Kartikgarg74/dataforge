import { describe, it, expect } from 'vitest';
import type { SplitConfig, SplitResult, SplitStrategy } from '../../src/lib/splitting/types';

/**
 * Split types and config validation tests.
 *
 * We don't call the actual splitter (it needs a real SQLite DB), but we
 * validate the type shapes and ratio constraints that the splitter enforces.
 */
describe('Splitting Types', () => {
  describe('SplitStrategy', () => {
    it('has the expected strategy values', () => {
      const strategies: SplitStrategy[] = ['random', 'stratified', 'temporal', 'group', 'kfold'];
      expect(strategies).toHaveLength(5);
    });
  });

  describe('SplitConfig validation', () => {
    it('can construct a valid random split config', () => {
      const config: SplitConfig = {
        strategy: 'random',
        ratios: { train: 0.7, val: 0.15, test: 0.15 },
        seed: 42,
      };
      expect(config.strategy).toBe('random');
      expect(config.ratios.train + config.ratios.val + config.ratios.test).toBeCloseTo(1.0);
    });

    it('can construct a stratified split config', () => {
      const config: SplitConfig = {
        strategy: 'stratified',
        ratios: { train: 0.8, val: 0.1, test: 0.1 },
        stratifyColumn: 'label',
      };
      expect(config.stratifyColumn).toBe('label');
    });

    it('can construct a temporal split config', () => {
      const config: SplitConfig = {
        strategy: 'temporal',
        ratios: { train: 0.7, val: 0.15, test: 0.15 },
        timeColumn: 'created_at',
      };
      expect(config.timeColumn).toBe('created_at');
    });

    it('can construct a group split config', () => {
      const config: SplitConfig = {
        strategy: 'group',
        ratios: { train: 0.7, val: 0.15, test: 0.15 },
        groupColumn: 'user_id',
      };
      expect(config.groupColumn).toBe('user_id');
    });
  });

  describe('Ratio validation logic', () => {
    /**
     * The actual splitter throws when ratios don't sum to 1.0 (within 0.01).
     * We replicate that validation check here as a pure function test.
     */
    function validateRatios(ratios: { train: number; val: number; test: number }): boolean {
      const total = ratios.train + ratios.val + ratios.test;
      return Math.abs(total - 1.0) <= 0.01;
    }

    it('accepts ratios that sum to exactly 1.0', () => {
      expect(validateRatios({ train: 0.7, val: 0.15, test: 0.15 })).toBe(true);
    });

    it('accepts ratios that sum to 1.0 within tolerance', () => {
      expect(validateRatios({ train: 0.8, val: 0.1, test: 0.1 })).toBe(true);
    });

    it('accepts 80/10/10 common split', () => {
      expect(validateRatios({ train: 0.8, val: 0.1, test: 0.1 })).toBe(true);
    });

    it('rejects ratios that sum to less than 0.99', () => {
      expect(validateRatios({ train: 0.5, val: 0.1, test: 0.1 })).toBe(false);
    });

    it('rejects ratios that sum to more than 1.01', () => {
      expect(validateRatios({ train: 0.8, val: 0.2, test: 0.2 })).toBe(false);
    });

    it('rejects all-zero ratios', () => {
      expect(validateRatios({ train: 0, val: 0, test: 0 })).toBe(false);
    });
  });

  describe('SplitResult shape', () => {
    it('can construct a valid split result', () => {
      const result: SplitResult = {
        splits: {
          train: { rowCount: 700, table: 'data_train' },
          val: { rowCount: 150, table: 'data_val' },
          test: { rowCount: 150, table: 'data_test' },
        },
        metadata: {
          strategy: 'random',
          seed: 42,
          ratios: { train: 0.7, val: 0.15, test: 0.15 },
        },
      };

      expect(result.splits.train.rowCount + result.splits.val.rowCount + result.splits.test.rowCount).toBe(1000);
      expect(result.metadata.strategy).toBe('random');
    });

    it('can include distribution metadata for stratified splits', () => {
      const result: SplitResult = {
        splits: {
          train: { rowCount: 80, table: 't_train' },
          val: { rowCount: 10, table: 't_val' },
          test: { rowCount: 10, table: 't_test' },
        },
        metadata: {
          strategy: 'stratified',
          seed: 42,
          ratios: { train: 0.8, val: 0.1, test: 0.1 },
          distribution: {
            classA: { train: 40, val: 5, test: 5 },
            classB: { train: 40, val: 5, test: 5 },
          },
        },
      };

      expect(result.metadata.distribution).toBeDefined();
      expect(Object.keys(result.metadata.distribution!)).toHaveLength(2);
    });
  });
});
