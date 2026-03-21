'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, BookOpen, Bell, MoreHorizontal } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface BottomNavProps {
  alertCount?: number;
}

export function BottomNav({ alertCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: 'Chat', href: '/chat', icon: <MessageSquare className="w-5 h-5" /> },
    { label: 'Dashboards', href: '/dashboards', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Queries', href: '/queries', icon: <BookOpen className="w-5 h-5" /> },
    { label: 'Alerts', href: '/alerts', icon: <Bell className="w-5 h-5" />, badge: alertCount },
    { label: 'More', href: '/more', icon: <MoreHorizontal className="w-5 h-5" /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden"
      style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                transition-colors duration-150
                ${isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
