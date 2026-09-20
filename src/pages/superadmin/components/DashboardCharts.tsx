import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell
} from "recharts";

export function RevenueChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-slate-400 italic text-sm">Sin datos para el período</div>;
  }

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{fontSize: 10, fill: '#94a3b8'}}
            minTickGap={30}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{fontSize: 10, fill: '#94a3b8'}}
            tickFormatter={(v) => `S/ ${v}`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

export function PlanDistribution({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-slate-400 italic text-sm">Sin datos</div>;
  }

  return (
    <div className="h-[200px] w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
