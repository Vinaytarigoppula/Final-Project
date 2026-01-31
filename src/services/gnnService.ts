/**
 * Graph Neural Network Service for Anomaly Detection
 * Models attendance network as graph (students as nodes, co-attendance as edges)
 * Detects anomalous patterns using graph-based analysis
 */

import * as tf from '@tensorflow/tfjs';
import { dataService } from './dataService';

interface GraphNode {
  id: string; // student ID
  features: number[]; // Node features (attendance rate, variance, etc.)
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number; // Co-attendance correlation
}

interface GraphStructure {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacencyMatrix: number[][];
}

interface GNNAnomalyResult {
  studentId: string;
  anomalyScore: number; // 0-1, higher = more anomalous
  reason: string;
  suspiciousConnections: string[]; // Connected students with high correlation
}

class GNNAnomalyDetector {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private nodeFeatureSize = 8; // Features per node
  private hiddenSize = 32;

  /**
   * Build Graph Convolutional Network model
   */
  private buildModel(numNodes: number): tf.LayersModel {
    // Simplified GCN-like architecture using dense layers with adjacency awareness
    const model = tf.sequential({
      layers: [
        // Input: node features
        tf.layers.dense({
          units: this.hiddenSize,
          inputShape: [this.nodeFeatureSize],
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        // Graph convolution approximation (dense layer simulates neighbor aggregation)
        tf.layers.dense({
          units: this.hiddenSize,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        // Output: anomaly score
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Build graph structure from attendance data
   */
  buildGraph(timeWindow: number = 30 * 24 * 60 * 60 * 1000): GraphStructure {
    const students = dataService.getStudents();
    const now = new Date();
    const startDate = new Date(now.getTime() - timeWindow);
    
    const records = dataService.getAttendanceRecords(undefined, startDate);
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const adjacencyMatrix: number[][] = [];

    // Create nodes with features
    for (const student of students) {
      const studentRecords = records.filter(r => r.studentId === student.id);
      const present = studentRecords.filter(r => r.status === 'verified').length;
      const attendanceRate = studentRecords.length > 0 ? present / studentRecords.length : 0;
      
      // Calculate attendance variance
      const dailyAttendance: number[] = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayRecords = studentRecords.filter(r => 
          r.timestamp >= date && r.timestamp < nextDay
        );
        dailyAttendance.push(dayRecords.some(r => r.status === 'verified') ? 1 : 0);
      }
      const variance = this.calculateVariance(dailyAttendance);

      // Calculate recent trend
      const recent7 = dailyAttendance.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
      const older7 = dailyAttendance.slice(7, 14).reduce((a, b) => a + b, 0) / 7;
      const trend = recent7 - older7;

      // Node features: [attendance_rate, variance, trend, avg_confidence, fraud_count, recent_count, week_avg, month_avg]
      const features = [
        attendanceRate,
        variance,
        trend,
        studentRecords.length > 0 ? studentRecords.reduce((sum, r) => sum + r.confidence, 0) / studentRecords.length / 100 : 0,
        studentRecords.filter(r => r.status === 'fraud').length / Math.max(1, studentRecords.length),
        recent7,
        dailyAttendance.slice(0, 7).reduce((a, b) => a + b, 0) / 7,
        attendanceRate,
      ];

      nodes.push({
        id: student.id,
        features,
      });
    }

    // Create edges based on co-attendance correlation
    const studentIds = students.map(s => s.id);
    for (let i = 0; i < studentIds.length; i++) {
      adjacencyMatrix[i] = new Array(studentIds.length).fill(0);
    }

    for (let i = 0; i < studentIds.length; i++) {
      for (let j = i + 1; j < studentIds.length; j++) {
        const student1 = studentIds[i];
        const student2 = studentIds[j];
        
        const correlation = this.calculateCoAttendanceCorrelation(
          student1,
          student2,
          records,
          timeWindow
        );

        if (correlation > 0.5) { // Threshold for edge creation
          edges.push({
            source: student1,
            target: student2,
            weight: correlation,
          });
          adjacencyMatrix[i][j] = correlation;
          adjacencyMatrix[j][i] = correlation;
        }
      }
    }

    return { nodes, edges, adjacencyMatrix };
  }

  /**
   * Calculate co-attendance correlation between two students
   */
  private calculateCoAttendanceCorrelation(
    studentId1: string,
    studentId2: string,
    records: any[],
    timeWindow: number
  ): number {
    const student1Records = records.filter(r => r.studentId === studentId1 && r.status === 'verified');
    const student2Records = records.filter(r => r.studentId === studentId2 && r.status === 'verified');

    if (student1Records.length === 0 || student2Records.length === 0) return 0;

    // Count simultaneous attendance (within 5 minutes)
    let coOccurrences = 0;
    let total1 = 0;

    for (const record1 of student1Records) {
      total1++;
      const nearby = student2Records.find(r2 => {
        const timeDiff = Math.abs(r2.timestamp.getTime() - record1.timestamp.getTime());
        return timeDiff < 5 * 60 * 1000; // 5 minutes
      });
      if (nearby) coOccurrences++;
    }

    // Correlation = co-occurrences / total attendance
    return total1 > 0 ? coOccurrences / total1 : 0;
  }

  /**
   * Detect anomalies using graph-based analysis
   */
  async detectAnomalies(timeWindow?: number): Promise<GNNAnomalyResult[]> {
    try {
      const graph = this.buildGraph(timeWindow);
      if (graph.nodes.length === 0) return [];

      // Prepare node features
      const nodeFeatures = graph.nodes.map(node => node.features);
      
      // Apply graph convolution (simplified - aggregating neighbor features)
      const aggregatedFeatures = this.aggregateNeighborFeatures(graph, nodeFeatures);
      
      // Calculate anomaly scores
      const anomalies: GNNAnomalyResult[] = [];

      for (let i = 0; i < graph.nodes.length; i++) {
        const node = graph.nodes[i];
        const features = aggregatedFeatures[i];
        
        // Anomaly detection based on:
        // 1. Low attendance with high neighbor connectivity (proxy indicator)
        // 2. High variance in attendance pattern
        // 3. Strong correlation with many other students (group fraud)
        
        const attendanceRate = features[0];
        const variance = features[1];
        const neighborCount = graph.edges.filter(e => 
          e.source === node.id || e.target === node.id
        ).length;
        
        // Calculate anomaly score
        let anomalyScore = 0;
        let reasons: string[] = [];

        // High connectivity + low attendance = suspicious
        if (neighborCount > graph.nodes.length * 0.3 && attendanceRate < 0.5) {
          anomalyScore += 0.4;
          reasons.push('High connectivity with low attendance');
        }

        // High variance = irregular pattern
        if (variance > 0.3) {
          anomalyScore += 0.3;
          reasons.push('Irregular attendance pattern');
        }

        // Strong correlation with multiple students = group fraud
        const strongConnections = graph.edges.filter(e => 
          (e.source === node.id || e.target === node.id) && e.weight > 0.7
        ).length;
        if (strongConnections >= 3) {
          anomalyScore += 0.3;
          reasons.push('Strong correlation with multiple students');
        }

        anomalyScore = Math.min(1, anomalyScore);

        if (anomalyScore > 0.5) {
          const suspiciousConnections = graph.edges
            .filter(e => (e.source === node.id || e.target === node.id) && e.weight > 0.7)
            .map(e => e.source === node.id ? e.target : e.source);

          anomalies.push({
            studentId: node.id,
            anomalyScore,
            reason: reasons.join('; '),
            suspiciousConnections,
          });
        }
      }

      // Sort by anomaly score (highest first)
      return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
    } catch (err) {
      console.error('GNN anomaly detection error:', err);
      return [];
    }
  }

  /**
   * Aggregate neighbor features (Graph Convolution approximation)
   */
  private aggregateNeighborFeatures(
    graph: GraphStructure,
    nodeFeatures: number[][]
  ): number[][] {
    const aggregated: number[][] = [];

    for (let i = 0; i < graph.nodes.length; i++) {
      const nodeId = graph.nodes[i].id;
      const features = [...nodeFeatures[i]];

      // Get neighbor indices
      const neighborIndices: number[] = [];
      for (let j = 0; j < graph.nodes.length; j++) {
        if (graph.adjacencyMatrix[i][j] > 0) {
          neighborIndices.push(j);
        }
      }

      // Average neighbor features (simplified graph convolution)
      if (neighborIndices.length > 0) {
        const neighborFeatures = neighborIndices.map(idx => nodeFeatures[idx]);
        const avgNeighborFeatures = new Array(this.nodeFeatureSize).fill(0);
        
        neighborFeatures.forEach(neighbor => {
          for (let k = 0; k < this.nodeFeatureSize; k++) {
            avgNeighborFeatures[k] += neighbor[k];
          }
        });

        for (let k = 0; k < this.nodeFeatureSize; k++) {
          avgNeighborFeatures[k] /= neighborIndices.length;
        }

        // Combine self features with neighbor features
        for (let k = 0; k < this.nodeFeatureSize; k++) {
          features[k] = 0.7 * features[k] + 0.3 * avgNeighborFeatures[k];
        }
      }

      aggregated.push(features);
    }

    return aggregated;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
}

export const gnnService = new GNNAnomalyDetector();

