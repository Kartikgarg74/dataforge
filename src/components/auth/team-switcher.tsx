'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Building2, Loader2 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  role?: string;
}

interface TeamSwitcherProps {
  currentTeamId?: string;
  onTeamSwitch?: (teamId: string) => void;
  className?: string;
}

export function TeamSwitcher({ currentTeamId, onTeamSwitch, className = '' }: TeamSwitcherProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0];

  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        if (response.ok && data.teams) {
          setTeams(data.teams);
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (teamId: string) => {
    setIsOpen(false);
    onTeamSwitch?.(teamId);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading teams...</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-left text-gray-700 dark:text-gray-300 truncate">
          {currentTeam?.name || 'Select a team'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => handleSelect(team.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  team.id === currentTeam?.id
                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{team.name}</span>
                {team.role && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{team.role}</span>
                )}
              </button>
            ))}
          </div>

          {/* Create New Team */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                // Placeholder: open create team modal / navigate
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Team
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
