/**
 * Email HTML Template Generator
 *
 * Generates responsive HTML email templates for scheduled reports.
 * Uses inline CSS only (email clients do not support external stylesheets).
 */

interface GenerateReportEmailOptions {
  teamName: string;
  dashboardName: string;
  widgets: Array<{
    title: string;
    type: string;
    htmlContent: string;
  }>;
  baseUrl: string;
  dashboardId?: string;
  scheduleId?: string;
}

/**
 * Generate a complete HTML email for a scheduled dashboard report.
 */
export function generateReportEmail(options: GenerateReportEmailOptions): string {
  const { teamName, dashboardName, widgets, baseUrl, dashboardId, scheduleId } = options;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const widgetSections = widgets
    .map(
      (widget) => `
      <!-- Widget: ${escapeHtml(widget.title)} -->
      <tr>
        <td style="padding:0 0 24px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:13px;font-weight:600;color:#374151;">${escapeHtml(widget.title)}</td>
                    <td align="right" style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(widget.type)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px;background:#ffffff;">
                ${widget.htmlContent}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join('\n');

  const dashboardLink = dashboardId
    ? `${baseUrl}/dashboards/${dashboardId}`
    : baseUrl;

  const manageLink = scheduleId
    ? `${baseUrl}/settings?tab=schedules&id=${scheduleId}`
    : `${baseUrl}/settings?tab=schedules`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${escapeHtml(dashboardName)} - Report</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Background wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Email container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:28px 24px;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);background-color:#2563eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">DataForge</h1>
                    <p style="margin:4px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);">${escapeHtml(teamName)}</p>
                  </td>
                  <td align="right" valign="top">
                    <div style="background:rgba(255,255,255,0.15);border-radius:6px;padding:6px 12px;display:inline-block;">
                      <span style="font-size:11px;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.5px;">Report</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dashboard name and date -->
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
              <h2 style="margin:0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(dashboardName)}</h2>
              <p style="margin:6px 0 0 0;font-size:12px;color:#9ca3af;">${dateStr} at ${timeStr}</p>
            </td>
          </tr>

          <!-- Widget sections -->
          <tr>
            <td style="padding:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${widgetSections}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <a href="${escapeHtml(dashboardLink)}" style="display:inline-block;padding:8px 20px;background-color:#2563eb;color:#ffffff;font-size:13px;font-weight:500;text-decoration:none;border-radius:6px;">
                      View full dashboard &#8594;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;">
                    <p style="margin:0;font-size:11px;color:#9ca3af;">
                      <a href="${escapeHtml(manageLink)}" style="color:#6b7280;text-decoration:underline;">Manage this report</a>
                      &nbsp;&middot;&nbsp;
                      Sent by <span style="color:#6b7280;font-weight:500;">DataForge</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
