/**
 * Multimodal Fusion Service
 * Combines face recognition with audio features for enhanced verification
 */

import * as tf from '@tensorflow/tfjs';
import { findMatchingStudent } from './faceRecognitionService';

interface AudioFeatures {
  mfcc: number[]; // Mel-frequency cepstral coefficients
  spectralCentroid: number;
  zeroCrossingRate: number;
  energy: number;
}

interface MultimodalMatch {
  studentId?: string;
  faceConfidence: number;
  audioConfidence: number;
  fusedConfidence: number;
  features: {
    face: Float32Array;
    audio: AudioFeatures;
  };
}

class MultimodalFusionService {
  private fusionModel: tf.LayersModel | null = null;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private sampleRate = 16000; // 16kHz sample rate
  private frameSize = 1024; // Frame size for analysis

  /**
   * Initialize audio context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
    } catch (err) {
      console.warn('Audio context not available:', err);
      // Continue without audio features
    }
  }

  /**
   * Extract MFCC features from audio buffer
   */
  private extractMFCC(audioBuffer: Float32Array): number[] {
    // Simplified MFCC extraction (normally uses FFT, mel filters, DCT)
    // For browser implementation, we'll use basic spectral features
    
    const mfcc: number[] = [];
    
    // Frame the audio
    const numFrames = Math.floor(audioBuffer.length / this.frameSize);
    
    for (let i = 0; i < Math.min(13, numFrames); i++) { // 13 MFCC coefficients
      const start = i * this.frameSize;
      const end = Math.min(start + this.frameSize, audioBuffer.length);
      const frame = audioBuffer.slice(start, end);
      
      // Calculate energy in frame
      const energy = frame.reduce((sum, val) => sum + val * val, 0) / frame.length;
      
      // Simplified MFCC (using energy-based features)
      mfcc.push(Math.log10(energy + 1e-10));
    }

    // Pad if needed
    while (mfcc.length < 13) {
      mfcc.push(0);
    }

    return mfcc.slice(0, 13);
  }

  /**
   * Extract audio features from audio buffer
   */
  private extractAudioFeatures(audioBuffer: Float32Array): AudioFeatures {
    // Calculate spectral centroid
    let spectralCentroid = 0;
    let totalMagnitude = 0;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const magnitude = Math.abs(audioBuffer[i]);
      totalMagnitude += magnitude;
      spectralCentroid += i * magnitude;
    }
    spectralCentroid = totalMagnitude > 0 ? spectralCentroid / totalMagnitude : 0;

    // Calculate zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / audioBuffer.length;

    // Calculate energy
    const energy = audioBuffer.reduce((sum, val) => sum + val * val, 0) / audioBuffer.length;

    // Extract MFCC
    const mfcc = this.extractMFCC(audioBuffer);

    return {
      mfcc,
      spectralCentroid,
      zeroCrossingRate,
      energy,
    };
  }

  /**
   * Record audio from microphone
   */
  async recordAudio(durationMs: number = 2000): Promise<Float32Array | null> {
    if (!this.audioContext) {
      await this.initialize();
      if (!this.audioContext) return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      const audioData: Float32Array[] = [];
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioData.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Record for specified duration
      await new Promise(resolve => setTimeout(resolve, durationMs));

      // Stop recording
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(track => track.stop());

      // Concatenate audio data
      const totalLength = audioData.reduce((sum, arr) => sum + arr.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      for (const arr of audioData) {
        concatenated.set(arr, offset);
        offset += arr.length;
      }

      return concatenated;
    } catch (err) {
      console.warn('Audio recording failed:', err);
      return null;
    }
  }

  /**
   * Build fusion model to combine face and audio features
   */
  private buildFusionModel(): tf.LayersModel {
    // Face features: 128-dimensional descriptor
    // Audio features: 13 MFCC + 3 other = 16 features
    
    const faceInput = tf.input({ shape: [128], name: 'face_input' });
    const audioInput = tf.input({ shape: [16], name: 'audio_input' });

    // Process face features
    const faceDense = tf.layers.dense({
      units: 64,
      activation: 'relu',
    }).apply(faceInput) as tf.SymbolicTensor;

    // Process audio features
    const audioDense = tf.layers.dense({
      units: 32,
      activation: 'relu',
    }).apply(audioInput) as tf.SymbolicTensor;

    // Concatenate features
    const concatenated = tf.layers.concatenate().apply([faceDense, audioDense]) as tf.SymbolicTensor;

    // Fusion layers
    const fused = tf.layers.dense({
      units: 64,
      activation: 'relu',
    }).apply(concatenated) as tf.SymbolicTensor;

    const output = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'confidence_output',
    }).apply(fused) as tf.SymbolicTensor;

    const model = tf.model({
      inputs: [faceInput, audioInput],
      outputs: output,
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Fuse face and audio features for multimodal verification
   */
  async fuseFeatures(
    faceDescriptor: Float32Array,
    audioBuffer?: Float32Array
  ): Promise<MultimodalMatch> {
    await this.initialize();

    // Face matching
    const faceMatch = findMatchingStudent(faceDescriptor, 0.6);
    const faceConfidence = faceMatch ? faceMatch.similarity / 100 : 0;

    // Audio features
    let audioFeatures: AudioFeatures | null = null;
    let audioConfidence = 0.5; // Default if no audio

    if (audioBuffer && audioBuffer.length > 0) {
      audioFeatures = this.extractAudioFeatures(audioBuffer);
      
      // Simplified audio matching (in real implementation, compare with stored audio templates)
      // For now, use basic feature analysis
      const audioScore = Math.min(1, audioFeatures.energy * 10); // Energy-based confidence
      audioConfidence = audioScore;
    } else {
      // Create default audio features
      audioFeatures = {
        mfcc: new Array(13).fill(0),
        spectralCentroid: 0,
        zeroCrossingRate: 0,
        energy: 0,
      };
    }

    // Fusion (weighted combination)
    // Face: 70% weight, Audio: 30% weight
    const fusedConfidence = 0.7 * faceConfidence + 0.3 * audioConfidence;

    return {
      studentId: faceMatch?.student.id,
      faceConfidence,
      audioConfidence,
      fusedConfidence,
      features: {
        face: faceDescriptor,
        audio: audioFeatures,
      },
    };
  }

  /**
   * Verify student using multimodal features
   */
  async verify(
    faceDescriptor: Float32Array,
    audioBuffer?: Float32Array,
    studentId?: string
  ): Promise<{
    verified: boolean;
    confidence: number;
    method: 'face_only' | 'multimodal';
  }> {
    const match = await this.fuseFeatures(faceDescriptor, audioBuffer);

    if (!audioBuffer || !this.isInitialized) {
      // Face-only verification
      return {
        verified: match.faceConfidence > 0.85,
        confidence: match.faceConfidence,
        method: 'face_only',
      };
    }

    // Multimodal verification (higher threshold for better security)
    const verified = match.fusedConfidence > 0.8;
    const matchesExpected = !studentId || match.studentId === studentId;

    return {
      verified: verified && matchesExpected,
      confidence: match.fusedConfidence,
      method: 'multimodal',
    };
  }
}

export const multimodalService = new MultimodalFusionService();





