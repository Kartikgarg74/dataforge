'use client';

import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 20, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        {/* Acceptance */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using DataForge (&quot;the Service&quot;), you agree to be
            bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to
            these Terms, you may not use the Service. These Terms apply to all
            users of the Service, including self-hosted deployments.
          </p>
        </section>

        {/* Description */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of the Service</h2>
          <p>
            DataForge is a data exploration and analytics platform that allows
            users to connect databases, upload files, run natural language
            queries, build dashboards, and export data. The Service provides
            read-only access to connected databases and local data processing
            capabilities.
          </p>
        </section>

        {/* Data Ownership */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Ownership</h2>
          <p className="mb-3">
            You retain full ownership of all data you upload, connect, query,
            and generate through the Service:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              All datasets, query results, dashboards, and exports you create
              belong to you.
            </li>
            <li>
              DataForge does not claim any intellectual property rights over your
              data or content.
            </li>
            <li>
              You are responsible for ensuring you have the right to upload,
              query, and share any data you use with the Service.
            </li>
            <li>
              When you delete data from the Service, it is removed from the
              local database. DataForge does not retain copies of your data.
            </li>
          </ul>
        </section>

        {/* Acceptable Use */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use</h2>
          <p className="mb-3">You agree not to use the Service to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Violate any applicable laws, regulations, or third-party rights.
            </li>
            <li>
              Attempt to gain unauthorized access to databases or systems you do
              not own or have permission to access.
            </li>
            <li>
              Use the Service to perform write, update, or delete operations on
              connected databases (the Service provides read-only access by
              design).
            </li>
            <li>
              Distribute malware, exploit vulnerabilities, or conduct denial-of-service
              attacks against the Service or connected systems.
            </li>
            <li>
              Circumvent rate limits, authentication mechanisms, or security
              controls implemented by the Service.
            </li>
            <li>
              Share or expose database credentials, API keys, or other secrets
              through public dashboards or exports.
            </li>
          </ul>
        </section>

        {/* Read-Only Access */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Read-Only Database Access</h2>
          <p>
            DataForge connects to your databases in <strong>read-only mode</strong>.
            The Service executes SELECT queries only and does not perform INSERT,
            UPDATE, DELETE, DROP, or any other data modification operations on
            your connected databases. You are responsible for configuring
            appropriate database user permissions to enforce this at the database
            level.
          </p>
        </section>

        {/* Service Availability */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Service Availability</h2>
          <p className="mb-3">
            DataForge is primarily a self-hosted application. As such:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              We do not guarantee any specific uptime or availability for
              self-hosted instances. Availability depends on your own
              infrastructure and deployment.
            </li>
            <li>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis
              without warranties of any kind.
            </li>
            <li>
              We may release updates, patches, and new versions at our
              discretion. You are responsible for updating your self-hosted
              deployment.
            </li>
            <li>
              Scheduled maintenance or breaking changes will be communicated
              through release notes and the project repository.
            </li>
          </ul>
        </section>

        {/* Rate Limiting */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Rate Limiting &amp; Usage Limits</h2>
          <p className="mb-3">
            To ensure fair usage and system stability, the Service enforces the
            following limits:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              API endpoints are rate-limited to prevent abuse. Default limits
              are documented in the configuration.
            </li>
            <li>
              File uploads are subject to size limits (configurable in
              self-hosted deployments).
            </li>
            <li>
              Query execution may be subject to timeouts to prevent
              long-running queries from consuming excessive resources.
            </li>
            <li>
              Administrators of self-hosted instances can adjust these limits
              in the application configuration.
            </li>
          </ul>
        </section>

        {/* Limitation of Liability */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
          <p className="mb-3">
            To the maximum extent permitted by applicable law:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              DataForge and its contributors shall not be liable for any
              indirect, incidental, special, consequential, or punitive
              damages arising from your use of the Service.
            </li>
            <li>
              We are not responsible for data loss, corruption, or unauthorized
              access resulting from misconfiguration, security vulnerabilities
              in connected databases, or infrastructure failures.
            </li>
            <li>
              The Service is not a substitute for professional database
              administration, data governance, or security auditing.
            </li>
          </ul>
        </section>

        {/* Open Source License */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Open Source License</h2>
          <p className="mb-3">
            DataForge is released under a dual <strong>MIT / Apache 2.0</strong>{' '}
            open source license. This means:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              You are free to use, modify, and distribute the software in
              accordance with the terms of either license.
            </li>
            <li>
              Contributions to the project are subject to the project&apos;s
              contributor license agreement.
            </li>
            <li>
              The software is provided without warranty. See the license files
              in the project repository for the full legal text.
            </li>
            <li>
              Third-party dependencies included in the project are subject to
              their own respective licenses.
            </li>
          </ul>
        </section>

        {/* Indemnification */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless DataForge and its
            contributors from any claims, damages, losses, or expenses
            (including reasonable attorney fees) arising from your use of the
            Service, your violation of these Terms, or your violation of any
            rights of a third party.
          </p>
        </section>

        {/* Termination */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
          <p>
            You may stop using the Service at any time. For self-hosted
            instances, you can uninstall or shut down the application. We
            reserve the right to terminate or suspend access to managed
            services for violations of these Terms, with reasonable notice
            where practicable.
          </p>
        </section>

        {/* Governing Law */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the jurisdiction in which the primary maintainers
            reside, without regard to conflict of law provisions. Any disputes
            arising under these Terms shall be resolved in the appropriate
            courts of that jurisdiction.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Changes to These Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material
            changes will be communicated through the project repository,
            release notes, or in-app notification. Your continued use of the
            Service after changes take effect constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact</h2>
          <p>
            If you have questions about these Terms of Service, please contact
            us at:
          </p>
          <p className="mt-2 font-medium">
            legal@dataforge.app
          </p>
        </section>
      </div>
    </div>
  );
}
