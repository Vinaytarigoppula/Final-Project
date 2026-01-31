import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { StudentRiskTable } from "@/components/dashboard/StudentRiskTable";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";

export default function Analytics() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalRecords: 0,
    averageAttendance: 0,
    fraudCount: 0,
  });

  useEffect(() => {
    const updateStats = () => {
      const students = dataService.getStudents();
      const records = dataService.getAttendanceRecords();
      const fraudAlerts = dataService.getFraudAlerts();
      
      const verifiedRecords = records.filter(r => r.status === "verified");
      const averageAttendance = records.length > 0
        ? (verifiedRecords.length / records.length) * 100
        : 0;

      setStats({
        totalStudents: students.length,
        totalRecords: records.length,
        averageAttendance,
        fraudCount: fraudAlerts.length,
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Comprehensive attendance analytics and insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card border border-border/50 p-4">
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold mt-1">{stats.totalStudents}</p>
            </div>
            <div className="glass-card border border-border/50 p-4">
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold mt-1">{stats.totalRecords}</p>
            </div>
            <div className="glass-card border border-border/50 p-4">
              <p className="text-sm text-muted-foreground">Avg Attendance</p>
              <p className="text-2xl font-bold mt-1">{stats.averageAttendance.toFixed(1)}%</p>
            </div>
            <div className="glass-card border border-border/50 p-4">
              <p className="text-sm text-muted-foreground">Fraud Alerts</p>
              <p className="text-2xl font-bold mt-1">{stats.fraudCount}</p>
            </div>
          </div>

          <AttendanceChart />
          <StudentRiskTable />
        </main>
      </div>
    </div>
  );
}





