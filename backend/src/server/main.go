package main

import (
	"context"
	"encoding/json"
	"log"
	"os/signal"
	"syscall"

	"forza/backend/src/internal/udp"
	wsserver "forza/backend/src/internal/websocket"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	udpListener := udp.New(0)       // UDP :5300
	ws := wsserver.New(":8765")     // WebSocket :8765

	go handleErrors(udpListener)
	go broadcast(udpListener, ws)

	// WebSocket 服务器独立 goroutine
	go func() {
		if err := ws.Start(ctx); err != nil {
			log.Fatal("[WS]", err)
		}
	}()

	// UDP 监听阻塞主流程，ctx 取消后退出
	if err := udpListener.Start(ctx); err != nil {
		log.Fatal(err)
	}
	log.Println("shutdown")
}

// broadcast 读取 UDP 解析数据，序列化为 JSON 后广播给所有 WS 客户端
func broadcast(l *udp.Listener, ws *wsserver.Server) {
	for data := range l.DataCh {
		if data.IsRaceOn == 0 {
			continue
		}
		b, err := json.Marshal(data)
		if err != nil {
			log.Println("[JSON]", err)
			continue
		}
		ws.Hub().Broadcast(b)
	}
}

func handleErrors(l *udp.Listener) {
	for err := range l.ErrCh {
		log.Println("[warn]", err)
	}
}
