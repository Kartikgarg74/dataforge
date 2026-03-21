'use client';

import React from 'react';
import Link from 'next/link';
import {
  Settings,
  Users,
  HelpCircle,
  Info,
  ChevronRight,
  Database,
  MessageSquare,
} from 'lucide-react';

const MENU_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings', description: 'App preferences and configuration' },
  { href: '/team', icon: Users, label: 'Team', description: 'Manage team members and roles' },
  { href: '/connections', icon: Database, label: 'Connections', description: 'Database connections' },
  { href: '/chat', icon: MessageSquare, label: 'Chat', description: 'AI assistant' },
  { href: 'https://docs.tambo.co', icon: HelpCircle, label: 'Help & Docs', description: 'Documentation and support', external: true },
  { href: '/about', icon: Info, label: 'About', description: 'DataForge v1.0' },
];

export default function MorePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">More</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const Wrapper = item.external ? 'a' : Link;
          const extraProps = item.external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {};

          return (
            <Wrapper
              key={item.href}
              href={item.href}
              {...(extraProps as Record<string, string>)}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {item.label}
                </div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
