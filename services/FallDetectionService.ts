import { Accelerometer, Gyroscope } from "expo-sensors";
import { Alert, Vibration } from "react-native";
import * as Location from "expo-location";
import { supabase } from "../src/lib/supabase";
import { Asset } from "expo-asset";

// Safe import — onnxruntime-react-native requires native module linked via expo prebuild
let InferenceSession: any;
let Tensor: any;
let ortAvailable = false;
try {
  const ort = require("onnxruntime-react-native");
  InferenceSession = ort.InferenceSession;
  Tensor = ort.Tensor;
  ortAvailable = true;
} catch (e: any) {
  console.warn(
    "[FallDetection] onnxruntime-react-native not available:",
    e?.message
  );
}

// ---- Feature order (must match training) ----
const FEATURE_ORDER = [
  "acc_max",
  "gyro_max",
  "acc_kurtosis",
  "gyro_kurtosis",
  "lin_max",
  "acc_skewness",
  "gyro_skewness",
  "post_gyro_max",
  "post_lin_max",
];

// ---- Voting weights based on recall ----
const MODEL_WEIGHTS: Record<string, number> = {
  SVM: 1.0, // 99.35 % recall
  XGBoost: 0.95, // 98.69 %
  RandomForest: 0.95, // 98.69 %
  LogisticRegression: 0.9, // 97.39 %
};

// ---- StandardScaler params from training ----
const SCALER_MEAN = [
  21.753410248600193, 5.051467270102476, 9.964557502975554, 3.906186028182702,
  7.934861058242888, 1.711623379329533, 1.6260487354153212, 3.232623636686232,
  5.190129045684866,
];
const SCALER_SCALE = [
  5.477851792474112, 2.9644608794124263, 11.983541292070731, 5.49373254780357,
  4.248214123459073, 1.5298242087715417, 0.9992553057764303, 3.4314081260842455,
  4.9901304665097586,
];

// ---- Types ----
export interface SensorReading {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

// ---- Stats helpers ----
const max = (a: number[]) => (a.length === 0 ? 0 : Math.max(...a));
const mean = (a: number[]) =>
  a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length;

function variance(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length;
}
function std(a: number[]): number {
  return Math.sqrt(variance(a));
}
function skewness(a: number[]): number {
  if (a.length < 3) return 0;
  const m = mean(a);
  const s = std(a);
  if (s === 0) return 0;
  return a.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / a.length;
}
function kurtosis(a: number[]): number {
  if (a.length < 4) return 0;
  const m = mean(a);
  const s = std(a);
  if (s === 0) return 0;
  return a.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / a.length - 3;
}

const SENSOR_INTERVAL = 50; // ms between sensor reads (20 Hz feed)
const PREDICT_INTERVAL = 2000; // ms between predictions (every 2 s)

class FallDetectionService {
  private sessions: Record<string, any> = {};
  private dataBuffer: SensorReading[] = [];
  private _ready = false;
  private _hasGyro = true;
  private windowSize = 200; // ~2 s at 100 Hz
  private fallThreshold = 0.5;

  private isMonitoring = false;
  private accSub: any = null;
  private gyroSub: any = null;
  private feedTicker: any = null;
  private predictTicker: any = null;
  
  private latestReading: SensorReading = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
  private patientId: string = "";
  private caregiverId: string = "";
  private fallAlertSent = false;
  private lastAlertTime = 0;

  /** Load all four ONNX sessions */
  private async initialize(): Promise<void> {
    if (this._ready) return;
    if (!ortAvailable) {
      console.warn("[FallDetection] ONNX not available, will not init models.");
      return;
    }
    console.log("[FallDetection] Loading ONNX models …");

    const modelMap: Record<string, number> = {
      XGBoost: require("../assets/models/xgboost_fall_detection.onnx"),
      RandomForest: require("../assets/models/random_forest_fall_detection.onnx"),
      LogisticRegression: require("../assets/models/logistic_regression_fall_detection.onnx"),
      SVM: require("../assets/models/svm_fall_detection.onnx"),
    };

    for (const [name, moduleId] of Object.entries(modelMap)) {
      try {
        const asset = Asset.fromModule(moduleId);
        await asset.downloadAsync();
        if (asset.localUri) {
          this.sessions[name] = await InferenceSession.create(asset.localUri);
          console.log(`[FallDetection] ✓ ${name} loaded`);
        }
      } catch (err) {
        console.warn(`[FallDetection] ✗ ${name} failed:`, err);
        this.sessions[name] = null;
      }
    }

    try {
      this._hasGyro = await Gyroscope.isAvailableAsync();
    } catch {
      this._hasGyro = false;
    }

    this._ready = true;
    console.log("[FallDetection] Models ready.");
  }

