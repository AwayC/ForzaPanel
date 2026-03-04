package udp

import (
	"context"
	"fmt"
	"log"
	"net"

	forzadata "forza/backend/src/internal/forza_data"
)

const (
	DefaultIP      = "0.0.0.0"
	DefaultPort    = 5300
	MaxPacketBytes = 512
)

// Listener 监听 Forza 发来的 UDP 遥测数据包
type Listener struct {
	ip     string
	port   int
	conn   *net.UDPConn
	DataCh chan *forzadata.DashData
	ErrCh  chan error
}

// New 创建监听器，ip 为空使用 "0.0.0.0"，port=0 使用默认端口 5300
func New(ip string, port int) *Listener {
	if ip == "" {
		ip = DefaultIP
	}
	if port == 0 {
		port = DefaultPort
	}
	return &Listener{
		ip:     ip,
		port:   port,
		DataCh: make(chan *forzadata.DashData, 64),
		ErrCh:  make(chan error, 16),
	}
}

// Start 阻塞式监听，建议在 goroutine 中调用
// ctx 取消或调用 Stop() 均可安全退出；退出后自动关闭 DataCh 和 ErrCh
func (l *Listener) Start(ctx context.Context) error {
	addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("%s:%d", l.ip, l.port))
	if err != nil {
		return fmt.Errorf("resolve :%s:%d: %w", l.ip, l.port, err)
	}

	conn, err := net.ListenUDP("udp4", addr)
	if err != nil {
		return fmt.Errorf("listen :%s:%d: %w", l.ip, l.port, err)
	}
	l.conn = conn
	defer func() {
		conn.Close()
		close(l.DataCh)
		close(l.ErrCh)
	}()

	log.Printf("[UDP] listening on %s:%d", l.ip, l.port)

	// ctx 取消时关闭连接，使 ReadFromUDP 返回
	go func() {
		<-ctx.Done()
		conn.Close()
	}()

	buf := make([]byte, MaxPacketBytes)
	for {
		n, addr, err := conn.ReadFromUDP(buf)
		if err != nil {
			return nil // 连接已关闭，正常退出
		}

		data, parseErr := forzadata.Parse(buf[:n])
		if parseErr != nil {
			l.sendErr(fmt.Errorf("%s: %w", addr, parseErr))
			continue
		}

		l.sendData(data)
	}
}

func (l *Listener) sendData(d *forzadata.DashData) {
	select {
	case l.DataCh <- d:
	default:
		// 下游处理太慢，丢弃旧包保证实时性
	}
}

func (l *Listener) sendErr(err error) {
	select {
	case l.ErrCh <- err:
	default:
	}
}
