import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";

interface ChartData {
  day: string;
  attendance: number;
  predicted?: number;
}

export function AttendanceChart() {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    const loadChartData = () => {
      const now = new Date();
      const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const chartData: ChartData[] = [];
      
      const students = dataService.getStudents();
      
      // Calculate attendance for each day of the current week
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // Get all attendance records for this day
        const dayRecords = dataService.getAttendanceRecords(undefined, date, nextDay);
        const dayPresent = dayRecords.filter(r => r.status === "verified").length;
        
        // Calculate attendance rate
        const attendanceRate = students.length > 0 
          ? (dayPresent / students.length) * 100 
          : 0;
        
        const dayName = daysOfWeek[date.getDay()];
        const dayLabel = `${dayName} ${date.getDate()}`;
        
        // Simple prediction (average of previous days)
        let predicted = attendanceRate;
        if (chartData.length > 0) {
          const previousAvg = chartData.reduce((sum, d) => sum + d.attendance, 0) / chartData.length;
          predicted = previousAvg * 0.95; // Slight decline prediction
        }
        
        chartData.push({
          day: dayLabel,
          attendance: Math.round(attendanceRate),
          predicted: Math.round(predicted),
        });
      }
      
      setData(chartData);
    };

    loadChartData();
    const interval = setInterval(loadChartData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card border border-border/50 p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Weekly Attendance Overview</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success/50" />
            <span className="text-muted-foreground">Predicted</span>
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis 
                dataKey="day" 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222, 47%, 8%)",
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(210, 40%, 96%)" }}
              />
              {data[0]?.predicted !== undefined && (
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(160, 84%, 39%)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={1}
                  fill="url(#colorPredicted)"
                />
              )}
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="hsl(187, 85%, 53%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAttendance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-muted-foreground">
          <p className="text-sm">No attendance data available</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
        <TrendingUp className="w-4 h-4 text-success" />
        <span>Based on actual attendance records from the past week</span>
      </div>
    </div>
  );
}
