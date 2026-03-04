package forzadata

// ── Sled（232 字节） ─────────────────────────────────────────────────────────────
//
// SledData 对应 Forza UDP Sled 格式（FM7，232 字节）
// 字段顺序与二进制报文严格一致，可直接用 encoding/binary 反序列化
type SledData struct {
	IsRaceOn    int32  // 1 = 比赛中；0 = 菜单/已停止
	TimestampMS uint32 // 毫秒时间戳，可能溢出回 0

	EngineMaxRpm     float32
	EngineIdleRpm    float32
	CurrentEngineRpm float32

	// 车辆本地坐标系：X=右 Y=上 Z=前
	AccelerationX float32
	AccelerationY float32
	AccelerationZ float32

	VelocityX float32
	VelocityY float32
	VelocityZ float32

	// X=俯仰 Y=偏航 Z=横滚
	AngularVelocityX float32
	AngularVelocityY float32
	AngularVelocityZ float32

	Yaw   float32
	Pitch float32
	Roll  float32

	// 悬挂行程归一化：0.0=最大拉伸 1.0=最大压缩
	NormalizedSuspensionTravelFL float32
	NormalizedSuspensionTravelFR float32
	NormalizedSuspensionTravelRL float32
	NormalizedSuspensionTravelRR float32

	// 轮胎归一化滑移率：0=100%附着 |ratio|>1.0=失去附着
	TireSlipRatioFL float32
	TireSlipRatioFR float32
	TireSlipRatioRL float32
	TireSlipRatioRR float32

	// 车轮转速（弧度/秒）
	WheelRotationSpeedFL float32
	WheelRotationSpeedFR float32
	WheelRotationSpeedRL float32
	WheelRotationSpeedRR float32

	// 车轮在震动带：1=在 0=不在
	WheelOnRumbleStripFL float32
	WheelOnRumbleStripFR float32
	WheelOnRumbleStripRL float32
	WheelOnRumbleStripRR float32

	// 水坑深度：0~1
	WheelInPuddleDepthFL float32
	WheelInPuddleDepthFR float32
	WheelInPuddleDepthRL float32
	WheelInPuddleDepthRR float32

	// 路面震动（手柄力反馈）
	SurfaceRumbleFL float32
	SurfaceRumbleFR float32
	SurfaceRumbleRL float32
	SurfaceRumbleRR float32

	// 轮胎归一化侧滑角
	TireSlipAngleFL float32
	TireSlipAngleFR float32
	TireSlipAngleRL float32
	TireSlipAngleRR float32

	// 轮胎归一化综合滑移
	TireCombinedSlipFL float32
	TireCombinedSlipFR float32
	TireCombinedSlipRL float32
	TireCombinedSlipRR float32

	// 实际悬挂行程（米）
	SuspensionTravelMetersFL float32
	SuspensionTravelMetersFR float32
	SuspensionTravelMetersRL float32
	SuspensionTravelMetersRR float32

	CarOrdinal          int32 // 车型唯一 ID
	CarClass            int32 // 0(D)~7(X)
	CarPerformanceIndex int32 // 100~999
	DrivetrainType      int32 // 0=FWD 1=RWD 2=AWD
	NumCylinders        int32
}

// ── Dash 仪表盘部分 ──────────────────────────────────────────────────────────────
//
// dashFields 是 Dash 包中紧接 SledData 的固定字段（79 字节）
// 嵌入 DashData 后字段可直接访问，如 data.Speed, data.Gear
type dashFields struct {
	PositionX float32
	PositionY float32
	PositionZ float32

	Speed  float32 // 米/秒
	Power  float32 // 瓦特
	Torque float32 // 牛·米

	// 胎温（摄氏度）
	TireTempFL float32
	TireTempFR float32
	TireTempRL float32
	TireTempRR float32

	Boost            float32 // 涡轮增压压力
	Fuel             float32 // 剩余油量
	DistanceTraveled float32 // 行驶里程（米）
	BestLap          float32 // 最佳圈时间（秒）
	LastLap          float32
	CurrentLap       float32
	CurrentRaceTime  float32

	LapNumber    uint16
	RacePosition uint8
	Accel        uint8 // 油门 0~255
	Brake        uint8 // 刹车 0~255
	Clutch       uint8
	HandBrake    uint8
	Gear         uint8
	Steer        int8 // 转向 -127~+127

	NormalizedDrivingLine       int8
	NormalizedAIBrakeDifference int8
}

// ── 扩展字段（FM8/FM2023，331 字节，20 字节） ────────────────────────────────────
//
// extFields 是 Dash 包末尾的扩展字段，FH4/FM7 不含此部分
type extFields struct {
	// 轮胎磨损 0.0~1.0
	TireWearFL float32
	TireWearFR float32
	TireWearRL float32
	TireWearRR float32

	TrackOrdinal int32 // 赛道 ID
}

// ── 解析结果 ─────────────────────────────────────────────────────────────────────
//
// DashData 是所有格式解析后的统一结果
// 嵌入 SledData、dashFields 和 extFields，所有字段均可直接访问：
//
//	data.Speed, data.Gear, data.TireSlipRatioFL, data.TireWearFL ...
//
// 扩展字段不存在时（FM7/FH4）保持零值；PacketSize 记录原始包大小
type DashData struct {
	SledData
	dashFields
	extFields

	PacketSize int
}
