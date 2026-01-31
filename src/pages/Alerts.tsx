import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { FraudAlerts } from "@/components/dashboard/FraudAlerts";

export default function Alerts() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Fraud Alerts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review and manage fraud detection alerts
            </p>
          </div>

          <FraudAlerts />
        </main>
      </div>
    </div>
  );
}





