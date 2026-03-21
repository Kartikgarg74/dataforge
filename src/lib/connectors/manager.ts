/**
 * Connection Manager
 *
 * Manages multiple database connections. Handles lifecycle (add, remove, test),
 * and provides a uniform interface to access any connected database.
 * Persists connection configs to a _connectors table in the working SQLite DB.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  ConnectionConfig,
  ConnectorType,
  ConnectorFactory,
  DatabaseConnector,
  ConnectorStatus,
} from './interface';
import { encryptCredentials, decryptCredentials } from '@/lib/security/encryption';

const WORKING_DB_DIR = path.join(process.cwd(), 'data');
const WORKING_DB_PATH = path.join(WORKING_DB_DIR, 'working.db');

export interface ConnectionInfo {
  id: string;
  name: string;
  type: ConnectorType;
  status: 'connected' | 'disconnected' | 'error';
  statusMessage?: string;
  tables?: number;
  lastUsed?: string;
  lastTested?: string;
  createdAt: string;
}

/**
 * Central manager for all database connections.
 * Singleton pattern — use ConnectionManager.getInstance().
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private connectors: Map<string, DatabaseConnector> = new Map();
  private factories: Map<ConnectorType, ConnectorFactory> = new Map();
  private connectionInfo: Map<string, ConnectionInfo> = new Map();

  private persistenceInitialized = false;

  private constructor() {}

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
      ConnectionManager.instance.initPersistence();
    }
    return ConnectionManager.instance;
  }

  /**
   * Initialize the _connectors table and load saved connections from disk.
   * Called automatically on getInstance(). Safe to call multiple times.
   */
  private initPersistence(): void {
    if (this.persistenceInitialized) return;
    this.persistenceInitialized = true;

    try {
      this.ensureConnectorsTable();
      this.loadSavedConnections();
    } catch (err) {
      console.warn('Failed to initialize connector persistence:', err);
    }
  }

  /**
   * Open the working database (creating directory if needed) and ensure
   * the _connectors metadata table exists.
   */
  private ensureConnectorsTable(): void {
    if (!fs.existsSync(WORKING_DB_DIR)) {
      fs.mkdirSync(WORKING_DB_DIR, { recursive: true });
    }

    const db = new Database(WORKING_DB_PATH);
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS _connectors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } finally {
      db.close();
    }
  }

  /**
   * Persist a connection config to disk.
   */
  private saveConnectionToDisk(config: ConnectionConfig): void {
    try {
      const db = new Database(WORKING_DB_PATH);
      try {
        let configData: string;
        try {
          configData = encryptCredentials(config as unknown as Record<string, unknown>);
        } catch {
          // Fall back to plain JSON if encryption key is not set
          console.warn('Encryption unavailable, storing config in plain text');
          configData = JSON.stringify(config);
        }
        db.prepare(
          `INSERT OR REPLACE INTO _connectors (id, name, type, config_json, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        ).run(config.id, config.name, config.type, configData);
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn(`Failed to persist connection '${config.id}':`, err);
    }
  }

  /**
   * Remove a connection config from disk.
   */
  private removeConnectionFromDisk(id: string): void {
    try {
      const db = new Database(WORKING_DB_PATH);
      try {
        db.prepare('DELETE FROM _connectors WHERE id = ?').run(id);
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn(`Failed to remove persisted connection '${id}':`, err);
    }
  }

  /**
   * Load all saved connection configs from disk and register them
   * (without auto-connecting). Skips connections whose factory type
   * has not been registered yet.
   */
  private loadSavedConnections(): void {
    if (!fs.existsSync(WORKING_DB_PATH)) return;

    const db = new Database(WORKING_DB_PATH, { readonly: true });
    try {
      // Check that table exists before querying
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_connectors'"
        )
        .get();
      if (!tableExists) return;

      const rows = db
        .prepare('SELECT config_json FROM _connectors')
        .all() as Array<{ config_json: string }>;

      for (const row of rows) {
        try {
          let config: ConnectionConfig;
          try {
            // Try decrypting first (encrypted format)
            config = decryptCredentials(row.config_json) as ConnectionConfig;
          } catch {
            // Fall back to plain JSON parse (legacy unencrypted entries)
            try {
              config = JSON.parse(row.config_json);
            } catch {
              console.warn('Skipping connection with invalid config data');
              continue;
            }
          }
          // Only load if we have a factory and it hasn't been loaded yet
          if (!this.connectors.has(config.id) && this.factories.has(config.type)) {
            const factory = this.factories.get(config.type)!;
            const connector = factory(config);
            this.connectors.set(config.id, connector);
            this.connectionInfo.set(config.id, {
              id: config.id,
              name: config.name,
              type: config.type,
              status: 'disconnected',
              createdAt: new Date().toISOString(),
            });
          }
        } catch (loadErr) {
          console.warn('Skipping connection that failed to load:', loadErr);
        }
      }
    } finally {
      db.close();
    }
  }

  /**
   * Re-load saved connections. Useful after registering new factories
   * so previously-skipped connections can be picked up.
   */
  reloadSavedConnections(): void {
    this.loadSavedConnections();
  }

  /**
   * Register a connector factory for a database type.
   * Must be called before adding connections of that type.
   */
  registerFactory(type: ConnectorType, factory: ConnectorFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Add a new database connection.
   * Creates the connector instance but does NOT connect automatically.
   * Persists the config to disk so it survives server restarts.
   */
  addConnection(config: ConnectionConfig): void {
    if (this.connectors.has(config.id)) {
      throw new Error(`Connection with id '${config.id}' already exists`);
    }

    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(
        `No factory registered for connector type '${config.type}'. ` +
          `Registered types: ${[...this.factories.keys()].join(', ')}`
      );
    }

    const connector = factory(config);
    this.connectors.set(config.id, connector);
    this.connectionInfo.set(config.id, {
      id: config.id,
      name: config.name,
      type: config.type,
      status: 'disconnected',
      createdAt: new Date().toISOString(),
    });

    // Persist to disk
    this.saveConnectionToDisk(config);
  }

  /**
   * Remove a database connection. Disconnects first if connected.
   * Also removes the persisted config from disk.
   */
  async removeConnection(id: string): Promise<void> {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connection '${id}' not found`);
    }

    try {
      await connector.disconnect();
    } catch {
      // Ignore disconnect errors during removal
    }

    this.connectors.delete(id);
    this.connectionInfo.delete(id);

    // Remove from disk
    this.removeConnectionFromDisk(id);
  }

  /**
   * Get a connector by ID. Throws if not found.
   */
  getConnector(id: string): DatabaseConnector {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connection '${id}' not found`);
    }

    // Update last used timestamp
    const info = this.connectionInfo.get(id);
    if (info) {
      info.lastUsed = new Date().toISOString();
    }

    return connector;
  }

  /**
   * Check if a connection exists.
   */
  hasConnection(id: string): boolean {
    return this.connectors.has(id);
  }

  /**
   * Test a specific connection and update its status.
   */
  async testConnection(id: string): Promise<ConnectorStatus> {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connection '${id}' not found`);
    }

    const info = this.connectionInfo.get(id)!;
    info.lastTested = new Date().toISOString();

    try {
      const status = await connector.testConnection();
      info.status = status.connected ? 'connected' : 'error';
      info.statusMessage = status.message;

      if (status.connected) {
        try {
          const tables = await connector.getTables();
          info.tables = tables.length;
        } catch {
          // Tables count is optional
        }
      }

      return status;
    } catch (error) {
      info.status = 'error';
      info.statusMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        connected: false,
        message: info.statusMessage,
      };
    }
  }

  /**
   * Test all registered connections.
   */
  async testAll(): Promise<Map<string, ConnectorStatus>> {
    const results = new Map<string, ConnectorStatus>();

    const entries = [...this.connectors.entries()];
    const tests = entries.map(async ([id]) => {
      const status = await this.testConnection(id);
      results.set(id, status);
    });

    await Promise.allSettled(tests);
    return results;
  }

  /**
   * List all connections with their current status.
   */
  listConnections(): ConnectionInfo[] {
    return [...this.connectionInfo.values()];
  }

  /**
   * Get connection info by ID.
   */
  getConnectionInfo(id: string): ConnectionInfo | undefined {
    return this.connectionInfo.get(id);
  }

  /**
   * Connect a specific connection.
   */
  async connect(id: string): Promise<void> {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connection '${id}' not found`);
    }

    const info = this.connectionInfo.get(id)!;

    try {
      await connector.connect();
      info.status = 'connected';
      info.statusMessage = 'Connected';

      try {
        const tables = await connector.getTables();
        info.tables = tables.length;
      } catch {
        // Tables count is optional
      }
    } catch (error) {
      info.status = 'error';
      info.statusMessage =
        error instanceof Error ? error.message : 'Connection failed';
      throw error;
    }
  }

  /**
   * Disconnect a specific connection.
   */
  async disconnect(id: string): Promise<void> {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error(`Connection '${id}' not found`);
    }

    await connector.disconnect();
    const info = this.connectionInfo.get(id)!;
    info.status = 'disconnected';
    info.statusMessage = 'Disconnected';
  }

  /**
   * Disconnect all connections and clear the manager.
   */
  async disconnectAll(): Promise<void> {
    const disconnects = [...this.connectors.entries()].map(
      async ([, connector]) => {
        try {
          await connector.disconnect();
        } catch {
          // Ignore errors during bulk disconnect
        }
      }
    );

    await Promise.allSettled(disconnects);
    this.connectors.clear();
    this.connectionInfo.clear();
  }

  /**
   * Get the number of registered connections.
   */
  get size(): number {
    return this.connectors.size;
  }

  /**
   * Check if a factory is registered for a given type.
   */
  hasFactory(type: ConnectorType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered connector types.
   */
  getRegisteredTypes(): ConnectorType[] {
    return [...this.factories.keys()];
  }
}
