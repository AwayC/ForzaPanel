package wsserver

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

const DefaultAddr = ":8765"

// Command 是前端发往后端的控制命令
type Command struct {
	Type    string `json:"type"`
	UDPIP   string `json:"udpIP,omitempty"`
	UDPPort int    `json:"udpPort,omitempty"`
}

var upgrader = websocket.Upgrader{
	// 开发阶段允许所有来源（Electron 的 file:// 协议）
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Server 是 HTTP + WebSocket 服务器
type Server struct {
	addr      string
	hub       *Hub
	CommandCh chan Command
}

func New(addr string) *Server {
	if addr == "" {
		addr = DefaultAddr
	}
	return &Server{
		addr:      addr,
		hub:       NewHub(),
		CommandCh: make(chan Command, 8),
	}
}

// Hub 返回 Hub，供外部调用 Broadcast
func (s *Server) Hub() *Hub { return s.hub }

// Start 启动 HTTP 服务器，ctx 取消时优雅关闭
func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWS)

	srv := &http.Server{Addr: s.addr, Handler: mux}

	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()

	log.Printf("[WS] listening on ws://localhost%s/ws", s.addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[WS] upgrade:", err)
		return
	}
	s.hub.register(conn)
	log.Printf("[WS] client connected: %s", r.RemoteAddr)

	// 读取客户端消息（命令）
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			s.hub.unregister(conn)
			log.Printf("[WS] client disconnected: %s", r.RemoteAddr)
			return
		}
		var cmd Command
		if err := json.Unmarshal(msg, &cmd); err == nil && cmd.Type != "" {
			select {
			case s.CommandCh <- cmd:
			default:
			}
		}
	}
}
