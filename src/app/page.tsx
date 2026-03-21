import Link from 'next/link';
import {
  Upload,
  BarChart3,
  Shuffle,
  Scissors,
  Download,
  LayoutDashboard,
  Database,
  FileJson,
  FileSpreadsheet,
  Github,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Upload,
    title: 'Upload',
    description: 'Drag & drop CSV, JSON, Parquet, or Excel files for instant ingestion.',
  },
  {
    icon: BarChart3,
    title: 'Profile',
    description: 'Auto-detect types, distributions, nulls, outliers, and quality issues.',
  },
  {
    icon: Shuffle,
    title: 'Transform',
    description: 'Clean, filter, join, and reshape data with AI-assisted SQL transforms.',
  },
  {
    icon: Scissors,
    title: 'Split',
    description: 'Create train/test/validation splits for machine learning workflows.',
  },
  {
    icon: Download,
    title: 'Export',
    description: 'Export to CSV, JSON, Parquet, or push directly to your warehouse.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboards',
    description: 'Build interactive dashboards with drag-and-drop widget layouts.',
  },
];

const TECH_BADGES = [
  { label: 'PostgreSQL', icon: Database },
  { label: 'MySQL', icon: Database },
  { label: 'SQLite', icon: Database },
  { label: 'CSV', icon: FileSpreadsheet },
  { label: 'JSON', icon: FileJson },
  { label: 'Parquet', icon: FileSpreadsheet },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-[family-name:var(--font-geist-sans)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered data engineering
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
            From raw database to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              ML-ready dataset
            </span>{' '}
            in minutes
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Upload, profile, transform, and export your data with an AI assistant
            that writes the SQL for you. Build dashboards, catch quality issues,
            and ship clean datasets faster.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              href="/upload"
              className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Everything you need for data prep
          </h2>
          <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            A complete toolkit for data engineers, analysts, and ML practitioners.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tech Badges */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="text-center mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Supports your stack
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {TECH_BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Source Callout */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 md:p-12 text-center">
          <Github className="w-8 h-8 text-gray-800 dark:text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Open Source
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-6">
            DataForge is fully open source. Inspect the code, contribute features,
            or self-host on your own infrastructure.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg transition-colors"
          >
            Start Building
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
