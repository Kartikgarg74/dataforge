'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Upload, MessageSquare, BarChart3, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ConnectorForm } from '@/components/data/connector-form';
import { FileDropZone } from '@/components/data/file-drop-zone';

type Step = 'welcome' | 'connect' | 'upload' | 'explore' | 'done';

const STEPS: Array<{ id: Step; title: string; icon: React.ReactNode }> = [
  { id: 'welcome', title: 'Welcome', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'connect', title: 'Connect Data', icon: <Database className="w-5 h-5" /> },
  { id: 'upload', title: 'Upload Files', icon: <Upload className="w-5 h-5" /> },
  { id: 'explore', title: 'Start Exploring', icon: <MessageSquare className="w-5 h-5" /> },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [hasConnected, setHasConnected] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const router = useRouter();

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Progress */}
      <div className="flex items-center justify-between mb-10">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                i < currentIndex ? 'bg-green-100 text-green-600' :
                i === currentIndex ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i < currentIndex ? <CheckCircle2 className="w-5 h-5" /> : s.icon}
              </div>
              <span className={`text-[10px] font-medium ${i <= currentIndex ? 'text-gray-700' : 'text-gray-400'}`}>
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < currentIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Welcome */}
      {step === 'welcome' && (
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to DataForge
          </h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Let&apos;s get you set up in under 5 minutes. Connect your database or upload a file to start exploring your data.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep('connect')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Database className="w-4 h-4" />
              Connect Database
            </button>
            <button
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 rounded-lg"
            >
              <Upload className="w-4 h-4" />
              Upload a File
            </button>
          </div>
        </div>
      )}

      {/* Connect Database */}
      {step === 'connect' && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Connect Your Database
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Connect to PostgreSQL, MySQL, MongoDB, BigQuery, or Supabase. Your credentials are encrypted with AES-256.
          </p>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <ConnectorForm
              onConnect={() => {
                setHasConnected(true);
                setStep('explore');
              }}
            />
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('welcome')} className="text-sm text-gray-500 hover:text-gray-700">
              Back
            </button>
            <button onClick={() => setStep('upload')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Skip — upload a file instead <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Upload File */}
      {step === 'upload' && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Upload Your Data
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Drag and drop a CSV, JSON, Parquet, or Excel file. We&apos;ll auto-detect types and profile your data.
          </p>
          <FileDropZone
            onUploadComplete={() => {
              setHasUploaded(true);
              setStep('explore');
            }}
          />
          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('welcome')} className="text-sm text-gray-500 hover:text-gray-700">
              Back
            </button>
            {!hasConnected && (
              <button onClick={() => setStep('connect')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Connect a database instead <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Start Exploring */}
      {step === 'explore' && (
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            You&apos;re All Set!
          </h2>
          <p className="text-gray-500 mb-2">
            {hasConnected && 'Database connected successfully.'}
            {hasUploaded && 'File uploaded and profiled.'}
            {!hasConnected && !hasUploaded && 'You can start exploring right away.'}
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Ask questions in natural language, profile your data, or build transform pipelines.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <MessageSquare className="w-4 h-4" />
              Start Chatting
            </button>
            <button
              onClick={() => router.push('/dashboards')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 rounded-lg"
            >
              <BarChart3 className="w-4 h-4" />
              Create Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
