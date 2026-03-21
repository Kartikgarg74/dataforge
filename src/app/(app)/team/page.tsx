'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Trash2, Loader2 } from 'lucide-react';

interface TeamMember {
  userId: string;
  email: string;
  name?: string;
  role: string;
  joinedAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  editor: { label: 'Editor', color: 'bg-green-100 text-green-700' },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700' },
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', teamId: '' }),
      });
      const data = await res.json();
      if (data.success) setMembers(data.members || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', teamId: '', email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setShowInvite(false);
      fetchMembers();
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Team</h1>
            <p className="text-sm text-gray-500">Manage team members and permissions</p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Invite
        </button>
      </div>

      {showInvite && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg outline-none"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={handleInvite} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg">
              Send Invite
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No team members yet</p>
            </div>
          ) : members.map((m) => {
            const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.viewer;
            return (
              <div key={m.userId} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    {(m.name || m.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name || m.email}</div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                  {m.role !== 'owner' && (
                    <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Permissions */}
      <div className="mt-8 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Role Permissions</h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left py-1.5">Permission</th>
                <th className="text-center py-1.5">Owner</th>
                <th className="text-center py-1.5">Admin</th>
                <th className="text-center py-1.5">Editor</th>
                <th className="text-center py-1.5">Viewer</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 dark:text-gray-400">
              {[
                ['Manage team', true, true, false, false],
                ['Manage connections', true, true, false, false],
                ['Create dashboards', true, true, true, false],
                ['Ask questions', true, true, true, true],
                ['View dashboards', true, true, true, true],
                ['Export data', true, true, true, false],
                ['Share links', true, true, true, false],
              ].map(([perm, ...roles]) => (
                <tr key={perm as string} className="border-t border-gray-50 dark:border-gray-800">
                  <td className="py-1.5">{perm as string}</td>
                  {(roles as boolean[]).map((allowed, i) => (
                    <td key={i} className="text-center">{allowed ? '✓' : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
