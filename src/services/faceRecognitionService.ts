import * as faceapi from "@vladmandic/face-api";
import { Student, dataService } from "./dataService";
import { gnnService } from "./gnnService";

export interface FaceMatch {
  student: Student;
  distance: number;
  similarity: number; // 0-100%
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
function euclideanDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  if (descriptor1.length !== descriptor2.length) {
    return Infinity;
  }
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Convert distance to similarity percentage (0-100%)
 * Using threshold of 0.6 (common for face-api)
 */
function distanceToSimilarity(distance: number, threshold: number = 0.6): number {
  if (distance <= 0) return 100;
  // Normalize: distance of 0 = 100%, distance >= threshold = 0%
  const similarity = Math.max(0, (1 - distance / threshold) * 100);
  return Math.min(100, similarity);
}

/**
 * Find matching student for a given face descriptor
 */
export function findMatchingStudent(
  faceDescriptor: Float32Array,
  threshold: number = 0.6
): FaceMatch | null {
  const students = dataService.getStudents();
  if (students.length === 0) return null;

  let bestMatch: FaceMatch | null = null;
  let minDistance = Infinity;

  for (const student of students) {
    const distance = euclideanDistance(faceDescriptor, student.faceDescriptor);
    if (distance < minDistance) {
      minDistance = distance;
      const similarity = distanceToSimilarity(distance, threshold);
      bestMatch = {
        student,
        distance,
        similarity,
      };
    }
  }

  // Only return match if it meets threshold
  if (bestMatch && bestMatch.distance <= threshold) {
    return bestMatch;
  }

  return null;
}

/**
 * Extract face descriptor from detected face
 */
export async function extractFaceDescriptor(
  detection: faceapi.WithFaceLandmarks<faceapi.WithFaceDescriptor<faceapi.FaceDetection>, faceapi.FaceLandmarks68>
): Promise<Float32Array> {
  return detection.descriptor;
}

/**
 * Detect if face might be a spoof (basic liveness checks)
 */
export function detectSpoofing(
  detection: faceapi.WithFaceLandmarks<faceapi.WithFaceExpressions<faceapi.WithAgeAndGender<faceapi.FaceDetection>>, faceapi.FaceLandmarks68>,
  previousExpressions?: faceapi.FaceExpressions[]
): {
  isSpoof: boolean;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let spoofScore = 0;

  // Check 1: Face confidence (spoofed faces often have lower detection confidence)
  if (detection.detection.score < 0.7) {
    spoofScore += 0.3;
    reasons.push("Low detection confidence");
  }

  // Check 2: Expression variance (real faces change expressions)
  if (previousExpressions && previousExpressions.length > 0) {
    const latestExpr = detection.expressions;
    const avgVariance = previousExpressions.reduce((sum, prev) => {
      let variance = 0;
      Object.keys(latestExpr).forEach((key) => {
        const diff = Math.abs((latestExpr as any)[key] - (prev as any)[key]);
        variance += diff;
      });
      return sum + variance;
    }, 0) / previousExpressions.length;

    if (avgVariance < 0.05) {
      spoofScore += 0.4;
      reasons.push("Lack of expression variation");
    }
  }

  // Check 3: Age/Gender consistency (realistic values)
  if (detection.age) {
    if (detection.age < 15 || detection.age > 80) {
      spoofScore += 0.2;
      reasons.push("Unrealistic age estimate");
    }
  }

  // Check 4: Landmark quality
  const landmarks = detection.landmarks;
  if (landmarks) {
    const eyeDistance = Math.sqrt(
      Math.pow(landmarks.positions[36].x - landmarks.positions[45].x, 2) +
      Math.pow(landmarks.positions[36].y - landmarks.positions[45].y, 2)
    );
    const faceWidth = detection.detection.box.width;
    const eyeToFaceRatio = eyeDistance / faceWidth;

    // Normal eye-to-face ratio is around 0.2-0.4
    if (eyeToFaceRatio < 0.15 || eyeToFaceRatio > 0.5) {
      spoofScore += 0.1;
      reasons.push("Abnormal facial proportions");
    }
  }

  const isSpoof = spoofScore > 0.5;
  return {
    isSpoof,
    confidence: spoofScore,
    reasons,
  };
}

/**
 * Check for group attendance patterns using GNN-based analysis
 */
export function detectGroupPattern(
  studentId: string,
  timeWindow: number = 30000 // 30 seconds
): {
  suspicious: boolean;
  groupMembers: string[];
  correlation: number;
  gnnAnomalyScore?: number;
} {
  // First check basic correlation (fast)
  const records = dataService.getAttendanceRecords();
  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindow);

  // Get recent attendance records within time window
  const recentRecords = records.filter(
    r => r.timestamp >= windowStart && r.status === "verified"
  );

  // Find students who marked attendance around the same time
  const studentRecord = recentRecords.find(r => r.studentId === studentId);
  if (!studentRecord) {
    return { suspicious: false, groupMembers: [], correlation: 0 };
  }

  const groupMembers = recentRecords
    .filter(r => {
      const timeDiff = Math.abs(r.timestamp.getTime() - studentRecord.timestamp.getTime());
      return r.studentId !== studentId && timeDiff < 5000; // Within 5 seconds
    })
    .map(r => r.studentId);

  // Check historical co-attendance
  const allRecords = dataService.getAttendanceRecords();
  const studentRecords = allRecords.filter(r => r.studentId === studentId);
  let coOccurrences = 0;

  groupMembers.forEach(memberId => {
    const memberRecords = allRecords.filter(r => r.studentId === memberId);
    studentRecords.forEach(sr => {
      const nearby = memberRecords.find(mr => {
        const timeDiff = Math.abs(mr.timestamp.getTime() - sr.timestamp.getTime());
        return timeDiff < 10000; // Within 10 seconds historically
      });
      if (nearby) coOccurrences++;
    });
  });

  const correlation = studentRecords.length > 0 
    ? coOccurrences / studentRecords.length 
    : 0;

  const basicResult = {
    suspicious: correlation > 0.7 && groupMembers.length >= 2,
    groupMembers: Array.from(new Set(groupMembers)),
    correlation,
  };

  // Enhanced with GNN analysis (async, don't wait - run in background)
  gnnService.detectAnomalies(timeWindow).then(gnnAnomalies => {
    const gnnAnomaly = gnnAnomalies.find(a => a.studentId === studentId);
    
    if (gnnAnomaly && gnnAnomaly.anomalyScore > 0.6) {
      // Update result if GNN finds anomaly
      basicResult.suspicious = true;
      basicResult.groupMembers = [...new Set([...basicResult.groupMembers, ...gnnAnomaly.suspiciousConnections])];
      basicResult.correlation = Math.max(basicResult.correlation, gnnAnomaly.anomalyScore);
      (basicResult as any).gnnAnomalyScore = gnnAnomaly.anomalyScore;
    }
  }).catch(err => {
    console.warn('GNN analysis failed, using basic correlation:', err);
  });

  // Return basic result immediately, GNN enhancement happens asynchronously
  return basicResult;
}


