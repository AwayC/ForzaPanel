/** 对应 Go 后端 DashData（JSON 反序列化） */
export interface TelemetryData {
  // ── Sled ──────────────────────────────
  IsRaceOn: number;
  TimestampMS: number;

  EngineMaxRpm: number;
  EngineIdleRpm: number;
  CurrentEngineRpm: number;

  AccelerationX: number;
  AccelerationY: number;
  AccelerationZ: number;

  VelocityX: number;
  VelocityY: number;
  VelocityZ: number;

  AngularVelocityX: number;
  AngularVelocityY: number;
  AngularVelocityZ: number;

  Yaw: number;
  Pitch: number;
  Roll: number;

  NormalizedSuspensionTravelFL: number;
  NormalizedSuspensionTravelFR: number;
  NormalizedSuspensionTravelRL: number;
  NormalizedSuspensionTravelRR: number;

  TireSlipRatioFL: number;
  TireSlipRatioFR: number;
  TireSlipRatioRL: number;
  TireSlipRatioRR: number;

  WheelRotationSpeedFL: number;
  WheelRotationSpeedFR: number;
  WheelRotationSpeedRL: number;
  WheelRotationSpeedRR: number;

  WheelOnRumbleStripFL: number;
  WheelOnRumbleStripFR: number;
  WheelOnRumbleStripRL: number;
  WheelOnRumbleStripRR: number;

  WheelInPuddleDepthFL: number;
  WheelInPuddleDepthFR: number;
  WheelInPuddleDepthRL: number;
  WheelInPuddleDepthRR: number;

  SurfaceRumbleFL: number;
  SurfaceRumbleFR: number;
  SurfaceRumbleRL: number;
  SurfaceRumbleRR: number;

  TireSlipAngleFL: number;
  TireSlipAngleFR: number;
  TireSlipAngleRL: number;
  TireSlipAngleRR: number;

  TireCombinedSlipFL: number;
  TireCombinedSlipFR: number;
  TireCombinedSlipRL: number;
  TireCombinedSlipRR: number;

  SuspensionTravelMetersFL: number;
  SuspensionTravelMetersFR: number;
  SuspensionTravelMetersRL: number;
  SuspensionTravelMetersRR: number;

  CarOrdinal: number;
  CarClass: number; // 0(D)~7(X)
  CarPerformanceIndex: number;
  DrivetrainType: number; // 0=FWD 1=RWD 2=AWD
  NumCylinders: number;

  // ── Dash ──────────────────────────────
  PositionX: number;
  PositionY: number;
  PositionZ: number;

  Speed: number; // 米/秒
  Power: number; // 瓦特
  Torque: number; // 牛·米

  TireTempFL: number;
  TireTempFR: number;
  TireTempRL: number;
  TireTempRR: number;

  Boost: number;
  Fuel: number;
  DistanceTraveled: number;
  BestLap: number;
  LastLap: number;
  CurrentLap: number;
  CurrentRaceTime: number;

  LapNumber: number;
  RacePosition: number;
  Accel: number; // 0~255
  Brake: number; // 0~255
  Clutch: number;
  HandBrake: number;
  Gear: number;
  Steer: number; // -127~+127

  // ── Ext (FM8) ─────────────────────────
  TireWearFL: number;
  TireWearFR: number;
  TireWearRL: number;
  TireWearRR: number;
  TrackOrdinal: number;

  PacketSize: number;
}

export const CAR_CLASS = ["D", "C", "B", "A", "S1", "S2", "X"] as const;
export const DRIVETRAIN = ["FWD", "RWD", "AWD"] as const;
