// DataForge iOS Widget Configuration
// This file defines the widget types available on the iOS home screen.
// Requires Xcode and the actual Capacitor iOS project to build.

/*
Widget Sizes:
- Small (2x2): Single KPI metric
- Medium (4x2): KPI + sparkline trend
- Large (4x4): Mini dashboard with 3 KPIs + chart

Configuration:
- User selects a dashboard from their DataForge dashboards
- User selects which metrics to display
- Refresh interval: 15min, 30min, 1hr, 4hr

Data Flow:
- Widget requests data from DataForge API via URL session
- Authentication via stored API key in Keychain
- Data cached locally for offline display
- Background refresh via WidgetKit timeline

Implementation Notes:
- Use WidgetKit framework (iOS 14+)
- SwiftUI for widget views
- IntentConfiguration for user customization
- TimelineProvider for data updates
*/

import Foundation

// MARK: - Widget Size Definitions

enum DataForgeWidgetSize: String, CaseIterable {
    case small = "small"   // 2x2 — single KPI
    case medium = "medium" // 4x2 — KPI + sparkline
    case large = "large"   // 4x4 — mini dashboard
}

// MARK: - Widget Configuration

struct DataForgeWidgetConfig {
    /// The dashboard ID to pull metrics from
    let dashboardId: String

    /// Which metric IDs to display in the widget
    let metricIds: [String]

    /// Background refresh interval in minutes
    let refreshIntervalMinutes: Int

    /// Widget display size
    let size: DataForgeWidgetSize

    /// Default refresh intervals available to the user
    static let availableIntervals = [15, 30, 60, 240]
}

// MARK: - Keychain Keys

struct DataForgeKeychainKeys {
    static let apiKey = "co.dataforge.widget.apiKey"
    static let baseURL = "co.dataforge.widget.baseURL"
    static let refreshToken = "co.dataforge.widget.refreshToken"
}

// MARK: - API Response Models

struct WidgetMetric: Codable {
    let id: String
    let label: String
    let value: Double
    let previousValue: Double?
    let unit: String?
    let sparkline: [Double]?
}

struct WidgetDashboardResponse: Codable {
    let dashboardId: String
    let title: String
    let metrics: [WidgetMetric]
    let updatedAt: String
}

// MARK: - Cache Configuration

struct WidgetCacheConfig {
    /// Maximum age of cached data before it is considered stale (in seconds)
    static let maxCacheAge: TimeInterval = 3600 // 1 hour

    /// App group identifier for sharing data between app and widget
    static let appGroupId = "group.co.dataforge.shared"

    /// Cache file name within the app group container
    static let cacheFileName = "widget_cache.json"
}