  // --- Start detection ---
  async start(patientId: string, caregiverId: string) {
    if (this.isMonitoring) return;

    this.patientId = patientId;
    this.caregiverId = caregiverId;
    
    // Ensure initialized
    if (!this._ready) {
      await this.initialize();
    }

    console.log("[FallDetection] ▶ Starting monitoring...");

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL);
    this.accSub = Accelerometer.addListener((d) => {
      this.latestReading = { ...this.latestReading, ax: d.x, ay: d.y, az: d.z };
    });

    if (this._hasGyro) {
      Gyroscope.setUpdateInterval(SENSOR_INTERVAL);
      this.gyroSub = Gyroscope.addListener((d) => {
        this.latestReading = { ...this.latestReading, gx: d.x, gy: d.y, gz: d.z };
      });
    }

    this.feedTicker = setInterval(() => {
      this.dataBuffer.push({ ...this.latestReading });
      if (this.dataBuffer.length > this.windowSize) {
        this.dataBuffer.shift();
      }
    }, SENSOR_INTERVAL);

    this.predictTicker = setInterval(async () => {
      if (!this.isReady()) return;
      try {
        await this.predict();
      } catch (err: any) {
        if (err?.message !== "Not enough data") {
          console.warn("[FallDetection] Prediction error:", err?.message);
        }
      }
    }, PREDICT_INTERVAL);

    this.isMonitoring = true;
  }

  // --- Stop detection ---
  stop() {
    if (!this.isMonitoring) return;
    
    console.log("[FallDetection] ⏹ Stopping monitoring");
    if (this.accSub) this.accSub.remove();
    if (this.gyroSub) this.gyroSub.remove();
    if (this.feedTicker) clearInterval(this.feedTicker);
    if (this.predictTicker) clearInterval(this.predictTicker);

    this.accSub = null;
    this.gyroSub = null;
    this.feedTicker = null;
    this.predictTicker = null;
    this.isMonitoring = false;
    this.dataBuffer = [];
  }

  isReady() {
    return this._ready && this.dataBuffer.length >= this.windowSize / 2;
  }

  // ---- Feature extraction ----
  private extractFeatures(): Record<string, number> {
    // Expo returns Accelerometer data in Gs. Multiply by 9.81 to get m/s^2 to match expected model features.
    const G_TO_MS2 = 9.81;
    const accData = this.dataBuffer.map((r) => [
      r.ax * G_TO_MS2,
      r.ay * G_TO_MS2, 
      r.az * G_TO_MS2
    ]);
    const gyroData = this.dataBuffer.map((r) => [r.gx, r.gy, r.gz]);

    const accMag = accData.map(([x, y, z]) => Math.sqrt(x * x + y * y + z * z));
    const gyroMag = this._hasGyro
      ? gyroData.map(([x, y, z]) => Math.sqrt(x * x + y * y + z * z))
      : accMag.map(() => 0); // no gyro → zero

    const gx = mean(accData.map((a) => a[0]));
    const gy = mean(accData.map((a) => a[1]));
    const gz = mean(accData.map((a) => a[2]));
    // Linear acceleration (gravity removed)
    const linMag = accData.map(([x, y, z]) =>
      Math.sqrt((x - gx) ** 2 + (y - gy) ** 2 + (z - gz) ** 2)
    );

    const split = Math.floor((accMag.length * 2) / 3);
    const postGyro = this._hasGyro ? gyroMag.slice(split) : [];
    const postLin = linMag.slice(split);

    const features: Record<string, number> = {
      acc_max: max(accMag),
      gyro_max: this._hasGyro ? max(gyroMag) : 0,
      acc_kurtosis: kurtosis(accMag),
      gyro_kurtosis: this._hasGyro ? kurtosis(gyroMag) : 0,
      lin_max: max(linMag),
      acc_skewness: skewness(accMag),
      gyro_skewness: this._hasGyro ? skewness(gyroMag) : 0,
      post_gyro_max: postGyro.length > 0 ? max(postGyro) : 0,
      post_lin_max: postLin.length > 0 ? max(postLin) : 0,
    };

    return features;
  }

