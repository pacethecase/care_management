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

const COLORS1: Record<string, string> = {
   task_delay: "#c5aa50",   
  admission_delay: "#38464F",
  total_delay: "#AFC6CF"
};
const OpportunityLOSChart: React.FC<Props> = ({ data }) => (
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
          <Bar dataKey="admissionDelay" name="Admission Delay" fill={COLORS1.admission_delay}>
            <LabelList dataKey="admissionDelay" position="top" />
          </Bar>
          <Bar dataKey="taskDelay" name="Task Delay" fill={COLORS1.task_delay}>
            <LabelList dataKey="taskDelay" position="top" />
          </Bar>
          <Bar dataKey="totalDelay" name="Total Delay" fill={COLORS1.total_delay}>
            <LabelList dataKey="totalDelay" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-500 italic mt-2">
      “Admission Delay” refers to the number of days between a patient's admission to the hospital and their entry into the system.
    </p>
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
            Total cost is calculated using Individual Hospital Daily Rates and/or National Hospitalization Average of $2883 if not available
      </p>
    </div>
  </div>
);

export default OpportunityLOSChart;
