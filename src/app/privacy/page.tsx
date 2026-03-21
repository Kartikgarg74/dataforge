'use client';

import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 20, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        {/* Introduction */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p>
            DataForge (&quot;we,&quot; &quot;our,&quot; or &quot;the Service&quot;) is committed to
            protecting your privacy. This Privacy Policy explains how we collect,
            use, store, and protect information when you use the DataForge
            application and related services. By using DataForge, you agree to the
            practices described in this policy.
          </p>
        </section>

        {/* Data Collection */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Data Collection</h2>
          <p className="mb-3">
            DataForge collects the minimum amount of information necessary to
            provide and improve the Service. The categories of data we may collect
            include:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account information:</strong> email address, display name,
              and hashed password when you create an account.
            </li>
            <li>
              <strong>Database connection metadata:</strong> host, port, database
              name, and user for each connection you configure. Credentials are
              encrypted at rest (see Section 4).
            </li>
            <li>
              <strong>Usage analytics:</strong> aggregated, non-identifying usage
              patterns such as feature adoption rates and error counts. We do
              not collect or transmit the content of your queries or query results.
            </li>
            <li>
              <strong>Uploaded files:</strong> CSV, JSON, Parquet, and Excel files
              you upload are stored locally in the embedded SQLite database on
              your machine.
            </li>
          </ul>
        </section>

        {/* Data Storage */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Storage (Local-First Architecture)</h2>
          <p className="mb-3">
            DataForge follows a <strong>local-first</strong> architecture. By
            default, all data remains on your machine:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Uploaded datasets are ingested into a local SQLite database that
              resides on your device.
            </li>
            <li>
              Dashboards, saved queries, and configuration are persisted in the
              browser&apos;s local storage and the local database.
            </li>
            <li>
              No user data is transmitted to external servers unless you
              explicitly initiate an export (e.g., to S3, HuggingFace, or a
              remote database).
            </li>
            <li>
              When self-hosting, you control the infrastructure entirely. No
              data leaves your network.
            </li>
          </ul>
        </section>

        {/* Database Connections */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Database Connections &amp; Credential Security</h2>
          <p className="mb-3">
            When you connect an external database (PostgreSQL, MySQL, MongoDB, or
            others), DataForge handles credentials with the following safeguards:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              All database credentials are encrypted using <strong>AES-256</strong>{' '}
              encryption before being stored.
            </li>
            <li>
              Encryption keys are derived per-user and are never transmitted to
              third parties.
            </li>
            <li>
              Database connections default to <strong>read-only</strong> access.
              DataForge does not perform write, update, or delete operations on
              your connected databases.
            </li>
            <li>
              Connection strings and credentials are never logged or included in
              error reports.
            </li>
          </ul>
        </section>

        {/* PII Handling */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Personally Identifiable Information (PII) Handling</h2>
          <p className="mb-3">
            DataForge includes built-in PII detection to help you manage
            sensitive data responsibly:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The data profiler automatically scans columns for potential PII
              patterns (e.g., email addresses, phone numbers, Social Security
              numbers, credit card numbers).
            </li>
            <li>
              When PII is detected, DataForge displays a warning before you
              export or share data, giving you the opportunity to redact or
              exclude sensitive columns.
            </li>
            <li>
              PII detection runs entirely on-device. No data content is sent to
              external services for PII analysis.
            </li>
          </ul>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies &amp; Session Management</h2>
          <p className="mb-3">DataForge uses cookies solely for the following purposes:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Session cookies:</strong> used to maintain your
              authenticated session. These cookies are HTTP-only, secure, and
              expire when you log out or after a configurable inactivity period.
            </li>
            <li>
              <strong>CSRF tokens:</strong> used to protect against
              cross-site request forgery attacks.
            </li>
            <li>
              DataForge does not use advertising cookies, tracking pixels, or
              third-party analytics cookies.
            </li>
          </ul>
        </section>

        {/* Third-Party Services */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Services</h2>
          <p className="mb-3">
            DataForge may interact with the following third-party services only
            when you explicitly configure or trigger them:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Export destinations:</strong> Amazon S3, HuggingFace, and
              other configured export targets receive data only when you initiate
              an export.
            </li>
            <li>
              <strong>Notification services:</strong> Slack, email providers, and
              webhook endpoints receive scheduled reports only if you configure
              delivery schedules.
            </li>
            <li>
              <strong>AI/LLM providers:</strong> natural language queries may be
              sent to an AI provider to generate SQL. Query results and raw data
              are never sent to the AI provider.
            </li>
          </ul>
        </section>

        {/* Telemetry */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Telemetry</h2>
          <p>
            DataForge does <strong>not</strong> collect telemetry on the content
            of your data, queries, or query results. Optional, anonymized usage
            telemetry (e.g., which features are used, crash reports) may be
            collected to improve the product. You can disable all telemetry in
            the application settings.
          </p>
        </section>

        {/* Push Notifications */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Push Notifications</h2>
          <p>
            DataForge supports optional push notifications on mobile devices to
            alert you about scheduled report completions, threshold alerts, and
            team activity. Push notifications require explicit opt-in. You can
            disable them at any time through your device settings or the
            application preferences.
          </p>
        </section>

        {/* Data Retention */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Data Retention &amp; Deletion</h2>
          <p>
            Since DataForge is local-first, you retain full control over your
            data. You can delete uploaded datasets, saved queries, dashboards,
            and connection configurations at any time through the application.
            Deleting your account removes all associated data from the local
            database. If you are using a self-hosted instance, data retention is
            governed by your own infrastructure policies.
          </p>
        </section>

        {/* Children's Privacy */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Children&apos;s Privacy</h2>
          <p>
            DataForge is not directed at children under 13 years of age. We do
            not knowingly collect personal information from children. If you
            believe a child has provided us with personal information, please
            contact us so we can take appropriate action.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will update the &quot;Last updated&quot; date at the top
            of this page and, where appropriate, notify you via the application
            or email.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or
            DataForge&apos;s data practices, please contact us at:
          </p>
          <p className="mt-2 font-medium">
            privacy@dataforge.app
          </p>
        </section>
      </div>
    </div>
  );
}
