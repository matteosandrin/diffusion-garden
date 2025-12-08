import { useEffect, useState } from "react";
import { analyticsApi, type DailyStats } from "../api/client";

interface AggregatedDay {
  date: string;
  text_requests: number;
  image_requests: number;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

const tdStyle = "border border-white px-3 py-2";

export function AnalyticsPage({ onBack }: { onBack: () => void }) {
  // Get local timezone as default
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState<string>(localTimezone);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await analyticsApi.getDaily(timezone);
        setStats(response.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [timezone]);

  // Aggregate stats by date
  const aggregatedByDate: AggregatedDay[] = [];
  const dateMap = new Map<string, AggregatedDay>();
  for (const stat of stats) {
    let day = dateMap.get(stat.date);
    if (!day) {
      day = {
        date: stat.date,
        text_requests: 0,
        image_requests: 0,
        total_requests: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      dateMap.set(stat.date, day);
      aggregatedByDate.push(day);
    }

    if (stat.request_type === "text") {
      day.text_requests += stat.request_count;
    } else if (stat.request_type === "image") {
      day.image_requests += stat.request_count;
    }
    day.total_requests += stat.request_count;
    day.input_tokens += stat.input_tokens;
    day.output_tokens += stat.output_tokens;
    day.total_tokens += stat.total_tokens;
  }
  // Calculate totals
  const totals = aggregatedByDate.reduce(
    (acc, day) => ({
      text_requests: acc.text_requests + day.text_requests,
      image_requests: acc.image_requests + day.image_requests,
      total_requests: acc.total_requests + day.total_requests,
      input_tokens: acc.input_tokens + day.input_tokens,
      output_tokens: acc.output_tokens + day.output_tokens,
      total_tokens: acc.total_tokens + day.total_tokens,
    }),
    {
      text_requests: 0,
      image_requests: 0,
      total_requests: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
  );
  // Get max values for chart scaling
  const maxRequests = Math.max(
    ...aggregatedByDate.map((d) => d.total_requests),
    1,
  );
  const maxTokens = Math.max(...aggregatedByDate.map((d) => d.total_tokens), 1);
  // Reverse for chart (oldest to newest)
  const chartData = [...aggregatedByDate].reverse().slice(-14); // Last 14 days

  if (loading) {
    return <div className="p-4 font-mono h-full overflow-auto">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 font-mono h-full overflow-auto">
        <p>Error: {error}</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  }

  return (
    <div className="p-4 font-mono h-full overflow-auto flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="flex items-center">
        <div className="flex items-center h-full px-2 border border-white">
          <label htmlFor="timezone-select" className="text-sm">
            Timezone:
          </label>
        </div>
        <select
          id="timezone-select"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="px-3 py-1 border border-white bg-black text-white font-mono text-sm"
        >
          <option value={localTimezone}>Local ({localTimezone})</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      {/* Summary */}
      <div>
        <h2 className="text-lg font-bold mb-2">Summary</h2>
        <p>
          Total Requests: <strong>{totals.total_requests}</strong> (Text:{" "}
          {totals.text_requests}, Image: {totals.image_requests})
        </p>
        <p>
          Total Tokens: <strong>{totals.total_tokens.toLocaleString()}</strong>{" "}
          (Input: {totals.input_tokens.toLocaleString()}, Output:{" "}
          {totals.output_tokens.toLocaleString()})
        </p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-2">
            Requests per Day (Last 14 Days)
          </h2>
          <svg
            width="100%"
            height="200"
            viewBox={`0 0 ${chartData.length * 50 + 50} 200`}
            style={{ maxWidth: 800 }}
          >
            {/* Y-axis labels and ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = 170 - pct * 150;
              const value = Math.round(maxRequests * pct);
              return (
                <g key={pct}>
                  <text x="5" y={y + 4} fontSize="10" fill="#666">
                    {value}
                  </text>
                  <line
                    x1="35"
                    y1={y}
                    x2="40"
                    y2={y}
                    stroke="#666"
                    strokeWidth="1"
                  />
                  <line
                    x1="40"
                    y1={y}
                    x2={chartData.length * 50 + 45}
                    y2={y}
                    stroke="#333"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                </g>
              );
            })}

            {/* Bars */}
            {chartData.map((day, i) => {
              const barHeight = (day.total_requests / maxRequests) * 150;
              const textHeight = (day.text_requests / maxRequests) * 150;
              const x = 45 + i * 50;

              return (
                <g key={day.date}>
                  {/* Image requests (bottom) */}
                  <rect
                    x={x}
                    y={170 - barHeight}
                    width="35"
                    height={barHeight - textHeight}
                    fill="#4CAF50"
                  />
                  {/* Text requests (top) */}
                  <rect
                    x={x}
                    y={170 - barHeight + (barHeight - textHeight)}
                    width="35"
                    height={textHeight}
                    fill="#2196F3"
                  />
                  {/* Date label */}
                  <text
                    x={x + 17}
                    y="190"
                    fontSize="10"
                    fill="#666"
                    textAnchor="middle"
                  >
                    {day.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 12, color: "#666" }}>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "#2196F3",
                marginRight: 4,
              }}
            ></span>
            Text
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "#4CAF50",
                marginRight: 4,
                marginLeft: 16,
              }}
            ></span>
            Image
          </div>
        </div>
      )}

      {/* Tokens Chart */}
      {chartData.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-2">
            Tokens per Day (Last 14 Days)
          </h2>
          <svg
            width="100%"
            height="200"
            viewBox={`0 0 ${chartData.length * 50 + 50} 200`}
            style={{ maxWidth: 800 }}
          >
            {/* Y-axis labels and ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = 170 - pct * 150;
              const value = maxTokens * pct;
              const label =
                value >= 1000
                  ? `${(value / 1000).toFixed(0)}k`
                  : value.toFixed(0);
              return (
                <g key={pct}>
                  <text x="5" y={y + 4} fontSize="10" fill="#666">
                    {label}
                  </text>
                  <line
                    x1="35"
                    y1={y}
                    x2="40"
                    y2={y}
                    stroke="#666"
                    strokeWidth="1"
                  />
                  <line
                    x1="40"
                    y1={y}
                    x2={chartData.length * 50 + 45}
                    y2={y}
                    stroke="#333"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                </g>
              );
            })}

            {/* Bars */}
            {chartData.map((day, i) => {
              const barHeight = (day.total_tokens / maxTokens) * 150;
              const x = 45 + i * 50;

              return (
                <g key={day.date}>
                  <rect
                    x={x}
                    y={170 - barHeight}
                    width="35"
                    height={barHeight}
                    fill="#FF9800"
                  />
                  <text
                    x={x + 17}
                    y="190"
                    fontSize="10"
                    fill="#666"
                    textAnchor="middle"
                  >
                    {day.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Table */}
      <div>
        <h2 className="text-lg font-bold mb-2">Daily Breakdown</h2>
        {aggregatedByDate.length === 0 ? (
          <p>No data yet.</p>
        ) : (
          <table border={1} cellPadding={8} cellSpacing={0}>
            <thead>
              <tr>
                <th className={tdStyle}>Date</th>
                <th className={tdStyle}>Total Requests</th>
                <th className={tdStyle}>Text Requests</th>
                <th className={tdStyle}>Image Requests</th>
                <th className={tdStyle}>Input Tokens</th>
                <th className={tdStyle}>Output Tokens</th>
                <th className={tdStyle}>Total Tokens</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedByDate.map((day) => (
                <tr key={day.date}>
                  <td className={tdStyle}>{day.date}</td>
                  <td className={tdStyle}>{day.total_requests}</td>
                  <td className={tdStyle}>{day.text_requests}</td>
                  <td className={tdStyle}>{day.image_requests}</td>
                  <td className={tdStyle}>
                    {day.input_tokens.toLocaleString()}
                  </td>
                  <td className={tdStyle}>
                    {day.output_tokens.toLocaleString()}
                  </td>
                  <td className={tdStyle}>
                    {day.total_tokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className={tdStyle}>Total</td>
                <td className={tdStyle}>{totals.total_requests}</td>
                <td className={tdStyle}>{totals.text_requests}</td>
                <td className={tdStyle}>{totals.image_requests}</td>
                <td className={tdStyle}>
                  {totals.input_tokens.toLocaleString()}
                </td>
                <td className={tdStyle}>
                  {totals.output_tokens.toLocaleString()}
                </td>
                <td className={tdStyle}>
                  {totals.total_tokens.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
