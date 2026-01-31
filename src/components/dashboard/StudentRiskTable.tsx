import { TrendingDown, TrendingUp, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { dataService } from "@/services/dataService";
import { lstmService } from "@/services/lstmService";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface StudentRisk {
  id: string;
  name: string;
  studentId: string;
  attendanceRate: number;
  riskScore: number;
  predictedRiskScore: number; // LSTM prediction
  trend: "up" | "down" | "stable";
  predictedTrend: "improving" | "declining" | "stable"; // LSTM predicted trend
  prediction: string;
  lstmPrediction: string; // LSTM-based prediction
  lstmConfidence: number;
  lastSeen: string;
  lastSeenDate: Date | null;
  isLSTMPredicted: boolean;
}

function getRiskStatus(score: number): "verified" | "warning" | "fraud" {
  if (score >= 70) return "fraud";
  if (score >= 40) return "warning";
  return "verified";
}

export function StudentRiskTable() {
  const [students, setStudents] = useState<StudentRisk[]>([]);
  const [isLoadingLSTM, setIsLoadingLSTM] = useState(false);

  useEffect(() => {
    // Initialize LSTM service asynchronously (non-blocking)
    lstmService.loadModel().catch(err => {
      console.warn("LSTM model load failed (non-critical):", err);
    }).then(() => {
      // Train model in background (non-blocking)
      setTimeout(() => {
        lstmService.trainModel().catch(err => {
          console.warn("LSTM training failed (non-critical):", err);
        });
      }, 1000);
    });

    const loadStudentRisks = async () => {
      setIsLoadingLSTM(true);
      const allStudents = dataService.getStudents();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get LSTM predictions for all students (non-blocking, with timeout)
      let predictions = new Map();
      try {
        predictions = await Promise.race([
          lstmService.batchPredict(),
          new Promise<Map<any, any>>((resolve) => setTimeout(() => resolve(new Map()), 2000)) // 2s timeout
        ]);
      } catch (err) {
        console.warn("LSTM batch prediction failed (non-critical):", err);
      }

      const studentRisks: StudentRisk[] = await Promise.all(allStudents.map(async (student) => {
        // Get attendance records for last 30 days
        const records30 = dataService.getAttendanceRecords(student.id, thirtyDaysAgo);
        const records7 = dataService.getAttendanceRecords(student.id, sevenDaysAgo);
        
        // Calculate attendance rates
        const present30 = records30.filter(r => r.status === "verified").length;
        const attendanceRate30 = records30.length > 0 
          ? (present30 / records30.length) * 100 
          : 0;
        
        const present7 = records7.filter(r => r.status === "verified").length;
        const attendanceRate7 = records7.length > 0 
          ? (present7 / records7.length) * 100 
          : 0;

        // Determine trend
        let trend: "up" | "down" | "stable" = "stable";
        if (records30.length > 0 && records7.length > 0) {
          const diff = attendanceRate7 - attendanceRate30;
          if (diff > 10) trend = "up";
          else if (diff < -10) trend = "down";
        }

        // Calculate risk score (inverse of attendance, higher = riskier)
        // 0% attendance = 100 risk, 100% attendance = 0 risk
        const riskScore = Math.max(0, Math.min(100, 100 - attendanceRate30));

        // Get last seen date
        const lastRecord = records30.length > 0 ? records30[0] : null;
        const lastSeenDate = lastRecord?.timestamp || null;
        const lastSeen = lastSeenDate 
          ? formatDistanceToNow(lastSeenDate, { addSuffix: true })
          : "Never";

        // Generate statistical prediction
        let prediction = "";
        if (attendanceRate30 >= 80) {
          prediction = "Low risk - consistent attendance";
        } else if (attendanceRate30 >= 60) {
          prediction = "Moderate risk - occasional absences";
        } else if (attendanceRate30 >= 40) {
          prediction = "High risk - frequent absences detected";
        } else {
          prediction = "Critical risk - very low attendance";
        }
        
        if (records30.length === 0) {
          prediction = "No recent attendance records";
        } else if (trend === "down") {
          prediction += " - Declining pattern";
        }

        // Get LSTM prediction
        const lstmPred = predictions.get(student.id);
        let lstmPrediction = prediction;
        let predictedRiskScore = riskScore;
        let predictedTrend: "improving" | "declining" | "stable" = trend;
        let lstmConfidence = 0;
        const isLSTMPredicted = !!lstmPred;

        if (lstmPred) {
          predictedRiskScore = lstmPred.riskScore;
          predictedTrend = lstmPred.trend;
          lstmConfidence = lstmPred.confidence;

          // Enhanced LSTM-based prediction
          if (lstmPred.futureAttendance >= 80) {
            lstmPrediction = `LSTM: Low risk predicted - ${lstmPred.futureAttendance}% future attendance`;
          } else if (lstmPred.futureAttendance >= 60) {
            lstmPrediction = `LSTM: Moderate risk - ${lstmPred.futureAttendance}% predicted attendance`;
          } else if (lstmPred.futureAttendance >= 40) {
            lstmPrediction = `LSTM: High risk - ${lstmPred.futureAttendance}% predicted attendance`;
          } else {
            lstmPrediction = `LSTM: Critical risk - ${lstmPred.futureAttendance}% predicted attendance`;
          }

          if (lstmPred.trend === "declining") {
            lstmPrediction += " - Declining trend predicted";
          } else if (lstmPred.trend === "improving") {
            lstmPrediction += " - Improving trend predicted";
          }

          lstmPrediction += ` (${lstmConfidence}% confidence)`;
        }

        return {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          attendanceRate: Math.round(attendanceRate30),
          riskScore: Math.round(riskScore),
          predictedRiskScore: Math.round(predictedRiskScore),
          trend,
          predictedTrend,
          prediction,
          lstmPrediction,
          lstmConfidence,
          lastSeen,
          lastSeenDate,
          isLSTMPredicted,
        };
      }));

      // Sort by predicted risk score (LSTM) or current risk score
      studentRisks.sort((a, b) => {
        const scoreA = a.isLSTMPredicted ? a.predictedRiskScore : a.riskScore;
        const scoreB = b.isLSTMPredicted ? b.predictedRiskScore : b.riskScore;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.attendanceRate - b.attendanceRate;
      });

      setStudents(studentRisks);
      setIsLoadingLSTM(false);
    };

    loadStudentRisks();
    const interval = setInterval(loadStudentRisks, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Add error handling wrapper
  useEffect(() => {
    const handleError = (error: Error) => {
      console.error('Error in StudentRiskTable:', error);
      setIsLoadingLSTM(false);
    };
    window.addEventListener('error', handleError as any);
    return () => window.removeEventListener('error', handleError as any);
  }, []);

  return (
    <div className="glass-card border border-border/50">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-warning" />
          <h3 className="font-semibold">Predictive Risk Analytics</h3>
          {isLoadingLSTM && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {students.some(s => s.isLSTMPredicted) && (
            <span className="text-xs text-muted-foreground">LSTM Enhanced</span>
          )}
          <Button variant="ghost" size="sm" className="text-xs">
            Export Report
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {students.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="text-left p-4 font-medium">Student</th>
                <th className="text-left p-4 font-medium">Attendance</th>
                <th className="text-left p-4 font-medium">Risk Score</th>
                <th className="text-left p-4 font-medium">Prediction</th>
                <th className="text-left p-4 font-medium">Last Seen</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-success/30 flex items-center justify-center text-sm font-semibold">
                        {student.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{student.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{student.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Progress 
                        value={student.attendanceRate} 
                        className="h-2 flex-1"
                      />
                      <div className="flex items-center gap-1 text-sm">
                        <span className={
                          student.attendanceRate >= 80 ? "text-success" :
                          student.attendanceRate >= 60 ? "text-warning" : "text-fraud"
                        }>
                          {student.attendanceRate}%
                        </span>
                        {student.trend === "down" && <TrendingDown className="w-3 h-3 text-fraud" />}
                        {student.trend === "up" && <TrendingUp className="w-3 h-3 text-success" />}
                      </div>
                    </div>
                  </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={getRiskStatus(student.isLSTMPredicted ? student.predictedRiskScore : student.riskScore)}>
                      {student.isLSTMPredicted ? student.predictedRiskScore : student.riskScore}%
                      {student.isLSTMPredicted && (
                        <span className="ml-1 text-[10px]">(LSTM)</span>
                      )}
                    </StatusBadge>
                    {student.isLSTMPredicted && student.riskScore !== student.predictedRiskScore && (
                      <span className="text-[10px] text-muted-foreground">
                        Current: {student.riskScore}%
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-1 max-w-[200px]">
                    {student.isLSTMPredicted && (
                      <p className="text-xs font-medium text-primary">
                        {student.lstmPrediction}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {student.prediction}
                    </p>
                  </div>
                </td>
                  <td className="p-4">
                    <span className="text-xs text-muted-foreground">{student.lastSeen}</span>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No students registered</p>
            <p className="text-xs text-muted-foreground mt-1">Register students to see risk analytics</p>
          </div>
        )}
      </div>
    </div>
  );
}
