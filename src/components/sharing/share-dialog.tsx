'use client';

import React, { useState } from 'react';
import { Link2, Lock, Users, Mail, Copy, Check, Globe, Loader2 } from 'lucide-react';

interface ShareDialogProps {
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  resourceName: string;
  onClose?: () => void;
  className?: string;
}

type AccessType = 'public' | 'password' | 'team' | 'allowlist';

const ACCESS_OPTIONS: Array<{ value: AccessType; label: string; icon: React.ReactNode; desc: string }> = [
  { value: 'public', label: 'Public', icon: <Globe className="w-4 h-4" />, desc: 'Anyone with the link can view' },
  { value: 'password', label: 'Password', icon: <Lock className="w-4 h-4" />, desc: 'Requires a password to view' },
  { value: 'team', label: 'Team Only', icon: <Users className="w-4 h-4" />, desc: 'Only team members can view' },
  { value: 'allowlist', label: 'Specific People', icon: <Mail className="w-4 h-4" />, desc: 'Only invited emails can view' },
];

export function ShareDialog({
  resourceType,
  resourceId,
  resourceName,
  onClose,
  className = '',
}: ShareDialogProps) {
  const [accessType, setAccessType] = useState<AccessType>('public');
  const [password, setPassword] = useState('');
  const [emails, setEmails] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          resourceType,
          resourceId,
          access: accessType,
          password: accessType === 'password' ? password : undefined,
          allowedEmails: accessType === 'allowlist' ? emails.split(',').map((e) => e.trim()) : undefined,
          expiresAt: expiresIn !== 'never'
            ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        }),
      });
      const data = await response.json();
      if (data.url) {
        setShareUrl(data.url);
        setEmbedCode(data.embedCode);
      }
    } catch {
      // Handle error
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Share: {resourceName}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
        )}
      </div>

      {!shareUrl ? (
        <>
          {/* Access Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Access</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAccessType(opt.value)}
                  className={`flex items-center gap-2 p-2.5 text-left text-sm rounded-lg border transition-colors ${
                    accessType === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  {opt.icon}
                  <div>
                    <div className="font-medium text-xs">{opt.label}</div>
                    <div className="text-[10px] text-gray-400">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Password input */}
          {accessType === 'password' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a password"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Email allowlist */}
          {accessType === 'allowlist' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Emails (comma-separated)</label>
              <input
                type="text"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="user@example.com, another@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Expiration */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expires</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
            >
              <option value="never">Never</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Create Share Link
          </button>
        </>
      ) : (
        <>
          {/* Share URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Share Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
              />
              <button
                onClick={() => handleCopy(shareUrl)}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
          </div>

          {/* Embed Code */}
          {embedCode && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Embed Code</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={embedCode}
                  className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                />
                <button
                  onClick={() => handleCopy(embedCode)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