  // ---- Scaling ----
  private scaleFeatures(f: Record<string, number>): Float32Array {
    return new Float32Array(
      FEATURE_ORDER.map((n, i) => (f[n] - SCALER_MEAN[i]) / SCALER_SCALE[i])
    );
  }
  private rawFeatures(f: Record<string, number>): Float32Array {
    return new Float32Array(FEATURE_ORDER.map((n) => f[n]));
  }

  // ---- Predict ----
  async predict() {
    if (!this.isReady()) throw new Error("Not enough data");

    const features = this.extractFeatures();
    const scaled = this.scaleFeatures(features);
    const raw = this.rawFeatures(features);

    console.log(`[FallDetection 🔍] Buffer size: ${this.dataBuffer.length}, Gyro: ${this._hasGyro}`);
    console.log(`[FallDetection 🔍] Features extracted:`, JSON.stringify(features));

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [name, session] of Object.entries(this.sessions)) {
      if (!session) continue;
      try {
        const needsScaling = name === "SVM" || name === "LogisticRegression";
        const input = needsScaling ? scaled : raw;
        const tensor = new Tensor("float32", input, [1, FEATURE_ORDER.length]);

        const feeds: Record<string, any> = {};
        feeds[session.inputNames[0]] = tensor;
        const results = await session.run(feeds);

        let probability = 0.5;
        let rawLabel = -1;
        
        for (const oName of session.outputNames) {
          const out = results[oName];
          if (!out?.data) continue;
          const d = out.data as Float32Array | number[];

          if (oName.toLowerCase().includes("label") || oName.toLowerCase() === "output_label") {
            rawLabel = Number(d[0]);
          }

          if (oName.toLowerCase().includes("prob") && d.length >= 2) {
            probability = Number(d[1]);
            break;
          }
          if (d.length === 2 && !oName.toLowerCase().includes("label")) {
            probability = Number(d[1]);
            break;
          }
          if (d.length === 1 && !oName.toLowerCase().includes("label")) {
            probability = Number(d[0]);
            break;
          }
        }
        
        // SVM often outputs the probability node incorrectly or outputs raw distance.
        // If it outputs a raw label, rely on the label itself (0 = No Fall, 1 = Fall).
        if (name === 'SVM') {
           probability = rawLabel > 0 ? 0.99 : 0.01;
        }

        console.log(`[FallDetection 🔍] Model: ${name}, Parsed Prob: ${(probability * 100).toFixed(2)}%`);

        const weight = MODEL_WEIGHTS[name] ?? 1;
        weightedSum += probability * weight;
        totalWeight += weight;
      } catch (err: any) {
        console.warn(`[FallDetection]   ${name.padEnd(20)} ERROR: ${err?.message}`);
      }
    }

    const finalProbability = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const fallDetected = finalProbability > this.fallThreshold;
    
    // Print stats to console on every prediction cycle
    console.log(`[FallDetection 🏃] Monitoring active... Probability of fall: ${(finalProbability * 100).toFixed(1)}%`);

    if (fallDetected) {
      const now = Date.now();
      // cooldown of 60 seconds between alerts
      if (now - this.lastAlertTime > 60000) {
        this.lastAlertTime = now;
        console.log("🚨 Fall confirmed by ONNX Ensemble, sending alert...");
        Vibration.vibrate();
        Alert.alert(
          "⚠️ Fall Detected",
          `A fall has been detected with probability ${(finalProbability * 100).toFixed(1)}%!`
        );
        // Do not await this, let it run in background so it doesn't block the UI
        this.sendAlert(this.patientId, this.caregiverId);
      }
      // CRITICAL: Flush the buffer to avoid continuous false positives from overlapping windows
      this.dataBuffer = [];
      this.latestReading = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
    }
  }

  // --- Send alert to Supabase ---
  private async sendAlert(patientId: string, caregiverId: string) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = {
        latitude: null as number | null,
        longitude: null as number | null,
      };

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      }

      const alert = {
        patient_id: patientId,
        caregiver_id: caregiverId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: "active",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("fall_alerts").insert([alert]);
      if (error) console.error("❌ Error saving fall alert:", error);
      else console.log("✅ Fall alert sent to Supabase!");
    } catch (err) {
      console.error("❌ Error sending fall alert:", err);
    }
  }
}

export default new FallDetectionService();