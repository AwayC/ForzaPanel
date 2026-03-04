package forzadata

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
)

// 各版本 UDP 包大小（字节），来自实测
const (
	SledPacketSize = 232 // FM7 Sled
	FM7PacketSize  = 311 // FM7 Dash
	FH4PacketSize  = 324 // FH4/FH5 Dash（Sled 和 Dash 之间有 13 字节间隔）
	FM8PacketSize  = 331 // FM8/FM2023 Dash（含扩展字段）

	fh4Padding  = 12 // FH4 在 SledData 之后、dashFields 之前的间隔字节数
	extFieldSize = 20 // extFields 大小
)

// Parse 根据包大小自动识别版本并解析，返回统一的 *DashData
// Sled 格式时 dashFields/extFields 字段为零值；未知大小 >= FM7PacketSize 时兼容解析
func Parse(data []byte) (*DashData, error) {
	n := len(data)
	switch {
	case n == SledPacketSize:
		return parseSled(data)
	case n == FM7PacketSize || n == FH4PacketSize || n == FM8PacketSize:
		return parseDash(data)
	case n > FM7PacketSize:
		return parseDash(data) // 兼容未来版本
	default:
		return nil, fmt.Errorf("unknown packet size: %d bytes", n)
	}
}

func parseSled(data []byte) (*DashData, error) {
	result := &DashData{PacketSize: len(data)}
	if err := binary.Read(bytes.NewReader(data), binary.LittleEndian, &result.SledData); err != nil {
		return nil, fmt.Errorf("sled: %w", err)
	}
	return result, nil
}

func parseDash(data []byte) (*DashData, error) {
	result := &DashData{PacketSize: len(data)}
	r := bytes.NewReader(data)

	if err := binary.Read(r, binary.LittleEndian, &result.SledData); err != nil {
		return nil, fmt.Errorf("sled section: %w", err)
	}

	// FH4/FH5 在 Sled 和 Dash 之间有 13 字节的间隔，跳过
	if len(data) == FH4PacketSize {
		if _, err := r.Seek(fh4Padding, io.SeekCurrent); err != nil {
			return nil, fmt.Errorf("fh4 padding: %w", err)
		}
	}

	if err := binary.Read(r, binary.LittleEndian, &result.dashFields); err != nil {
		return nil, fmt.Errorf("dash section: %w", err)
	}

	// 剩余 >= 20 字节时读取扩展字段（FM8/FM2023）
	if r.Len() >= extFieldSize {
		if err := binary.Read(r, binary.LittleEndian, &result.extFields); err != nil {
			return nil, fmt.Errorf("ext section: %w", err)
		}
	}

	return result, nil
}
