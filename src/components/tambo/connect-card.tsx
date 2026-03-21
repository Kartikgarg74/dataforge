"use client";

import { z } from 'zod';

export const connectCardSchema = z.object({
  service: z.enum(['neon', 'github', 'airtable', 'notion']),
  status: z.enum(['disconnected', 'connecting', 'connected', 'error']),
  accountName: z.string().optional(),
  message: z.string().optional(),
});

const SERVICE_CONFIG = {
  neon: { icon: '🐘', name: 'Neon Database', color: 'green' },
  github: { icon: '🐙', name: 'GitHub', color: 'slate' },
  airtable: { icon: '📊', name: 'Airtable', color: 'yellow' },
  notion: { icon: '📝', name: 'Notion', color: 'gray' },
};

export function ConnectCard({ service, status, accountName, message }: z.infer<typeof connectCardSchema>) {
  const config = SERVICE_CONFIG[service as keyof typeof SERVICE_CONFIG];
  
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const colorClass = colors[config.color] || colors.slate;

  if (status === 'connected') {
    return (
      <div className={`${colorClass} p-4 rounded-lg border`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h4 className="font-semibold text-sm">{config.name}</h4>
            <p className="text-xs opacity-75">✓ {accountName || 'Connected'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h4 className="font-semibold text-sm text-red-800">{config.name}</h4>
            <p className="text-xs text-red-600">{message || 'Connection failed'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${config.color}-100`}>
          <span className="text-xl">{config.icon}</span>
        </div>
        <div>
          <h4 className="font-semibold text-sm">{config.name}</h4>
          <p className="text-xs text-slate-500">
            {status === 'connecting' ? 'Connecting...' : 'Click to connect'}
          </p>
        </div>
      </div>
    </div>
  );
}
