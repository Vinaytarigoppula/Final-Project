export interface Student {
  id: string;
  name: string;
  studentId: string;
  email?: string;
  faceDescriptor: Float32Array; // Face embedding vector
  registeredAt: Date;
  photo?: string; // Base64 photo for reference
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  timestamp: Date;
  confidence: number;
  status: "verified" | "warning" | "fraud";
  reason?: string;
  location?: string;
}

export interface FraudAlert {
  id: string;
  type: "proxy" | "spoofing" | "anomaly" | "group";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  location: string;
  timestamp: Date;
  studentId?: string;
  xaiExplanation: string[];
}

class DataService {
  private readonly STUDENTS_KEY = "smartscan_students";
  private readonly ATTENDANCE_KEY = "smartscan_attendance";
  private readonly FRAUD_ALERTS_KEY = "smartscan_fraud_alerts";

  // Student Management
  getStudents(): Student[] {
    try {
      const data = localStorage.getItem(this.STUDENTS_KEY);
      if (!data) return [];
      const students = JSON.parse(data);
      // Convert face descriptor back to Float32Array
      return students.map((s: any) => ({
        ...s,
        faceDescriptor: new Float32Array(s.faceDescriptor),
        registeredAt: new Date(s.registeredAt),
      }));
    } catch (error) {
      console.error("Error loading students:", error);
      return [];
    }
  }

  saveStudent(student: Omit<Student, "id" | "registeredAt">): Student {
    const students = this.getStudents();
    const newStudent: Student = {
      ...student,
      id: `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      registeredAt: new Date(),
    };
    
    students.push(newStudent);
    // Convert Float32Array to array for storage
    const studentsToSave = students.map(s => ({
      ...s,
      faceDescriptor: Array.from(s.faceDescriptor),
    }));
    localStorage.setItem(this.STUDENTS_KEY, JSON.stringify(studentsToSave));
    return newStudent;
  }

  deleteStudent(studentId: string): boolean {
    const students = this.getStudents();
    const filtered = students.filter(s => s.id !== studentId);
    const studentsToSave = filtered.map(s => ({
      ...s,
      faceDescriptor: Array.from(s.faceDescriptor),
    }));
    localStorage.setItem(this.STUDENTS_KEY, JSON.stringify(studentsToSave));
    return filtered.length < students.length;
  }

  getStudent(studentId: string): Student | undefined {
    return this.getStudents().find(s => s.id === studentId);
  }

  // Attendance Management
  getAttendanceRecords(studentId?: string, startDate?: Date, endDate?: Date): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(this.ATTENDANCE_KEY);
      if (!data) return [];
      let records: AttendanceRecord[] = JSON.parse(data).map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }));
      
      if (studentId) {
        records = records.filter(r => r.studentId === studentId);
      }
      if (startDate) {
        records = records.filter(r => r.timestamp >= startDate);
      }
      if (endDate) {
        records = records.filter(r => r.timestamp <= endDate);
      }
      
      return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error("Error loading attendance:", error);
      return [];
    }
  }

  markAttendance(record: Omit<AttendanceRecord, "id" | "timestamp">): AttendanceRecord {
    const records = this.getAttendanceRecords();
    const newRecord: AttendanceRecord = {
      ...record,
      id: `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    records.push(newRecord);
    localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(records));
    return newRecord;
  }

  // Fraud Alerts
  getFraudAlerts(): FraudAlert[] {
    try {
      const data = localStorage.getItem(this.FRAUD_ALERTS_KEY);
      if (!data) return [];
      return JSON.parse(data).map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    } catch (error) {
      console.error("Error loading fraud alerts:", error);
      return [];
    }
  }

  addFraudAlert(alert: Omit<FraudAlert, "id">): FraudAlert {
    const alerts = this.getFraudAlerts();
    const newAlert: FraudAlert = {
      ...alert,
      id: `fraud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    alerts.unshift(newAlert); // Add to beginning
    // Keep only last 100 alerts
    const limited = alerts.slice(0, 100);
    localStorage.setItem(this.FRAUD_ALERTS_KEY, JSON.stringify(limited));
    return newAlert;
  }

  dismissFraudAlert(alertId: string): boolean {
    const alerts = this.getFraudAlerts();
    const filtered = alerts.filter(a => a.id !== alertId);
    localStorage.setItem(this.FRAUD_ALERTS_KEY, JSON.stringify(filtered));
    return filtered.length < alerts.length;
  }

  // Statistics
  getAttendanceStats(studentId?: string, days: number = 30): {
    total: number;
    present: number;
    rate: number;
    todayCount: number;
    studentsAtRisk: number;
  } {
    const records = this.getAttendanceRecords(studentId);
    const students = this.getStudents();
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const recentRecords = records.filter(r => r.timestamp >= startDate);
    const presentRecords = recentRecords.filter(r => r.status === "verified");
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayCount = records.filter(r => 
      r.timestamp >= todayStart && r.status === "verified"
    ).length;
    
    // Calculate students at risk (attendance < 60% in last 30 days)
    const studentsAtRisk = students.filter(student => {
      const studentRecords = this.getAttendanceRecords(student.id, startDate);
      const studentPresent = studentRecords.filter(r => r.status === "verified").length;
      const studentRate = studentRecords.length > 0 ? (studentPresent / studentRecords.length) * 100 : 0;
      return studentRate < 60 && studentRecords.length > 0;
    }).length;
    
    return {
      total: recentRecords.length,
      present: presentRecords.length,
      rate: recentRecords.length > 0 ? (presentRecords.length / recentRecords.length) * 100 : 0,
      todayCount,
      studentsAtRisk,
    };
  }

  // Clear all data (for testing/reset)
  clearAllData(): void {
    localStorage.removeItem(this.STUDENTS_KEY);
    localStorage.removeItem(this.ATTENDANCE_KEY);
    localStorage.removeItem(this.FRAUD_ALERTS_KEY);
  }
}

export const dataService = new DataService();






