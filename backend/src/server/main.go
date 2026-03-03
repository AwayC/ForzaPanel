package main

import (
	"context"
	"encoding/json"
	"log"
	"os/signal"
	"sync"
	"syscall"

	"forza/backend/src/internal/udp"
	wsserver "forza/backend/src/internal/websocket"
)

// envelope 包裹所有 WebSocket 消息，通过 type 字段区分类型
type envelope struct {
	Type    string `json:"type"`
	UDPPort int    `json:"udpPort,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	ws := wsserver.New(":8765")

	// 可热重启的 UDP 管理器，默认端口 5300
	mgr := newUDPManager(ctx, ws)
	mgr.start(5300)

	// 处理前端下发的命令
	go func() {
		for cmd := range ws.CommandCh {
			if cmd.Type == "setUDPPort" && cmd.UDPPort > 0 && cmd.UDPPort < 65536 {
				log.Printf("[config] UDP port -> %d", cmd.UDPPort)
				mgr.start(cmd.UDPPort)
				b, _ := json.Marshal(envelope{Type: "config", UDPPort: cmd.UDPPort})
				ws.Hub().Broadcast(b)
			}
		}
	}()

	// WebSocket 服务器阻塞直到 ctx 取消
	if err := ws.Start(ctx); err != nil {
		log.Fatal("[WS]", err)
	}
	log.Println("shutdown")
}

// ── udpManager ────────────────────────────────────────────────────────────────

type udpManager struct {
	rootCtx context.Context
	ws      *wsserver.Server
	mu      sync.Mutex
	cancel  context.CancelFunc
}

func newUDPManager(ctx context.Context, ws *wsserver.Server) *udpManager {
	return &udpManager{rootCtx: ctx, ws: ws}
}

func (m *udpManager) start(port int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cancel != nil {
		m.cancel() // 停止旧监听器
	}

	ctx, cancel := context.WithCancel(m.rootCtx)
	m.cancel = cancel
	l := udp.New(port)

	go func() {
		for data := range l.DataCh {
			if data.IsRaceOn == 0 {
				continue
			}
			b, err := json.Marshal(envelope{Type: "telemetry", Data: data})
			if err != nil {
				continue
			}
			m.ws.Hub().Broadcast(b)
		}
	}()

	go func() {
		for err := range l.ErrCh {
			log.Println("[warn]", err)
		}
	}()

	go func() {
		if err := l.Start(ctx); err != nil {
			log.Println("[UDP]", err)
		}
	}()
}

