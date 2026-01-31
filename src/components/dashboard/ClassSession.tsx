import { Clock, Users, MapPin, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Session {
  id: string;
  name: string;
  room: string;
  time: string;
  present: number;
  total: number;
  status: "active" | "upcoming" | "completed";
}

const sessions: Session[] = [
  { id: "1", name: "CS101 - Intro to Programming", room: "Room 204", time: "09:00 - 10:30", present: 32, total: 35, status: "active" },
  { id: "2", name: "MATH201 - Linear Algebra", room: "Room 108", time: "11:00 - 12:30", present: 0, total: 28, status: "upcoming" },
  { id: "3", name: "PHY102 - Mechanics", room: "Room 301", time: "14:00 - 15:30", present: 0, total: 42, status: "upcoming" },
];

export function ClassSession() {
  return (
    <div className="glass-card border border-border/50">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Today's Sessions</h3>
        </div>
        <span className="text-xs text-muted-foreground">Dec 26, 2025</span>
      </div>

      <div className="divide-y divide-border/50">
        {sessions.map((session) => (
          <div key={session.id} className="p-4 hover:bg-secondary/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-sm">{session.name}</h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {session.room}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {session.time}
                  </span>
                </div>
              </div>
              <StatusBadge 
                status={session.status === "active" ? "verified" : "pending"}
                pulse={session.status === "active"}
              >
                {session.status === "active" ? "Live" : session.status === "upcoming" ? "Upcoming" : "Done"}
              </StatusBadge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Attendance
                </span>
                <span className="font-medium">
                  {session.present}/{session.total}
                  <span className="text-muted-foreground ml-1">
                    ({Math.round((session.present / session.total) * 100)}%)
                  </span>
                </span>
              </div>
              <Progress 
                value={(session.present / session.total) * 100} 
                className="h-1.5"
              />
            </div>

            {session.status === "active" && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-7 text-xs gap-1 flex-1">
                  <Pause className="w-3 h-3" />
                  Pause Scan
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  View Details
                </Button>
              </div>
            )}
            {session.status === "upcoming" && (
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1 mt-3 w-full">
                <Play className="w-3 h-3" />
                Start Session
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
