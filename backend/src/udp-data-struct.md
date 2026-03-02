## Output Structures

### Type notes:

[Letter] [Number]

The letter defines the type from one of the following:

- S Signed Integer

- U Unsigned Integer

- F Floating Point

The number defines the amount of bits used.

Examples:

- S8 is a signed byte with potential values between -128 and 127.

- F32 is a 32-bit floating point number, equivalent to float/single

### Sled

```c
// = 1 when race is on. = 0 when in menus/race stopped …

S32 IsRaceOn;



// Can overflow to 0 eventually

U32 TimestampMS;

F32 EngineMaxRpm;

F32 EngineIdleRpm;

F32 CurrentEngineRpm;



// In the car's local space; X = right, Y = up, Z = forward

F32 AccelerationX;

F32 AccelerationY;

F32 AccelerationZ;



// In the car's local space; X = right, Y = up, Z = forward

F32 VelocityX;

F32 VelocityY;

F32 VelocityZ;



// In the car's local space; X = pitch, Y = yaw, Z = roll

F32 AngularVelocityX;

F32 AngularVelocityY;

F32 AngularVelocityZ;



F32 Yaw;

F32 Pitch;

F32 Roll;



// Suspension travel normalized: 0.0f = max stretch; 1.0 = max compression

F32 NormalizedSuspensionTravelFrontLeft;

F32 NormalizedSuspensionTravelFrontRight;

F32 NormalizedSuspensionTravelRearLeft;

F32 NormalizedSuspensionTravelRearRight;



// Tire normalized slip ratio, = 0 means 100% grip and |ratio| > 1.0 means loss of grip.

F32 TireSlipRatioFrontLeft;

F32 TireSlipRatioFrontRight;

F32 TireSlipRatioRearLeft;

F32 TireSlipRatioRearRight;



// Wheels rotation speed radians/sec.

F32 WheelRotationSpeedFrontLeft;

F32 WheelRotationSpeedFrontRight;

F32 WheelRotationSpeedRearLeft;

F32 WheelRotationSpeedRearRight;



// = 1 when wheel is on rumble strip, = 0 when off.

S32 WheelOnRumbleStripFrontLeft;

S32 WheelOnRumbleStripFrontRight;

S32 WheelOnRumbleStripRearLeft;

S32 heelOnRumbleStripRearRight;



// = from 0 to 1, where 1 is the deepest puddle

F32 WheelInPuddleDepthFrontLeft;

F32 WheelInPuddleDepthFrontRight;

F32 WheelInPuddleDepthRearLeft;

F32 WheelInPuddleDepthRearRight;



// Non-dimensional surface rumble values passed to controller force feedback

F32 SurfaceRumbleFrontLeft;

F32 SurfaceRumbleFrontRight;

F32 SurfaceRumbleRearLeft;

F32 SurfaceRumbleRearRight;



// Tire normalized slip angle, = 0 means 100% grip and |angle| > 1.0 means loss of grip.

F32 TireSlipAngleFrontLeft;

F32 TireSlipAngleFrontRight;

F32 TireSlipAngleRearLeft;

F32 TireSlipAngleRearRight;



// Tire normalized combined slip, = 0 means 100% grip and |slip| > 1.0 means loss of grip.

F32 TireCombinedSlipFrontLeft;

F32 TireCombinedSlipFrontRight;

F32 TireCombinedSlipRearLeft;

F32 TireCombinedSlipRearRight;



// Actual suspension travel in meters

F32 SuspensionTravelMetersFrontLeft;

F32 SuspensionTravelMetersFrontRight;

F32 SuspensionTravelMetersRearLeft;

F32 SuspensionTravelMetersRearRight;



// Unique ID of the car make/model

S32 CarOrdinal;



// Between 0 (D -- worst cars) and 7 (X class -- best cars) inclusive

S32 CarClass;



// Between 100 (worst car) and 999 (best car) inclusive

S32 CarPerformanceIndex;



// 0 = FWD, 1 = RWD, 2 = AWD

S32 DrivetrainType;



// Number of cylinders in the engine

S32 NumCylinders;
```

Dash

