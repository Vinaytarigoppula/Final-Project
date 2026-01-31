import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";

export default function Classes() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Classes</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage class sessions and schedules
              </p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Class
            </Button>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No classes configured</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Class management coming soon
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}





