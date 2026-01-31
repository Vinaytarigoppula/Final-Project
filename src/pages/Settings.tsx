import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Trash2, Download } from "lucide-react";
import { dataService } from "@/services/dataService";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = () => {
    if (confirm("Are you sure you want to delete ALL data? This action cannot be undone!")) {
      if (confirm("This will delete all students, attendance records, and fraud alerts. Are you absolutely sure?")) {
        setIsClearing(true);
        dataService.clearAllData();
        toast.success("All data cleared successfully");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  };

  const handleExportData = () => {
    const students = dataService.getStudents();
    const records = dataService.getAttendanceRecords();
    const alerts = dataService.getFraudAlerts();

    const exportData = {
      students,
      attendance: records,
      fraudAlerts: alerts,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const students = dataService.getStudents();
  const records = dataService.getAttendanceRecords();
  const alerts = dataService.getFraudAlerts();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              System configuration and data management
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  <CardTitle>System Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Students</p>
                  <p className="text-lg font-semibold">{students.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Attendance Records</p>
                  <p className="text-lg font-semibold">{records.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fraud Alerts</p>
                  <p className="text-lg font-semibold">{alerts.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export or clear all data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleExportData} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export All Data
                </Button>
                <Button
                  onClick={handleClearAllData}
                  variant="destructive"
                  className="w-full"
                  disabled={isClearing}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isClearing ? "Clearing..." : "Clear All Data"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Privacy & Security</CardTitle>
                <CardDescription>Data storage and privacy settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Data Storage:</span>
                  <span>Local (Browser)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Privacy:</span>
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cloud Upload:</span>
                  <span>Disabled</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Processing:</span>
                  <span>100% Local</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recognition Settings</CardTitle>
                <CardDescription>Face recognition thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Match Threshold:</span>
                  <span>0.6</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Verification Threshold:</span>
                  <span>0.85</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Debounce Time:</span>
                  <span>5 minutes</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}





