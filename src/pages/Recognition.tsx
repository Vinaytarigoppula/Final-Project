import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { WebcamCapture } from "@/components/recognition/WebcamCapture";
import { Brain, Cpu, Zap, Shield } from "lucide-react";

const Recognition = () => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Live Recognition</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Real-time face detection powered by TensorFlow.js
              </p>
            </div>
          </div>

          {/* Model Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card border border-border/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">TinyFaceDetector</p>
                <p className="text-xs text-muted-foreground">Lightweight CNN model</p>
              </div>
            </div>
            <div className="glass-card border border-border/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Cpu className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium">Browser Processing</p>
                <p className="text-xs text-muted-foreground">100% local, no cloud</p>
              </div>
            </div>
            <div className="glass-card border border-border/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium">Real-time Analysis</p>
                <p className="text-xs text-muted-foreground">Age, gender & expressions</p>
              </div>
            </div>
            <div className="glass-card border border-border/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <Shield className="w-5 h-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm font-medium">GDPR Compliant</p>
                <p className="text-xs text-muted-foreground">Data stays on device</p>
              </div>
            </div>
          </div>

          {/* Webcam Component */}
          <WebcamCapture />
        </main>
      </div>
    </div>
  );
};

export default Recognition;
