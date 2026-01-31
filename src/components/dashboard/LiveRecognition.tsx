import { useState, useEffect } from "react";
import { Camera, Scan, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { dataService } from "@/services/dataService";

interface RecognitionResult {
  id: string;
  name: string;
  studentId: string;
  confidence: number;
  status: "verified" | "warning" | "fraud";
  timestamp: Date;
  reason?: string;
}

export function LiveRecognition() {
  const [results, setResults] = useState<RecognitionResult[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    // Load recent attendance records
    const loadRecentRecords = () => {
      const records = dataService.getAttendanceRecords(undefined, undefined, undefined)
        .slice(0, 10); // Get 10 most recent

      const students = dataService.getStudents();
      const studentMap = new Map(students.map(s => [s.id, s]));

      const recognitionResults: RecognitionResult[] = records.map(record => {
        const student = studentMap.get(record.studentId);
        return {
          id: record.id,
          name: student?.name || "Unknown",
          studentId: student?.studentId || record.studentId,
          confidence: record.confidence,
          status: record.status,
          timestamp: record.timestamp,
          reason: record.reason,
        };
      });

      setResults(recognitionResults);
    };

    loadRecentRecords();
    
    // Update every 5 seconds
    const interval = setInterval(loadRecentRecords, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const currentResult = results[0];

  return (
    <div className="glass-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Live Recognition</h3>
        </div>
        <StatusBadge status={isScanning ? "verified" : "pending"} pulse={isScanning}>
          {isScanning ? "Active" : "Paused"}
        </StatusBadge>
      </div>

      <div className="relative aspect-video bg-gradient-to-br from-secondary to-background flex items-center justify-center overflow-hidden">
        {/* Scan overlay */}
        <div className="absolute inset-0 border-2 border-primary/30 m-8 rounded-xl">
          {isScanning && (
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent scan-line" />
          )}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
        </div>

        {/* Center icon */}
        <div className={cn(
          "relative z-10 flex flex-col items-center gap-3 transition-all duration-300",
          isScanning && "float"
        )}>
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
            currentResult?.status === "verified" && "bg-success/20 glow-success",
            currentResult?.status === "warning" && "bg-warning/20 glow-warning",
            currentResult?.status === "fraud" && "bg-fraud/20 glow-fraud",
            !currentResult && "bg-primary/20 glow-primary"
          )}>
            {currentResult?.status === "verified" && <CheckCircle2 className="w-10 h-10 text-success" />}
            {currentResult?.status === "warning" && <AlertTriangle className="w-10 h-10 text-warning" />}
            {currentResult?.status === "fraud" && <ShieldAlert className="w-10 h-10 text-fraud" />}
            {!currentResult && <Scan className="w-10 h-10 text-primary animate-pulse" />}
          </div>
          {currentResult && (
            <div className="text-center animate-fade-in">
              <p className="font-semibold">{currentResult.name}</p>
              <p className="text-sm text-muted-foreground font-mono">{currentResult.studentId}</p>
              <p className={cn(
                "text-xs mt-1 font-medium",
                currentResult.status === "verified" && "text-success",
                currentResult.status === "warning" && "text-warning",
                currentResult.status === "fraud" && "text-fraud"
              )}>
                {currentResult.confidence.toFixed(1)}% confidence
              </p>
            </div>
          )}
        </div>

        {/* Stats overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-muted-foreground font-mono">
          <span>Recent: {results.length}</span>
          <span>Model: FaceNet v3.2</span>
          <span>Live</span>
        </div>
      </div>

      {/* Recent detections */}
      <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
        <p className="text-xs text-muted-foreground font-medium mb-3">Recent Detections</p>
        {results.length > 0 ? (
          results.map((result, i) => (
            <div
              key={`${result.id}-${i}`}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-all duration-300",
                i === 0 ? "bg-secondary/50 animate-slide-in-right" : "bg-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                  result.status === "verified" && "bg-success/20 text-success",
                  result.status === "warning" && "bg-warning/20 text-warning",
                  result.status === "fraud" && "bg-fraud/20 text-fraud"
                )}>
                  {result.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">{result.name}</p>
                  <p className="text-xs text-muted-foreground">{result.reason || "Match confirmed"}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={result.status}>
                  {result.status === "verified" ? "OK" : result.status === "warning" ? "Low" : "Alert"}
                </StatusBadge>
                <span className="text-[10px] text-muted-foreground">
                  {result.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-muted-foreground py-4">No recent detections</p>
        )}
      </div>
    </div>
  );
}
