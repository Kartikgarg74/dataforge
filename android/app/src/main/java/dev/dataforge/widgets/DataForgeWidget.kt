// DataForge Android Home Screen Widget
// Built with AppWidgetProvider + RemoteViews
//
// To use: Add this to the Android project after running `npx cap add android`
// Register in AndroidManifest.xml as a receiver

package dev.dataforge.widgets

/*
 * Widget sizes:
 * - 1x1: Single metric number
 * - 2x1: Metric + trend indicator
 * - 4x2: Mini dashboard with 3 metrics
 *
 * Data flow:
 * 1. Widget requests data from DataForge API via OkHttp
 * 2. Auth via stored API key in EncryptedSharedPreferences
 * 3. Data cached locally for offline display
 * 4. WorkManager schedules periodic refresh (30min default)
 *
 * Implementation outline:
 *
 * class DataForgeWidgetProvider : AppWidgetProvider() {
 *     override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
 *         ids.forEach { id ->
 *             val config = loadConfig(context, id)
 *             val views = buildRemoteViews(context, config)
 *             manager.updateAppWidget(id, views)
 *             scheduleRefresh(context, id, config.refreshInterval)
 *         }
 *     }
 *
 *     private fun buildRemoteViews(context: Context, config: WidgetConfig): RemoteViews {
 *         val views = RemoteViews(context.packageName, R.layout.widget_layout)
 *         val metrics = fetchMetrics(config)
 *
 *         views.setTextViewText(R.id.metric_value, formatValue(metrics[0]))
 *         views.setTextViewText(R.id.metric_label, metrics[0].label)
 *
 *         if (metrics[0].trend != null) {
 *             val trendText = "${if (metrics[0].trend.direction == "up") "↑" else "↓"} ${metrics[0].trend.value}%"
 *             views.setTextViewText(R.id.metric_trend, trendText)
 *             views.setTextColor(R.id.metric_trend,
 *                 if (metrics[0].trend.isGood) Color.GREEN else Color.RED)
 *         }
 *
 *         // Set click to open app
 *         val intent = Intent(context, MainActivity::class.java)
 *         intent.putExtra("dashboardId", config.dashboardId)
 *         val pending = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_IMMUTABLE)
 *         views.setOnClickPendingIntent(R.id.widget_root, pending)
 *
 *         return views
 *     }
 * }
 *
 * // Widget configuration activity
 * class DataForgeWidgetConfigActivity : AppCompatActivity() {
 *     // Shows list of dashboards
 *     // User selects dashboard + metrics
 *     // Saves config to SharedPreferences
 *     // Triggers initial widget update
 * }
 *
 * // Background refresh with WorkManager
 * class WidgetRefreshWorker(context: Context, params: WorkerParameters)
 *     : CoroutineWorker(context, params) {
 *     override suspend fun doWork(): Result {
 *         val config = loadConfig(applicationContext)
 *         val metrics = fetchMetrics(config)
 *         updateWidget(applicationContext, metrics)
 *         return Result.success()
 *     }
 * }
 *
 * // Data models
 * data class WidgetConfig(
 *     val dashboardId: String,
 *     val metricIds: List<String>,
 *     val refreshInterval: Int = 30, // minutes
 *     val style: String = "light"
 * )
 *
 * data class WidgetMetric(
 *     val label: String,
 *     val value: Double,
 *     val format: String,
 *     val prefix: String?,
 *     val suffix: String?,
 *     val trend: MetricTrend?
 * )
 *
 * data class MetricTrend(
 *     val value: Double,
 *     val direction: String,
 *     val isGood: Boolean
 * )
 *
 * // API client
 * object DataForgeApi {
 *     private val client = OkHttpClient()
 *
 *     suspend fun fetchMetrics(config: WidgetConfig): List<WidgetMetric> {
 *         val prefs = EncryptedSharedPreferences.create(...)
 *         val apiKey = prefs.getString("api_key", null) ?: throw Exception("No API key")
 *         val baseUrl = prefs.getString("base_url", "http://localhost:3000")
 *
 *         val body = JSONObject().apply {
 *             put("action", "get")
 *             put("id", config.dashboardId)
 *         }
 *
 *         val request = Request.Builder()
 *             .url("$baseUrl/api/dashboard")
 *             .post(body.toString().toRequestBody("application/json".toMediaType()))
 *             .addHeader("Authorization", "Bearer $apiKey")
 *             .build()
 *
 *         val response = client.newCall(request).execute()
 *         return parseMetrics(response.body?.string())
 *     }
 * }
 */
