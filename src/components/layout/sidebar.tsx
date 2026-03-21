'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  LayoutDashboard,
  BookOpen,
  Database,
  Users,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/queries', label: 'Queries', icon: BookOpen },
  { href: '/connections', label: 'Connections', icon: Database },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ className = '' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      } ${className}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <BarChart3 className="w-6 h-6 text-blue-600 flex-shrink-0" />
        {!collapsed && (
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">DataForge</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-3 border-t border-gray-100 dark:border-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
