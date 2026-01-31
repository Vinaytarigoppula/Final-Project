import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceDetection, DetectedFace } from "@/hooks/useFaceDetection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Camera, CheckCircle2, AlertTriangle, UserPlus, Loader2 } from "lucide-react";
import { dataService } from "@/services/dataService";
import { toast } from "sonner";
import * as faceapi from "@vladmandic/face-api";

export default function Register() {
  const { videoRef: webcamVideoRef, isStreaming, error: webcamError, startWebcam, stopWebcam } = useWebcam();
  const { 
    videoRef: detectionVideoRef, 
    canvasRef, 
    isModelLoaded, 
    isLoading: modelsLoading, 
    error: detectionError, 
    detectedFaces, 
    startDetection, 
    stopDetection 
  } = useFaceDetection({ detectAge: true, detectExpressions: true });

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [capturedFace, setCapturedFace] = useState<DetectedFace | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);

  // Sync video refs
  useEffect(() => {
    if (webcamVideoRef.current && detectionVideoRef.current !== webcamVideoRef.current) {
      (detectionVideoRef as any).current = webcamVideoRef.current;
    }
  }, [webcamVideoRef.current]);

  // Check for single, good quality face
  useEffect(() => {
    if (detectedFaces.length === 1 && detectedFaces[0].confidence > 0.8 && detectedFaces[0].descriptor) {
      setCapturedFace(detectedFaces[0]);
    } else {
      setCapturedFace(null);
    }
  }, [detectedFaces]);

  // Load student count
  useEffect(() => {
    const students = dataService.getStudents();
    setRegistrationCount(students.length);
  }, []);

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
    setCapturedFace(null);
  };

  const handleRegister = async () => {
    if (!capturedFace || !capturedFace.descriptor) {
      toast.error("Please ensure a clear face is detected before registering");
      return;
    }

    if (!name.trim() || !studentId.trim()) {
      toast.error("Please fill in name and student ID");
      return;
    }

    // Check if student ID already exists
    const existingStudents = dataService.getStudents();
    if (existingStudents.some(s => s.studentId === studentId.trim())) {
      toast.error("Student ID already exists");
      return;
    }

    setIsRegistering(true);
    try {
      // Capture photo
      const canvas = document.createElement("canvas");
      if (webcamVideoRef.current) {
        canvas.width = webcamVideoRef.current.videoWidth;
        canvas.height = webcamVideoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(webcamVideoRef.current, 0, 0);
          const photo = canvas.toDataURL("image/jpeg", 0.8);
          
          // Save student
          const student = dataService.saveStudent({
            name: name.trim(),
            studentId: studentId.trim(),
            email: email.trim() || undefined,
            faceDescriptor: capturedFace.descriptor,
            photo,
          });

          toast.success(`Student ${student.name} registered successfully!`);
          
          // Reset form
          setName("");
          setStudentId("");
          setEmail("");
          setRegistrationCount(dataService.getStudents().length);
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register student");
    } finally {
      setIsRegistering(false);
    }
  };

  const error = webcamError || detectionError;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Student Registration</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Register new students with face recognition
              </p>
            </div>
            <StatusBadge status="verified">
              {registrationCount} Students Registered
            </StatusBadge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registration Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Student Information
                </CardTitle>
                <CardDescription>
                  Enter student details and capture their face
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID *</Label>
                  <Input
                    id="studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="STU-2024-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleRegister}
                    disabled={!capturedFace || isRegistering || !name.trim() || !studentId.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Register Student
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Face Capture */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Face Capture
                </CardTitle>
                <CardDescription>
                  Position face in the frame and ensure good lighting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="bg-fraud/10 border border-fraud/30 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-fraud" />
                    <p className="text-sm text-fraud">{error}</p>
                  </div>
                )}

                {modelsLoading && (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading AI models...</span>
                  </div>
                )}

                <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden">
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
                      <p className="text-muted-foreground text-sm text-center px-4">
                        Click "Start Camera" to begin face capture
                      </p>
                    </div>
                  )}

                  {/* Detection overlay */}
                  {isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-primary/50 rounded-xl p-8 m-8">
                        {capturedFace ? (
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 className="w-12 h-12 text-success animate-pulse" />
                            <p className="text-success font-medium">Face Detected</p>
                            <p className="text-xs text-muted-foreground">
                              {(capturedFace.confidence * 100).toFixed(1)}% confidence
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <AlertTriangle className="w-12 h-12 text-warning animate-pulse" />
                            <p className="text-warning font-medium">
                              {detectedFaces.length === 0 
                                ? "No face detected"
                                : detectedFaces.length > 1
                                ? "Multiple faces detected"
                                : "Low confidence - move closer"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status indicators */}
                  {isStreaming && (
                    <div className="absolute top-4 left-4 flex gap-2">
                      <StatusBadge status={isStreaming ? "verified" : "pending"}>
                        {isStreaming ? "LIVE" : "OFF"}
                      </StatusBadge>
                      {capturedFace && (
                        <StatusBadge status="verified">
                          READY
                        </StatusBadge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isStreaming ? (
                    <Button
                      onClick={handleStart}
                      disabled={!isModelLoaded}
                      className="flex-1"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      variant="destructive"
                      className="flex-1"
                    >
                      Stop Camera
                    </Button>
                  )}
                </div>

                {capturedFace && (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm">
                    <p className="text-success font-medium mb-1">✓ Face captured successfully</p>
                    <p className="text-muted-foreground text-xs">
                      Confidence: {(capturedFace.confidence * 100).toFixed(1)}% • 
                      {capturedFace.age && ` Age: ~${Math.round(capturedFace.age)} •`}
                      {capturedFace.gender && ` ${capturedFace.gender}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}