```c

// = 1 when race is on. = 0 when in menus/race stopped …

S32 IsRaceOn;

// Can overflow to 0 eventually

U32 TimestampMS;

F32 EngineMaxRpm;

F32 EngineIdleRpm;

F32 CurrentEngineRpm;

// In the car's local space; X = right, Y = up, Z = forward

F32 AccelerationX;

F32 AccelerationY;

F32 AccelerationZ;

// In the car's local space; X = right, Y = up, Z = forward

F32 VelocityX;

F32 VelocityY;

F32 VelocityZ;

// In the car's local space; X = pitch, Y = yaw, Z = roll

F32 AngularVelocityX;

F32 AngularVelocityY;

F32 AngularVelocityZ;

F32 Yaw;

F32 Pitch;

F32 Roll;

// Suspension travel normalized: 0.0f = max stretch; 1.0 = max compression

F32 NormalizedSuspensionTravelFrontLeft;

F32 NormalizedSuspensionTravelFrontRight;

F32 NormalizedSuspensionTravelRearLeft;

F32 NormalizedSuspensionTravelRearRight;

// Tire normalized slip ratio, = 0 means 100% grip and |ratio| > 1.0 means loss of grip.

F32 TireSlipRatioFrontLeft;

F32 TireSlipRatioFrontRight;

F32 TireSlipRatioRearLeft;

F32 TireSlipRatioRearRight;

// Wheels rotation speed radians/sec.

F32 WheelRotationSpeedFrontLeft;

F32 WheelRotationSpeedFrontRight;

F32 WheelRotationSpeedRearLeft;

F32 WheelRotationSpeedRearRight;

// = 1 when wheel is on rumble strip, = 0 when off.

S32 WheelOnRumbleStripFrontLeft;

S32 WheelOnRumbleStripFrontRight;

S32 WheelOnRumbleStripRearLeft;

S32 heelOnRumbleStripRearRight;

// = from 0 to 1, where 1 is the deepest puddle

F32 WheelInPuddleDepthFrontLeft;

F32 WheelInPuddleDepthFrontRight;

F32 WheelInPuddleDepthRearLeft;

F32 WheelInPuddleDepthRearRight;

// Non-dimensional surface rumble values passed to controller force feedback

F32 SurfaceRumbleFrontLeft;

F32 SurfaceRumbleFrontRight;

F32 SurfaceRumbleRearLeft;

F32 SurfaceRumbleRearRight;

// Tire normalized slip angle, = 0 means 100% grip and |angle| > 1.0 means loss of grip.

F32 TireSlipAngleFrontLeft;

F32 TireSlipAngleFrontRight;

F32 TireSlipAngleRearLeft;

F32 TireSlipAngleRearRight;

// Tire normalized combined slip, = 0 means 100% grip and |slip| > 1.0 means loss of grip.

F32 TireCombinedSlipFrontLeft;

F32 TireCombinedSlipFrontRight;

F32 TireCombinedSlipRearLeft;

F32 TireCombinedSlipRearRight;

// Actual suspension travel in meters

F32 SuspensionTravelMetersFrontLeft;

F32 SuspensionTravelMetersFrontRight;

F32 SuspensionTravelMetersRearLeft;

F32 SuspensionTravelMetersRearRight;

// Unique ID of the car make/model

S32 CarOrdinal;

// Between 0 (D -- worst cars) and 7 (X class -- best cars) inclusive

S32 CarClass;

// Between 100 (worst car) and 999 (best car) inclusive

S32 CarPerformanceIndex;

// 0 = FWD, 1 = RWD, 2 = AWD

S32 DrivetrainType;

// Number of cylinders in the engine

S32 NumCylinders;

F32 PositionX;

F32 PositionY;

F32 PositionZ;

F32 Speed;

F32 Power;

F32 Torque;

F32 TireTempFrontLeft;

F32 TireTempFrontRight;

F32 TireTempRearLeft;

F32 TireTempRearRight;

F32 Boost;

F32 Fuel;

F32 DistanceTraveled;

F32 BestLap;

F32 LastLap;

F32 CurrentLap;

F32 CurrentRaceTime;

U16 LapNumber;

U8 RacePosition;

U8 Accel;

U8 Brake;

U8 Clutch;

U8 HandBrake;

U8 Gear;

S8 Steer;

S8 NormalizedDrivingLine;

S8 NormalizedAIBrakeDifference;

F32 TireWearFrontLeft;

F32 TireWearFrontRight;

F32 TireWearRearLeft;

F32 TireWearRearRight;

// ID for track

S32 TrackOrdinal;
```
