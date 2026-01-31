import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Brain, Cpu, Network, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lstmService } from "@/services/lstmService";
import { useState } from "react";

export default function Models() {
  const [isTrainingLSTM, setIsTrainingLSTM] = useState(false);

  const handleTrainLSTM = async () => {
    setIsTrainingLSTM(true);
    try {
      await lstmService.trainModel();
      alert("LSTM model trained successfully!");
    } catch (err) {
      alert("Training failed: " + err);
    } finally {
      setIsTrainingLSTM(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Model Configuration</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and configure AI models
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <CardTitle>Face Recognition (CNN)</CardTitle>
                  <StatusBadge status="verified">Active</StatusBadge>
                </div>
                <CardDescription>TinyFaceDetector + FaceRecognitionNet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Model:</span>
                  <span>FaceNet-based CNN</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <StatusBadge status="verified">Loaded</StatusBadge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span>98.7%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-success" />
                  <CardTitle>LSTM Predictor</CardTitle>
                  <StatusBadge status="verified">Active</StatusBadge>
                </div>
                <CardDescription>Time-series attendance prediction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span>2-layer LSTM</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sequence Length:</span>
                  <span>30 days</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span>94.2%</span>
                </div>
                <Button
                  onClick={handleTrainLSTM}
                  disabled={isTrainingLSTM}
                  className="w-full mt-4"
                  size="sm"
                >
                  {isTrainingLSTM ? "Training..." : "Retrain Model"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-warning" />
                  <CardTitle>GNN Anomaly Detector</CardTitle>
                  <StatusBadge status="verified">Active</StatusBadge>
                </div>
                <CardDescription>Graph-based anomaly detection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span>Graph Convolutional Network</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hidden Units:</span>
                  <span>32</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span>96.1%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-chart-4" />
                  <CardTitle>Multimodal Fusion</CardTitle>
                  <StatusBadge status="pending">Available</StatusBadge>
                </div>
                <CardDescription>Face + Audio feature fusion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Modalities:</span>
                  <span>Face + Audio</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fusion Weight:</span>
                  <span>70% / 30%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span>Ready for integration</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}





