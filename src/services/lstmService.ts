/**
 * LSTM Service for Predictive Attendance Analytics
 * Implements time-series LSTM model for forecasting student attendance behavior
 */

import * as tf from '@tensorflow/tfjs';
import { dataService } from './dataService';

interface LSTMPrediction {
  futureAttendance: number; // Predicted attendance rate
  riskScore: number; // 0-100, predicted risk level
  trend: 'improving' | 'declining' | 'stable';
  confidence: number; // Model confidence in prediction
}

class LSTMPredictor {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private sequenceLength = 30; // 30-day history for prediction
  private modelKey = 'lstm_attendance_model';

  /**
   * Build and compile LSTM model for attendance prediction
   */
  private buildModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [this.sequenceLength, 1],
          activation: 'tanh',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Second LSTM layer
        tf.layers.lstm({
          units: 32,
          returnSequences: false,
          activation: 'tanh',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Dense layers
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }), // Output: attendance probability
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Prepare time-series data from attendance records
   */
  private prepareSequence(studentId: string, days: number = this.sequenceLength): number[] | null {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const records = dataService.getAttendanceRecords(studentId, startDate);
    if (records.length === 0) return null;

    // Create daily attendance sequence
    const sequence: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayRecords = records.filter(r => 
        r.timestamp >= date && r.timestamp < nextDay
      );
      
      // 1 if present, 0 if absent
      const wasPresent = dayRecords.some(r => r.status === 'verified') ? 1 : 0;
      sequence.push(wasPresent);
    }

    // Pad sequence if needed
    while (sequence.length < this.sequenceLength) {
      sequence.unshift(0);
    }

    return sequence.slice(-this.sequenceLength);
  }

  /**
   * Normalize sequence data
   */
  private normalizeSequence(sequence: number[]): number[] {
    // Simple min-max normalization (0-1 range)
    return sequence.map(val => val); // Already 0-1, but can add moving average
  }

  /**
   * Train model on all student data (online learning)
   */
  async trainModel(): Promise<void> {
    try {
      const students = dataService.getStudents();
      if (students.length === 0) {
        console.log('No students available for LSTM training');
        return;
      }

      if (!this.model) {
        this.model = this.buildModel();
      }

      // Prepare training data
      const trainingSequences: number[][] = [];
      const trainingLabels: number[] = [];

      for (const student of students) {
        const sequence = this.prepareSequence(student.id, this.sequenceLength + 1);
        if (!sequence || sequence.length < this.sequenceLength + 1) continue;

        // Use last 30 days as input, next day as label
        const input = this.normalizeSequence(sequence.slice(0, -1));
        const label = sequence[sequence.length - 1];

        trainingSequences.push(input);
        trainingLabels.push(label);
      }

      if (trainingSequences.length === 0) {
        console.log('Insufficient data for LSTM training (need at least 31 days of history)');
        return;
      }

    // Convert to tensors
    const xs = tf.tensor3d(
      trainingSequences.map(seq => seq.map(val => [val])),
      [trainingSequences.length, this.sequenceLength, 1]
    );
    const ys = tf.tensor2d(
      trainingLabels.map(val => [val]),
      [trainingLabels.length, 1]
    );

    // Train for a few epochs
    await this.model.fit(xs, ys, {
      epochs: 10,
      batchSize: Math.min(16, trainingSequences.length),
      verbose: 0,
      shuffle: true,
    });

    // Clean up
    xs.dispose();
    ys.dispose();

      // Save model
      try {
        await this.model.save('indexeddb://' + this.modelKey);
        this.isModelLoaded = true;
        console.log('LSTM model trained and saved successfully');
      } catch (err) {
        console.warn('Failed to save LSTM model:', err);
      }
    } catch (err) {
      console.error('LSTM training error:', err);
      // Continue with fallback mode
    }
  }

  /**
   * Load pre-trained model from IndexedDB
   */
  async loadModel(): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel('indexeddb://' + this.modelKey);
      this.isModelLoaded = true;
      return true;
    } catch (err) {
      // Model doesn't exist yet, will be created on first train
      this.model = this.buildModel();
      return false;
    }
  }

  /**
   * Predict future attendance behavior for a student
   */
  async predict(studentId: string): Promise<LSTMPrediction | null> {
    if (!this.isModelLoaded) {
      const loaded = await this.loadModel();
      if (!loaded && this.model) {
        // Train on available data
        await this.trainModel();
      }
    }

    if (!this.model || !this.isModelLoaded) {
      // Fallback to statistical prediction
      return this.statisticalFallback(studentId);
    }

    const sequence = this.prepareSequence(studentId);
    if (!sequence || sequence.length < this.sequenceLength) {
      return this.statisticalFallback(studentId);
    }

    const normalized = this.normalizeSequence(sequence);

    // Prepare input tensor
    const input = tf.tensor3d(
      [normalized.map(val => [val])],
      [1, this.sequenceLength, 1]
    );

    // Predict
    const prediction = this.model.predict(input) as tf.Tensor;
    const predictionValue = await prediction.data();
    const futureAttendance = predictionValue[0];

    // Calculate trend
    const recentAvg = normalized.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const olderAvg = normalized.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAvg > olderAvg + 0.1) trend = 'improving';
    else if (recentAvg < olderAvg - 0.1) trend = 'declining';

    // Calculate risk score (inverse of predicted attendance)
    const riskScore = Math.round((1 - futureAttendance) * 100);

    // Confidence based on sequence variance
    const variance = this.calculateVariance(normalized);
    const confidence = Math.max(0.5, 1 - variance);

    // Clean up
    input.dispose();
    prediction.dispose();

    return {
      futureAttendance: Math.round(futureAttendance * 100),
      riskScore: Math.min(100, Math.max(0, riskScore)),
      trend,
      confidence: Math.round(confidence * 100),
    };
  }

  /**
   * Statistical fallback when model not available
   */
  private statisticalFallback(studentId: string): LSTMPrediction | null {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const records = dataService.getAttendanceRecords(studentId, thirtyDaysAgo);
    if (records.length === 0) return null;

    const present = records.filter(r => r.status === 'verified').length;
    const attendanceRate = (present / records.length) * 100;

    return {
      futureAttendance: Math.round(attendanceRate),
      riskScore: Math.round(100 - attendanceRate),
      trend: 'stable',
      confidence: 70,
    };
  }

  /**
   * Calculate variance of sequence
   */
  private calculateVariance(sequence: number[]): number {
    const mean = sequence.reduce((a, b) => a + b, 0) / sequence.length;
    const variance = sequence.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sequence.length;
    return variance;
  }

  /**
   * Batch predict for all students
   */
  async batchPredict(): Promise<Map<string, LSTMPrediction>> {
    const predictions = new Map<string, LSTMPrediction>();
    const students = dataService.getStudents();

    for (const student of students) {
      const prediction = await this.predict(student.id);
      if (prediction) {
        predictions.set(student.id, prediction);
      }
    }

    return predictions;
  }
}

export const lstmService = new LSTMPredictor();

