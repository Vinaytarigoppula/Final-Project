import { ShieldAlert, Eye, Clock, MapPin, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface FraudAlert {
  id: string;
  type: "proxy" | "spoofing" | "anomaly" | "group";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  location: string;
  timestamp: Date;
  xaiExplanation: string[];
}

const severityStyles = {
  high: "fraud",
  medium: "warning",
  low: "pending",
} as const;

export function FraudAlerts() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);

  useEffect(() => {
    const loadAlerts = () => {
      const fraudAlerts = dataService.getFraudAlerts().slice(0, 10); // Get 10 most recent
      setAlerts(fraudAlerts);
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = (alertId: string) => {
    dataService.dismissFraudAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return (
    <div className="glass-card border border-border/50">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-fraud" />
          <h3 className="font-semibold">Fraud Detection Alerts</h3>
          {alerts.length > 0 && (
            <span className="bg-fraud/20 text-fraud text-xs font-bold px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          View All
        </Button>
      </div>

      {alerts.length > 0 ? (
        <div className="divide-y divide-border/50">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    alert.severity === "high" ? "bg-fraud/10" :
                    alert.severity === "medium" ? "bg-warning/10" : "bg-muted/50"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${
                      alert.severity === "high" ? "text-fraud" :
                      alert.severity === "medium" ? "text-warning" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{alert.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                </div>
                <StatusBadge status={severityStyles[alert.severity]}>
                  {alert.severity}
                </StatusBadge>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {alert.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                </span>
              </div>

              {/* XAI Explanation */}
              {alert.xaiExplanation.length > 0 && (
                <div className="bg-secondary/50 rounded-lg p-3 mt-2">
                  <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    XAI Analysis
                  </p>
                  <ul className="space-y-1">
                    {alert.xaiExplanation.map((exp, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary/50" />
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  Review
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-xs h-7 text-muted-foreground"
                  onClick={() => handleDismiss(alert.id)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No fraud alerts detected</p>
          <p className="text-xs text-muted-foreground mt-1">All clear!</p>
        </div>
      )}
    </div>
  );
}
