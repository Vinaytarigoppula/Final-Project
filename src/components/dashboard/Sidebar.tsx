import { 
  LayoutDashboard, 
  Users, 
  Camera, 
  ShieldAlert, 
  BarChart3, 
  Settings,
  BookOpen,
  Network,
  Brain,
  UserPlus
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const baseNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Camera, label: "Live Recognition", path: "/recognition" },
  { icon: UserPlus, label: "Register Student", path: "/register" },
  { icon: Users, label: "Students", path: "/students" },
  { icon: ShieldAlert, label: "Fraud Alerts", path: "/alerts" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Network, label: "GNN Insights", path: "/gnn" },
  { icon: BookOpen, label: "Classes", path: "/classes" },
];

const bottomItems: NavItem[] = [
  { icon: Brain, label: "Model Config", path: "/models" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const [studentCount, setStudentCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);

  useEffect(() => {
    const updateCounts = () => {
      const students = dataService.getStudents();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fraudAlerts = dataService.getFraudAlerts().filter(a => a.timestamp >= weekAgo);
      setStudentCount(students.length);
      setFraudCount(fraudAlerts.length);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = baseNavItems.map(item => {
    if (item.label === "Students") {
      return { ...item, badge: studentCount };
    }
    if (item.label === "Fraud Alerts") {
      return { ...item, badge: fraudCount };
    }
    return item;
  });

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 glass-card border-r border-border/50 flex flex-col z-40">
      <div className="p-4 border-b border-border/50">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-success flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight">SmartAttend</h1>
            <p className="text-xs text-muted-foreground">AI Attendance System</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-10 px-3",
                isActive && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              asChild
            >
              <Link to={item.path}>
                <item.icon className="w-4 h-4" />
                <span className="flex-1 text-left text-sm">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    item.label === "Fraud Alerts" 
                      ? "bg-fraud/20 text-fraud"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50 space-y-1">
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-10 px-3",
                isActive && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              asChild
            >
              <Link to={item.path}>
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="p-4 m-3 rounded-xl bg-gradient-to-br from-primary/10 to-success/10 border border-primary/20">
        <p className="text-xs font-medium mb-1">System Status</p>
        <p className="text-[10px] text-muted-foreground mb-3">All models running optimally</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">FaceNet CNN</span>
            <span className="text-success font-medium">98.7%</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">LSTM Predictor</span>
            <span className="text-success font-medium">94.2%</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">GNN Anomaly</span>
            <span className="text-success font-medium">96.1%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
