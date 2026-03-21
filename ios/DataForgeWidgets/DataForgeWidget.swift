// DataForge iOS Home Screen Widget
// Built with WidgetKit + SwiftUI (iOS 14+)
//
// To use: Add this as a Widget Extension target in Xcode
// after running `npx cap add ios`

import Foundation

// MARK: - Widget Configuration

/// Widget sizes supported by DataForge
enum WidgetSize: String, CaseIterable {
    case small   // 2x2 - Single KPI
    case medium  // 4x2 - KPI + Sparkline
    case large   // 4x4 - Mini Dashboard (3 KPIs + chart)
}

/// User configuration for a DataForge widget
struct DataForgeWidgetConfig: Codable {
    let dashboardId: String
    let metricIds: [String]
    let refreshInterval: Int // minutes: 15, 30, 60, 240
    let style: String // "light" or "dark"
}

// MARK: - API Response Models

struct WidgetMetric: Codable {
    let label: String
    let value: Double
    let format: String // "number", "currency", "percent"
    let prefix: String?
    let suffix: String?
    let trend: MetricTrend?
    let sparkline: [Double]?
}

struct MetricTrend: Codable {
    let value: Double
    let direction: String // "up", "down", "flat"
    let isGood: Bool
}

// MARK: - Data Fetching

/// Fetches widget data from the DataForge API
/// Uses URL session with stored API key from Keychain
///
/// API endpoint: GET /api/dashboard?action=get&id={dashboardId}
/// Auth: Bearer token from Keychain "dev.dataforge.app.apikey"
///
/// Implementation:
/// ```swift
/// func fetchWidgetData(config: DataForgeWidgetConfig) async throws -> [WidgetMetric] {
///     let url = URL(string: "\(baseURL)/api/dashboard")!
///     var request = URLRequest(url: url)
///     request.httpMethod = "POST"
///     request.setValue("application/json", forHTTPHeaderField: "Content-Type")
///     request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
///     request.httpBody = try JSONEncoder().encode([
///         "action": "get",
///         "id": config.dashboardId
///     ])
///     let (data, _) = try await URLSession.shared.data(for: request)
///     return try JSONDecoder().decode([WidgetMetric].self, from: data)
/// }
/// ```

// MARK: - Widget Views (SwiftUI)

/// Small widget (2x2): Single KPI metric
/// ```swift
/// struct SmallWidgetView: View {
///     let metric: WidgetMetric
///     var body: some View {
///         VStack(alignment: .leading, spacing: 4) {
///             Text(metric.label)
///                 .font(.caption2)
///                 .foregroundColor(.secondary)
///             Text(formatValue(metric))
///                 .font(.title2)
///                 .fontWeight(.bold)
///             if let trend = metric.trend {
///                 HStack(spacing: 2) {
///                     Image(systemName: trend.direction == "up" ? "arrow.up" : "arrow.down")
///                     Text("\(abs(trend.value), specifier: "%.1f")%")
///                 }
///                 .font(.caption2)
///                 .foregroundColor(trend.isGood ? .green : .red)
///             }
///         }
///         .padding()
///     }
/// }
/// ```

/// Medium widget (4x2): KPI + Sparkline
/// Large widget (4x4): 3 KPIs + mini chart

// MARK: - Timeline Provider

/// Provides data updates to the widget
/// ```swift
/// struct DataForgeTimelineProvider: TimelineProvider {
///     func placeholder(in context: Context) -> DataForgeEntry {
///         DataForgeEntry(date: Date(), metrics: [sampleMetric])
///     }
///
///     func getSnapshot(in context: Context, completion: @escaping (DataForgeEntry) -> Void) {
///         completion(DataForgeEntry(date: Date(), metrics: [sampleMetric]))
///     }
///
///     func getTimeline(in context: Context, completion: @escaping (Timeline<DataForgeEntry>) -> Void) {
///         Task {
///             let metrics = try await fetchWidgetData(config: loadConfig())
///             let entry = DataForgeEntry(date: Date(), metrics: metrics)
///             let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
///             let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
///             completion(timeline)
///         }
///     }
/// }
/// ```

// MARK: - Widget Bundle

/// ```swift
/// @main
/// struct DataForgeWidgetBundle: WidgetBundle {
///     var body: some Widget {
///         DataForgeSmallWidget()
///         DataForgeMediumWidget()
///         DataForgeLargeWidget()
///     }
/// }
/// ```
