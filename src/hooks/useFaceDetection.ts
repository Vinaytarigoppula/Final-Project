import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";

export interface DetectedFace {
  id: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks?: faceapi.FaceLandmarks68;
  expressions?: faceapi.FaceExpressions;
  age?: number;
  gender?: string;
  genderProbability?: number;
  descriptor?: Float32Array; // Face embedding for recognition
}

interface UseFaceDetectionOptions {
  detectExpressions?: boolean;
  detectAge?: boolean;
  minConfidence?: number;
}

export function useFaceDetection(options: UseFaceDetectionOptions = {}) {
  const { detectExpressions = true, detectAge = true, minConfidence = 0.5 } = options;
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [fps, setFps] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const fpsCounterRef = useRef<number[]>([]);

  // Load face-api models (non-blocking, with timeout)
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

        // Load models with timeout to prevent hanging
        await Promise.race([
          Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          ]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Model loading timeout")), 30000)
          )
        ]);

        if (!cancelled) {
          setIsModelLoaded(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading face-api models:", err);
          setError("Failed to load face detection models");
          setIsLoading(false);
        }
      }
    };

    loadModels();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !isModelLoaded || videoRef.current.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: minConfidence,
      });

      let detections: any;
      
      if (detectAge && detectExpressions) {
        detections = await faceapi
          .detectAllFaces(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions()
          .withAgeAndGender();
      } else if (detectExpressions) {
        detections = await faceapi
          .detectAllFaces(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions();
      } else {
        detections = await faceapi
          .detectAllFaces(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptors();
      }

      const faces: DetectedFace[] = detections.map((d: any, i: number) => {
        const detection = "detection" in d ? d.detection : d;
        return {
          id: `face-${i}-${Date.now()}`,
          box: {
            x: detection.box.x,
            y: detection.box.y,
            width: detection.box.width,
            height: detection.box.height,
          },
          confidence: detection.score,
          landmarks: "landmarks" in d ? d.landmarks : undefined,
          expressions: "expressions" in d ? d.expressions : undefined,
          age: "age" in d ? d.age : undefined,
          gender: "gender" in d ? d.gender : undefined,
          genderProbability: "genderProbability" in d ? d.genderProbability : undefined,
          descriptor: "descriptor" in d ? d.descriptor : undefined,
        };
      });

      setDetectedFaces(faces);

      // Calculate FPS
      const now = Date.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      fpsCounterRef.current.push(1000 / delta);
      if (fpsCounterRef.current.length > 30) {
        fpsCounterRef.current.shift();
      }
      const avgFps = fpsCounterRef.current.reduce((a, b) => a + b, 0) / fpsCounterRef.current.length;
      setFps(Math.round(avgFps));

      // Draw on canvas
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw face boxes and landmarks
          detections.forEach((d) => {
            const detection = "detection" in d ? d.detection : d;
            const box = detection.box;

            // Draw box
            ctx.strokeStyle = detection.score > 0.8 ? "#10b981" : detection.score > 0.6 ? "#f59e0b" : "#ef4444";
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw confidence
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = "14px Space Grotesk";
            ctx.fillText(
              `${(detection.score * 100).toFixed(1)}%`,
              box.x,
              box.y - 8
            );

            // Draw age/gender if available
            if ("age" in d && "gender" in d) {
              ctx.fillText(
                `${Math.round(d.age)} yrs, ${d.gender}`,
                box.x,
                box.y + box.height + 20
              );
            }
          });
        }
      }
    } catch (err) {
      console.error("Face detection error:", err);
      // Don't continue animation frame on error - wait for explicit restart
      return;
    }

    animationFrameRef.current = requestAnimationFrame(detectFaces);
  }, [isModelLoaded, detectAge, detectExpressions, minConfidence]);

  const startDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    detectFaces();
  }, [detectFaces]);

  const stopDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setDetectedFaces([]);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isModelLoaded,
    isLoading,
    error,
    detectedFaces,
    fps,
    startDetection,
    stopDetection,
  };
}
