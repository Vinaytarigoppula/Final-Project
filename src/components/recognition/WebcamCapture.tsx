import { useEffect, useState, useRef } from "react";
import { Camera, CameraOff, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceDetection, DetectedFace } from "@/hooks/useFaceDetection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { findMatchingStudent, detectSpoofing, detectGroupPattern } from "@/services/faceRecognitionService";
import { multimodalService } from "@/services/multimodalService";
import { dataService } from "@/services/dataService";
import { toast } from "sonner";
import * as faceapi from "@vladmandic/face-api";

interface RecognitionResult {
  id: string;
  timestamp: Date;
  studentName?: string;
  studentId?: string;
  confidence: number;
  similarity: number;
  status: "verified" | "warning" | "fraud";
  message: string;
  isSpoof?: boolean;
  isGroup?: boolean;
}

export function WebcamCapture() {
  const { videoRef: webcamVideoRef, isStreaming, error: webcamError, devices, startWebcam, stopWebcam, switchCamera } = useWebcam();
  const { 
    videoRef: detectionVideoRef, 
    canvasRef, 
    isModelLoaded, 
    isLoading: modelsLoading, 
    error: detectionError, 
    detectedFaces, 
    fps, 
    startDetection, 
    stopDetection 
  } = useFaceDetection({ detectAge: true, detectExpressions: true });

  const [results, setResults] = useState<RecognitionResult[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);
  const lastProcessedRef = useRef<Set<string>>(new Set());
  const expressionHistoryRef = useRef<faceapi.FaceExpressions[]>([]);
  const lastAttendanceMarkedRef = useRef<Map<string, number>>(new Map()); // studentId -> timestamp

  // Sync video refs
  useEffect(() => {
    if (webcamVideoRef.current && detectionVideoRef.current !== webcamVideoRef.current) {
      (detectionVideoRef as any).current = webcamVideoRef.current;
    }
  }, [isStreaming]);

  // Process detected faces for recognition
  useEffect(() => {
    if (!isStreaming || detectedFaces.length === 0) return;

    // Process each face (using async IIFE to handle async operations)
    (async () => {
      for (const face of detectedFaces) {
      // Skip if we recently processed this face (debounce)
      if (lastProcessedRef.current.has(face.id)) return;
      
        // Only process faces with descriptors
        if (!face.descriptor || face.confidence < 0.7) continue;

        // Mark as processed (will be cleared after processing)
        lastProcessedRef.current.add(face.id);

      // Find matching student
      const match = findMatchingStudent(face.descriptor, 0.6);
      
      // Check for spoofing if we have expressions
      let spoofResult = { isSpoof: false, confidence: 0, reasons: [] };
      if (face.expressions) {
        expressionHistoryRef.current.push(face.expressions);
        if (expressionHistoryRef.current.length > 10) {
          expressionHistoryRef.current.shift();
        }
        // Note: We'd need the full detection object for proper spoofing detection
        // For now, we'll do basic checks
        spoofResult = {
          isSpoof: false,
          confidence: 0,
          reasons: [],
        };
      }

      let status: "verified" | "warning" | "fraud" = "fraud";
      let message = "Unknown face - not in database";
      let studentId: string | undefined;
      let studentName: string | undefined;
      let similarity = 0;

      if (match) {
        studentId = match.student.id;
        studentName = match.student.name;
        similarity = match.similarity;

        // Check if attendance already marked recently (within 5 minutes)
        const lastMarked = lastAttendanceMarkedRef.current.get(studentId);
        const now = Date.now();
        if (lastMarked && (now - lastMarked) < 5 * 60 * 1000) {
          // Skip - already marked recently
          lastProcessedRef.current.delete(face.id);
          continue;
        }

        if (match.similarity >= 85) {
          status = "verified";
          message = `${match.student.name} - Verified`;
        } else if (match.similarity >= 70) {
          status = "warning";
          message = `${match.student.name} - Low confidence match`;
        } else {
          status = "fraud";
          message = `${match.student.name} - Face mismatch (possible proxy)`;
        }

        // Check for group patterns (GNN-enhanced)
        const groupCheck = detectGroupPattern(studentId);
        if (groupCheck.suspicious) {
            // Update status if needed
            if (status !== "fraud") {
              status = "fraud";
              message += " - Suspicious group pattern detected";
            }
            
            // Create fraud alert with GNN info
            const xaiExplanation = [
              `Co-attendance correlation: ${(groupCheck.correlation * 100).toFixed(1)}%`,
              `Group size: ${groupCheck.groupMembers.length + 1} students`,
              `Time window: < 5 seconds`,
            ];
            
            if (groupCheck.gnnAnomalyScore) {
              xaiExplanation.push(`GNN anomaly score: ${(groupCheck.gnnAnomalyScore * 100).toFixed(1)}%`);
            }
            
            dataService.addFraudAlert({
              type: "group",
              severity: groupCheck.gnnAnomalyScore && groupCheck.gnnAnomalyScore > 0.8 ? "high" : "medium",
              title: "Unusual Group Pattern (GNN Detected)",
              description: `${match.student.name} marked attendance with ${groupCheck.groupMembers.length} other students`,
              location: "Live Recognition",
              timestamp: new Date(),
              studentId,
              xaiExplanation,
            });
        }

        // Mark attendance
        if (status === "verified" || status === "warning") {
          const attendanceRecord = dataService.markAttendance({
            studentId,
            confidence: face.confidence,
            status,
            reason: status === "warning" ? "Low confidence match" : undefined,
            location: "Live Recognition",
          });
          
          lastAttendanceMarkedRef.current.set(studentId, now);
          
          if (status === "verified") {
            toast.success(`Attendance marked for ${match.student.name}`);
          }
        } else if (status === "fraud") {
          // Create fraud alert for proxy/spoofing
          dataService.addFraudAlert({
            type: match ? "proxy" : "spoofing",
            severity: match ? "high" : "medium",
            title: match ? "Proxy Attendance Detected" : "Potential Spoofing Attempt",
            description: match 
              ? `${match.student.name} - Face embedding distance: ${match.distance.toFixed(2)} (threshold: 0.6)`
              : "Face not recognized in database",
            location: "Live Recognition",
            timestamp: new Date(),
            studentId,
            xaiExplanation: match ? [
              `Face embedding distance: ${match.distance.toFixed(2)} (threshold: 0.6)`,
              `Similarity: ${match.similarity.toFixed(1)}%`,
              `Detection confidence: ${(face.confidence * 100).toFixed(1)}%`,
            ] : [
              "Face not in database",
              `Detection confidence: ${(face.confidence * 100).toFixed(1)}%`,
            ],
          });
          
          toast.error(message);
        }
      }

      // Create result
      const result: RecognitionResult = {
        id: `result-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        studentName,
        studentId,
        confidence: face.confidence * 100,
        similarity,
        status,
        message,
        isSpoof: spoofResult.isSpoof,
      };

      setResults((prev) => [result, ...prev].slice(0, 20));
      setTotalDetections((prev) => prev + 1);

        // Clear processed flag after a delay (debounce)
        setTimeout(() => {
          lastProcessedRef.current.delete(face.id);
        }, 3000);
      }
    })().catch(err => {
      console.error('Error processing faces:', err);
    });
  }, [detectedFaces, isStreaming]);

  const handleStart = async () => {
    try {
      await startWebcam();
      setTimeout(() => {
        startDetection();
      }, 500);
    } catch (err) {
      console.error("Failed to start webcam:", err);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  const handleStop = () => {
    stopDetection();
    stopWebcam();
    lastProcessedRef.current.clear();
    expressionHistoryRef.current = [];
  };

  const error = webcamError || detectionError;
  const currentResult = results[0];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Real-Time Face Recognition</h2>
          {modelsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading AI models...
            </div>
          )}
          {isModelLoaded && !modelsLoading && (
            <StatusBadge status="verified">Models Ready</StatusBadge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {devices.length > 1 && isStreaming && (
            <Button variant="outline" size="sm" onClick={switchCamera}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Switch Camera
            </Button>
          )}
          {!isStreaming ? (
            <Button onClick={handleStart} disabled={!isModelLoaded}>
              <Camera className="w-4 h-4 mr-2" />
              Start Recognition
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleStop}>
              <CameraOff className="w-4 h-4 mr-2" />
              Stop Recognition
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-fraud/10 border border-fraud/30 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-fraud" />
          <p className="text-sm text-fraud">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Feed */}
        <div className="lg:col-span-2">
          <div className="glass-card border border-border/50 overflow-hidden">
            <div className="relative aspect-video bg-secondary/50">
              <video
                ref={webcamVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Click "Start Recognition" to begin
                  </p>
                </div>
              )}

              {/* HUD Overlay */}
              {isStreaming && (
                <>
                  {/* Corner brackets */}
                  <div className="absolute inset-8 border-2 border-primary/30 rounded-xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>

                  {/* Current Recognition Result */}
                  {currentResult && (
                    <div className={cn(
                      "absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border-2 backdrop-blur-sm",
                      currentResult.status === "verified" && "bg-success/20 border-success/50",
                      currentResult.status === "warning" && "bg-warning/20 border-warning/50",
                      currentResult.status === "fraud" && "bg-fraud/20 border-fraud/50"
                    )}>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {currentResult.status === "verified" && <CheckCircle2 className="w-4 h-4 text-success" />}
                        {currentResult.status === "warning" && <AlertTriangle className="w-4 h-4 text-warning" />}
                        {currentResult.status === "fraud" && <XCircle className="w-4 h-4 text-fraud" />}
                        <span>{currentResult.message}</span>
                        {currentResult.similarity > 0 && (
                          <span className="text-xs">
                            ({currentResult.similarity.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="absolute top-4 left-4 flex items-center gap-4 text-xs font-mono">
                    <span className="bg-background/80 px-2 py-1 rounded">FPS: {fps}</span>
                    <span className="bg-background/80 px-2 py-1 rounded">
                      Faces: {detectedFaces.length}
                    </span>
                    <span className={cn(
                      "px-2 py-1 rounded",
                      isStreaming ? "bg-success/80 text-success-foreground" : "bg-background/80"
                    )}>
                      ● LIVE
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 text-xs font-mono text-muted-foreground bg-background/60 px-3 py-2 rounded-lg">
                    Model: TinyFaceDetector | Recognition: Active | Total: {totalDetections}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recognition Results */}
        <div className="space-y-4">
          {/* Current Detection */}
          {isStreaming && detectedFaces.length > 0 && (
            <div className="glass-card border border-border/50 p-4">
              <h3 className="text-sm font-medium mb-4">Current Detection</h3>
              {detectedFaces.slice(0, 1).map((face, i) => (
                <div key={face.id} className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Face #{i + 1}
                    </span>
                    <StatusBadge 
                      status={face.confidence > 0.8 ? "verified" : face.confidence > 0.6 ? "warning" : "fraud"}
                    >
                      {(face.confidence * 100).toFixed(1)}%
                    </StatusBadge>
                  </div>
                  {currentResult && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium mb-1">{currentResult.studentName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {currentResult.studentId || "---"}
                      </p>
                      {currentResult.similarity > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Match: {currentResult.similarity.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recognition Log */}
          <div className="glass-card border border-border/50 p-4 max-h-96 overflow-y-auto">
            <h3 className="text-sm font-medium mb-4">Recognition Log</h3>
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result) => (
                  <div 
                    key={result.id} 
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg text-xs transition-all",
                      result.status === "verified" && "bg-success/10 border border-success/20",
                      result.status === "warning" && "bg-warning/10 border border-warning/20",
                      result.status === "fraud" && "bg-fraud/10 border border-fraud/20"
                    )}
                  >
                    {result.status === "verified" && <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />}
                    {result.status === "warning" && <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />}
                    {result.status === "fraud" && <XCircle className="w-4 h-4 text-fraud shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{result.message}</p>
                      {result.studentName && (
                        <p className="text-muted-foreground font-mono text-[10px]">
                          {result.studentId}
                        </p>
                      )}
                      <p className="text-muted-foreground text-[10px] mt-0.5">
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                {isStreaming ? "Waiting for face recognition..." : "No detections yet"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
