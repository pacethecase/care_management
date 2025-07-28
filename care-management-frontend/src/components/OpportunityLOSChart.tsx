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

type OpportunityData = {
  workflow: string;
  admissionDelay: number;
  taskDelay: number;
  totalDelay: number;
  cost: number;
};

type Props = {
  data: OpportunityData[];
  nationalAverage: number;
};

const COLORS: Record<string, string> = {
  Behavioral: "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC: "var(--algo-ltc)",
};

const OpportunityLOSChart: React.FC<Props> = ({ data, nationalAverage }) => (
  <div className="grid gap-10 md:grid-cols-2 mt-10">
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-2">Opportunity Delays by Type (Days)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="workflow" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="admissionDelay" name="Admission Delay" fill="#c623bbff">
            <LabelList dataKey="admissionDelay" position="top" />
          </Bar>
          <Bar dataKey="taskDelay" name="Task Delay" fill="#f34b2aff">
            <LabelList dataKey="taskDelay" position="top" />
          </Bar>
          <Bar dataKey="totalDelay" name="Total Delay" fill="#184683ff">
            <LabelList dataKey="totalDelay" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-2">Total Opportunity Cost (USD)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="workflow" />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Legend />
          <Bar dataKey="cost" name="Cost">
            <LabelList dataKey="cost" position="top" formatter={(val) => `$${Number(val).toLocaleString()}`} />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.workflow]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-500 italic mt-2">
        *Based on national average: ${nationalAverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}/day.
      </p>
    </div>
  </div>
);

export default OpportunityLOSChart;
