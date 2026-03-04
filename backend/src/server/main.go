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
	Type      string `json:"type"`
	UDPIP     string `json:"udpIP,omitempty"`
	UDPPort   int    `json:"udpPort,omitempty"`
	Listening bool   `json:"listening"`
	Data      any    `json:"data,omitempty"`
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	ws := wsserver.New(":8765")

	// 可热重启的 UDP 管理器，默认 0.0.0.0:5300
	mgr := newUDPManager(ctx, ws)
	mgr.start("0.0.0.0", 5300)

	// 处理前端下发的命令
	go func() {
		for cmd := range ws.CommandCh {
			switch cmd.Type {
			case "setUDPConfig":
				log.Printf("[config] UDP config -> %s:%d", cmd.UDPIP, cmd.UDPPort)
				mgr.start(cmd.UDPIP, cmd.UDPPort)
				broadcastUDPStatus(ws, mgr)
			case "startUDP":
				ip := cmd.UDPIP
				port := cmd.UDPPort
				if ip == "" {
					ip = mgr.ip()
				}
				if port <= 0 {
					port = mgr.port()
				}
				log.Printf("[config] start UDP on %s:%d", ip, port)
				mgr.start(ip, port)
				broadcastUDPStatus(ws, mgr)
			case "stopUDP":
				log.Println("[config] stop UDP")
				mgr.stop()
				broadcastUDPStatus(ws, mgr)
			case "getStatus":
				broadcastUDPStatus(ws, mgr)
			}
		}
	}()

	// WebSocket 服务器阻塞直到 ctx 取消
	if err := ws.Start(ctx); err != nil {
		log.Fatal("[WS]", err)
	}
	log.Println("shutdown")
}

func broadcastUDPStatus(ws *wsserver.Server, mgr *udpManager) {
	b, _ := json.Marshal(envelope{
		Type:      "udpStatus",
		Listening: mgr.listening(),
		UDPIP:     mgr.ip(),
		UDPPort:   mgr.port(),
	})
	ws.Hub().Broadcast(b)
}

// ── udpManager ────────────────────────────────────────────────────────────────

type udpManager struct {
	rootCtx   context.Context
	ws        *wsserver.Server
	mu        sync.Mutex
	cancel    context.CancelFunc
	curIP     string
	curPort   int
	isRunning bool
}

func newUDPManager(ctx context.Context, ws *wsserver.Server) *udpManager {
	return &udpManager{rootCtx: ctx, ws: ws}
}

func (m *udpManager) ip() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.curIP
}

func (m *udpManager) port() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.curPort
}

func (m *udpManager) listening() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.isRunning
}

func (m *udpManager) stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cancel != nil {
		m.cancel()
		m.cancel = nil
	}
	m.isRunning = false
}

func (m *udpManager) start(ip string, port int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cancel != nil {
		m.cancel() // 停止旧监听器
	}

	ctx, cancel := context.WithCancel(m.rootCtx)
	m.cancel = cancel
	m.curIP = ip
	m.curPort = port
	m.isRunning = true
	l := udp.New(ip, port)

	go func() {
		for data := range l.DataCh {
			// 如果比赛未开始且没有数据包，则不广播
			// 注意：某些情况下我们可能需要即使比赛没开始也显示数据（如在菜单中查看车辆信息）
			// 但 GEMINI.md 要求在开始比赛时清空路线图，所以 IsRaceOn 还是很有用的
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
			m.mu.Lock()
			m.isRunning = false
			m.mu.Unlock()
			broadcastUDPStatus(m.ws, m)
		}
	}()
}
