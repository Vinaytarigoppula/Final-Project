import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { gnnService } from "@/services/gnnService";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Network, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GNNAnomaly {
  studentId: string;
  anomalyScore: number;
  reason: string;
  suspiciousConnections: string[];
}

export default function GNNInsights() {
  const [anomalies, setAnomalies] = useState<GNNAnomaly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [graphStats, setGraphStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    avgDegree: 0,
  });

  const analyzeGraph = async () => {
    setIsLoading(true);
    try {
      const graph = gnnService.buildGraph();
      // Add timeout to prevent blocking
      const detectedAnomalies = await Promise.race([
        gnnService.detectAnomalies(),
        new Promise<GNNAnomaly[]>((resolve) => setTimeout(() => resolve([]), 3000)) // 3s timeout
      ]);
      
      setAnomalies(detectedAnomalies);
      setGraphStats({
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        avgDegree: graph.nodes.length > 0
          ? (graph.edges.length * 2) / graph.nodes.length
          : 0,
      });
    } catch (err) {
      console.error("GNN analysis error:", err);
      setAnomalies([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Delay initial analysis to allow page to render first
    const timeout = setTimeout(() => {
      analyzeGraph();
    }, 500);
    
    const interval = setInterval(analyzeGraph, 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const students = dataService.getStudents();
  const studentMap = new Map(students.map(s => [s.id, s]));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">GNN Insights</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Graph Neural Network analysis of attendance patterns
              </p>
            </div>
            <Button onClick={analyzeGraph} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Refresh Analysis"
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Graph Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{graphStats.totalNodes}</p>
                <p className="text-xs text-muted-foreground mt-1">Students in network</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Graph Edges</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{graphStats.totalEdges}</p>
                <p className="text-xs text-muted-foreground mt-1">Co-attendance connections</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Degree</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{graphStats.avgDegree.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Connections per student</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                <CardTitle>Detected Anomalies</CardTitle>
                <StatusBadge status={anomalies.length > 0 ? "fraud" : "verified"}>
                  {anomalies.length} detected
                </StatusBadge>
              </div>
              <CardDescription>
                Graph-based anomaly detection results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-8">
                  <Network className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No anomalies detected</p>
                  <p className="text-xs text-muted-foreground mt-1">All attendance patterns appear normal</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalies.map((anomaly) => {
                    const student = studentMap.get(anomaly.studentId);
                    return (
                      <div
                        key={anomaly.studentId}
                        className="p-4 border border-border/50 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">{student?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              {student?.studentId || anomaly.studentId}
                            </p>
                          </div>
                          <StatusBadge status={anomaly.anomalyScore > 0.8 ? "fraud" : "warning"}>
                            {(anomaly.anomalyScore * 100).toFixed(1)}% anomaly
                          </StatusBadge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          <p className="text-sm text-muted-foreground">{anomaly.reason}</p>
                        </div>
                        {anomaly.suspiciousConnections.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2">
                              Suspicious connections ({anomaly.suspiciousConnections.length}):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {anomaly.suspiciousConnections.slice(0, 5).map((connId) => {
                                const connStudent = studentMap.get(connId);
                                return (
                                  <Badge key={connId} variant="outline" className="text-xs">
                                    {connStudent?.name || connId}
                                  </Badge>
                                );
                              })}
                              {anomaly.suspiciousConnections.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{anomaly.suspiciousConnections.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

