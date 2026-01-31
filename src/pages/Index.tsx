import { Users, CheckCircle2, ShieldAlert, TrendingUp } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { MetricCard } from "@/components/ui/MetricCard";
import { LiveRecognition } from "@/components/dashboard/LiveRecognition";
import { FraudAlerts } from "@/components/dashboard/FraudAlerts";
import { StudentRiskTable } from "@/components/dashboard/StudentRiskTable";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { ClassSession } from "@/components/dashboard/ClassSession";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";

const Index = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayAttendance: "0%",
    todaySubtitle: "0 present today",
    fraudAttempts: 0,
    atRiskStudents: 0,
  });

  useEffect(() => {
    const updateStats = () => {
      const students = dataService.getStudents();
      const attendanceStats = dataService.getAttendanceStats(undefined, 30);
      
      // Get today's attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRecords = dataService.getAttendanceRecords(undefined, today);
      const todayPresent = todayRecords.filter(r => r.status === "verified").length;
      const todayRate = students.length > 0 ? (todayPresent / students.length) * 100 : 0;
      
      // Get fraud alerts from this week
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fraudAlerts = dataService.getFraudAlerts().filter(a => a.timestamp >= weekAgo);
      
      setStats({
        totalStudents: students.length,
        todayAttendance: `${todayRate.toFixed(1)}%`,
        todaySubtitle: `${todayPresent} of ${students.length} present today`,
        fraudAttempts: fraudAlerts.length,
        atRiskStudents: attendanceStats.studentsAtRisk,
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Students"
              value={stats.totalStudents.toString()}
              subtitle="Registered students"
              icon={Users}
            />
            <MetricCard
              title="Today's Attendance"
              value={stats.todayAttendance}
              subtitle={stats.todaySubtitle}
              icon={CheckCircle2}
              variant="success"
            />
            <MetricCard
              title="Fraud Attempts"
              value={stats.fraudAttempts.toString()}
              subtitle="Detected this week"
              icon={ShieldAlert}
              variant="fraud"
            />
            <MetricCard
              title="At-Risk Students"
              value={stats.atRiskStudents.toString()}
              subtitle="Low attendance (last 30 days)"
              icon={TrendingUp}
              variant="warning"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              <AttendanceChart />
              <StudentRiskTable />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <LiveRecognition />
              <ClassSession />
            </div>
          </div>

          {/* Fraud Alerts Full Width */}
          <FraudAlerts />
        </main>
      </div>
    </div>
  );
};

export default Index;
