/**
 * Saved Queries API Endpoint
 *
 * POST /api/queries
 * CRUD operations for saved queries.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import {
  createSavedQuery,
  getSavedQuery,
  listSavedQueries,
  updateSavedQuery,
  deleteSavedQuery,
  incrementQueryUsage,
  getTopQueries,
  toggleFavorite,
  isFavorite,
  listFavorites,
} from '@/lib/dashboard/saved-queries';

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    teamId: z.string().default(''),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    naturalLanguage: z.string().min(1),
    sql: z.string().min(1),
    connectorId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    createdBy: z.string().default(''),
  }),
  z.object({
    action: z.literal('get'),
    queryId: z.string().min(1),
  }),
  z.object({
    action: z.literal('list'),
    teamId: z.string().default(''),
    category: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().int().positive().optional(),
    sortBy: z.enum(['usage', 'recent', 'name']).optional(),
  }),
  z.object({
    action: z.literal('update'),
    queryId: z.string().min(1),
    updates: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      sql: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    action: z.literal('delete'),
    queryId: z.string().min(1),
  }),
  z.object({
    action: z.literal('run'),
    queryId: z.string().min(1),
  }),
  z.object({
    action: z.literal('top'),
    teamId: z.string().default(''),
    limit: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal('favorite'),
    userId: z.string().min(1),
    queryId: z.string().min(1),
  }),
  z.object({
    action: z.literal('unfavorite'),
    userId: z.string().min(1),
    queryId: z.string().min(1),
  }),
  z.object({
    action: z.literal('favorites'),
    userId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'query.manage' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'create': {
        const query = createSavedQuery({
          teamId: data.teamId,
          name: data.name,
          description: data.description,
          category: data.category,
          naturalLanguage: data.naturalLanguage,
          sql: data.sql,
          connectorId: data.connectorId,
          tags: data.tags,
          createdBy: data.createdBy,
        });
        return NextResponse.json({ success: true, query });
      }

      case 'get': {
        const query = getSavedQuery(data.queryId);
        if (!query) return NextResponse.json({ error: 'Query not found' }, { status: 404 });
        return NextResponse.json({ success: true, query });
      }

      case 'list': {
        const queries = listSavedQueries(data.teamId, {
          category: data.category,
          search: data.search,
          limit: data.limit,
          sortBy: data.sortBy,
        });
        return NextResponse.json({ success: true, queries });
      }

      case 'update': {
        const query = updateSavedQuery(data.queryId, data.updates);
        return NextResponse.json({ success: true, query });
      }

      case 'delete': {
        deleteSavedQuery(data.queryId);
        return NextResponse.json({ success: true });
      }

      case 'run': {
        incrementQueryUsage(data.queryId);
        const query = getSavedQuery(data.queryId);
        return NextResponse.json({ success: true, query });
      }

      case 'top': {
        const queries = getTopQueries(data.teamId, data.limit);
        return NextResponse.json({ success: true, queries });
      }

      case 'favorite': {
        toggleFavorite(data.userId, data.queryId);
        const favorited = isFavorite(data.userId, data.queryId);
        return NextResponse.json({ success: true, favorited });
      }

      case 'unfavorite': {
        // Ensure it's removed (toggleFavorite toggles, so check first)
        if (isFavorite(data.userId, data.queryId)) {
          toggleFavorite(data.userId, data.queryId);
        }
        return NextResponse.json({ success: true, favorited: false });
      }

      case 'favorites': {
        const queries = listFavorites(data.userId);
        return NextResponse.json({ success: true, queries });
      }
    }
  } catch (error) {
    console.error('Queries API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query operation failed' },
      { status: 500 }
    );
  }
}
