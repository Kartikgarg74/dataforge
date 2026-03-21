/**
 * Connector API Endpoint
 *
 * Manages database connections: add, remove, test, list.
 * POST /api/connector
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import { getConnectionManager } from '@/lib/connectors';
import type { ConnectorType } from '@/lib/connectors';

const ConnectorConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgres', 'mysql', 'mongodb', 'bigquery', 'supabase'] as const),
  name: z.string().min(1).max(100),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
  connectionString: z.string().optional(),
});

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    connector: ConnectorConfigSchema,
  }),
  z.object({
    action: z.literal('remove'),
    connectorId: z.string().min(1),
  }),
  z.object({
    action: z.literal('test'),
    connectorId: z.string().min(1),
  }),
  z.object({
    action: z.literal('list'),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'connection.manage' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const manager = getConnectionManager();
    const data = parsed.data;

    switch (data.action) {
      case 'add': {
        const id = crypto.randomUUID();
        const config = {
          id,
          name: data.connector.name,
          type: data.connector.type as ConnectorType,
          host: data.connector.host,
          port: data.connector.port,
          database: data.connector.database,
          username: data.connector.username,
          password: data.connector.password,
          ssl: data.connector.ssl,
          connectionString: data.connector.connectionString,
        };

        manager.addConnection(config);

        // Test the connection immediately
        const status = await manager.testConnection(id);

        return NextResponse.json({
          success: true,
          connector: {
            id,
            name: config.name,
            type: config.type,
            status: status.connected ? 'connected' : 'error',
            message: status.message,
            serverVersion: status.serverVersion,
          },
        });
      }

      case 'remove': {
        await manager.removeConnection(data.connectorId);
        return NextResponse.json({ success: true });
      }

      case 'test': {
        const status = await manager.testConnection(data.connectorId);
        return NextResponse.json({
          success: true,
          status: {
            connected: status.connected,
            message: status.message,
            serverVersion: status.serverVersion,
            latencyMs: status.latencyMs,
          },
        });
      }

      case 'list': {
        const connections = manager.listConnections();
        return NextResponse.json({
          success: true,
          connectors: connections.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            status: c.status,
            statusMessage: c.statusMessage,
            tables: c.tables,
            lastUsed: c.lastUsed,
            createdAt: c.createdAt,
          })),
        });
      }
    }
  } catch (error) {
    console.error('Connector API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
