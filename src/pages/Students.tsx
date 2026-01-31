import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { dataService } from "@/services/dataService";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, Edit, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function Students() {
  const [students, setStudents] = useState(dataService.getStudents());

  useEffect(() => {
    const updateStudents = () => {
      setStudents(dataService.getStudents());
    };
    updateStudents();
    const interval = setInterval(updateStudents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = (studentId: string) => {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      dataService.deleteStudent(studentId);
      setStudents(dataService.getStudents());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Students</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage registered students
              </p>
            </div>
            <Link to="/register">
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Register New Student
              </Button>
            </Link>
          </div>

          {students.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students registered</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Register your first student to get started
                </p>
                <Link to="/register">
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register Student
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => {
                const records = dataService.getAttendanceRecords(student.id);
                const attendanceRate = records.length > 0
                  ? (records.filter(r => r.status === "verified").length / records.length) * 100
                  : 0;

                return (
                  <Card key={student.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{student.name}</CardTitle>
                          <CardDescription className="font-mono mt-1">
                            {student.studentId}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(student.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {student.email && (
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm">{student.email}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Attendance Rate</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {attendanceRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Registered</p>
                        <p className="text-sm">
                          {formatDistanceToNow(student.registeredAt, { addSuffix: true })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Records</p>
                        <Badge variant="outline">{records.length}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}





