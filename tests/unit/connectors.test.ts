import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/lib/connectors/manager';
import type {
  ConnectionConfig,
  ConnectorFactory,
  DatabaseConnector,
} from '../../src/lib/connectors/interface';

/**
 * Create a mock DatabaseConnector that does not touch any real database.
 */
function createMockConnector(config: ConnectionConfig): DatabaseConnector {
  return {
    type: config.type,
    config,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue({ connected: true, message: 'OK' }),
    executeQuery: vi.fn().mockResolvedValue({ rows: [], columns: [], rowCount: 0, executionTimeMs: 0 }),
    getSchema: vi.fn().mockResolvedValue({ database: 'test', tables: [] }),
    getTables: vi.fn().mockResolvedValue([{ name: 'users', type: 'table' }]),
    getColumns: vi.fn().mockResolvedValue([]),
    getRowCount: vi.fn().mockResolvedValue(0),
  };
}

const mockFactory: ConnectorFactory = (config) => createMockConnector(config);

/**
 * Since ConnectionManager is a singleton, we need to reset its internal state
 * between tests. We do this by calling disconnectAll() which clears connectors
 * and connectionInfo maps.
 */
async function resetManager(mgr: ConnectionManager): Promise<void> {
  await mgr.disconnectAll();
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(async () => {
    manager = ConnectionManager.getInstance();
    await resetManager(manager);
    // Register a mock factory for sqlite so we can add connections
    manager.registerFactory('sqlite', mockFactory);
  });

  // ---------- Singleton ----------
  describe('getInstance()', () => {
    it('returns the same instance on consecutive calls', () => {
      const a = ConnectionManager.getInstance();
      const b = ConnectionManager.getInstance();
      expect(a).toBe(b);
    });
  });

  // ---------- registerFactory ----------
  describe('registerFactory', () => {
    it('registers a factory for a given type', () => {
      manager.registerFactory('postgres', mockFactory);
      expect(manager.hasFactory('postgres')).toBe(true);
    });

    it('overwrites a previously registered factory without error', () => {
      const altFactory: ConnectorFactory = (cfg) => createMockConnector(cfg);
      manager.registerFactory('sqlite', altFactory);
      expect(manager.hasFactory('sqlite')).toBe(true);
    });

    it('getRegisteredTypes returns all registered types', () => {
      manager.registerFactory('postgres', mockFactory);
      manager.registerFactory('mysql', mockFactory);
      const types = manager.getRegisteredTypes();
      expect(types).toContain('sqlite');
      expect(types).toContain('postgres');
      expect(types).toContain('mysql');
    });
  });

  // ---------- addConnection ----------
  describe('addConnection', () => {
    it('adds a connection and exposes it via hasConnection', () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'My SQLite',
        type: 'sqlite',
      };
      manager.addConnection(config);
      expect(manager.hasConnection('conn-1')).toBe(true);
      expect(manager.size).toBe(1);
    });

    it('initialises connectionInfo with status "disconnected"', () => {
      manager.addConnection({ id: 'c2', name: 'DB2', type: 'sqlite' });
      const info = manager.getConnectionInfo('c2');
      expect(info).toBeDefined();
      expect(info!.status).toBe('disconnected');
      expect(info!.type).toBe('sqlite');
      expect(info!.name).toBe('DB2');
      expect(info!.createdAt).toBeTruthy();
    });

    it('throws when adding a connection with a duplicate id', () => {
      manager.addConnection({ id: 'dup', name: 'A', type: 'sqlite' });
      expect(() =>
        manager.addConnection({ id: 'dup', name: 'B', type: 'sqlite' }),
      ).toThrowError(/already exists/);
    });

    it('throws when no factory is registered for the connector type', () => {
      expect(() =>
        manager.addConnection({ id: 'x', name: 'X', type: 'bigquery' }),
      ).toThrowError(/No factory registered/);
    });
  });

  // ---------- removeConnection ----------
  describe('removeConnection', () => {
    it('removes an existing connection', async () => {
      manager.addConnection({ id: 'r1', name: 'R1', type: 'sqlite' });
      await manager.removeConnection('r1');
      expect(manager.hasConnection('r1')).toBe(false);
      expect(manager.getConnectionInfo('r1')).toBeUndefined();
    });

    it('calls disconnect on the connector before removing', async () => {
      manager.addConnection({ id: 'r2', name: 'R2', type: 'sqlite' });
      const connector = manager.getConnector('r2');
      await manager.removeConnection('r2');
      expect(connector.disconnect).toHaveBeenCalled();
    });

    it('throws when removing a non-existent connection', async () => {
      await expect(manager.removeConnection('ghost')).rejects.toThrowError(/not found/);
    });
  });

  // ---------- getConnector ----------
  describe('getConnector', () => {
    it('returns the connector for a valid id', () => {
      manager.addConnection({ id: 'g1', name: 'G1', type: 'sqlite' });
      const connector = manager.getConnector('g1');
      expect(connector).toBeDefined();
      expect(connector.type).toBe('sqlite');
    });

    it('updates lastUsed on the connectionInfo', () => {
      manager.addConnection({ id: 'g2', name: 'G2', type: 'sqlite' });
      const before = manager.getConnectionInfo('g2')!.lastUsed;
      manager.getConnector('g2');
      const after = manager.getConnectionInfo('g2')!.lastUsed;
      expect(after).toBeDefined();
      // lastUsed should be set (was undefined before)
      expect(before).toBeUndefined();
      expect(after).toBeTruthy();
    });

    it('throws for a non-existent id', () => {
      expect(() => manager.getConnector('nope')).toThrowError(/not found/);
    });
  });

  // ---------- listConnections ----------
  describe('listConnections', () => {
    it('returns an empty array when no connections exist', () => {
      expect(manager.listConnections()).toEqual([]);
    });

    it('returns all added connections', () => {
      manager.addConnection({ id: 'l1', name: 'L1', type: 'sqlite' });
      manager.addConnection({ id: 'l2', name: 'L2', type: 'sqlite' });
      const list = manager.listConnections();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.id).sort()).toEqual(['l1', 'l2']);
    });
  });

  // ---------- hasConnection / getConnectionInfo ----------
  describe('hasConnection & getConnectionInfo', () => {
    it('hasConnection returns false for unknown id', () => {
      expect(manager.hasConnection('unknown')).toBe(false);
    });

    it('getConnectionInfo returns undefined for unknown id', () => {
      expect(manager.getConnectionInfo('unknown')).toBeUndefined();
    });
  });

  // ---------- testConnection ----------
  describe('testConnection', () => {
    it('returns connected status and updates info', async () => {
      manager.addConnection({ id: 't1', name: 'T1', type: 'sqlite' });
      const status = await manager.testConnection('t1');
      expect(status.connected).toBe(true);
      const info = manager.getConnectionInfo('t1')!;
      expect(info.status).toBe('connected');
      expect(info.lastTested).toBeTruthy();
      expect(info.tables).toBe(1); // mock getTables returns 1 table
    });

    it('throws for unknown connection', async () => {
      await expect(manager.testConnection('nope')).rejects.toThrowError(/not found/);
    });
  });

  // ---------- connect / disconnect ----------
  describe('connect and disconnect', () => {
    it('connect updates status to connected', async () => {
      manager.addConnection({ id: 'cd1', name: 'CD1', type: 'sqlite' });
      await manager.connect('cd1');
      expect(manager.getConnectionInfo('cd1')!.status).toBe('connected');
    });

    it('disconnect updates status to disconnected', async () => {
      manager.addConnection({ id: 'cd2', name: 'CD2', type: 'sqlite' });
      await manager.connect('cd2');
      await manager.disconnect('cd2');
      expect(manager.getConnectionInfo('cd2')!.status).toBe('disconnected');
    });

    it('connect throws for unknown id', async () => {
      await expect(manager.connect('nope')).rejects.toThrowError(/not found/);
    });

    it('disconnect throws for unknown id', async () => {
      await expect(manager.disconnect('nope')).rejects.toThrowError(/not found/);
    });
  });

  // ---------- disconnectAll ----------
  describe('disconnectAll', () => {
    it('clears all connections and info', async () => {
      manager.addConnection({ id: 'd1', name: 'D1', type: 'sqlite' });
      manager.addConnection({ id: 'd2', name: 'D2', type: 'sqlite' });
      await manager.disconnectAll();
      expect(manager.size).toBe(0);
      expect(manager.listConnections()).toEqual([]);
    });
  });
});
