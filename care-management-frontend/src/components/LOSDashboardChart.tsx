import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LabelList,
  Cell,
} from "recharts";

type Props = {
  data: {
    workflow: string;
    totalDays: number;
    totalCost: number;
  }[];
   nationalAverage: number;
};

const COLORS: Record<string, string> = {
  Behavioral: "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC: "var(--algo-ltc)",
};

const LOSDashboardChart: React.FC<Props> = ({ data ,nationalAverage}) => {
  return (
    <div className="grid gap-10 md:grid-cols-2 mt-10">
      {/* Total Length of Stay (Days) */}
      <div className="p-4 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2">Total Length of Stay (Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}
          margin={{ top: 40, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="workflow" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalDays" name="Days">
              <LabelList dataKey="totalDays" position="top" />
              {data.map((entry, index) => (
                <Cell key={`cell-days-${index}`} fill={COLORS[entry.workflow] || "#8884d8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Total Cost (USD) */}
      <div className="p-4 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2">Total Cost (USD)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}
          margin={{ top: 40, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="workflow" />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="totalCost" name="Cost">
              <LabelList
                dataKey="totalCost"
                position="top"
              formatter={(val) =>
                        typeof val === 'number' ? `$${val.toLocaleString()}` : ''
                        }
              />
              {data.map((entry, index) => (
                <Cell key={`cell-cost-${index}`} fill={COLORS[entry.workflow] || "#8884d8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
                    <p className="text-sm text-gray-500 italic mt-2">
                *Total cost is calculated using a National Hospitalization Average of ${nationalAverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}/day.
            </p>
                </div>
    </div>
  );
};

export default LOSDashboardChart;
