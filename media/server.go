package media

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// 本地视频流服务：WebView 的 <video> 无法直接播放 file:// 路径，
// 这里在本机随机端口起一个仅回环监听的 HTTP 服务，用 http.ServeContent
// 提供 Range 请求支持（进度条拖动、分段加载都依赖它）。
//
// 安全：端口上没有任何鉴权的话，本机任意进程（或通过 DNS rebinding 的网页）
// 都能读取正在播放的视频文件。因此启动时生成随机令牌，处理器强校验
// ?t= 查询参数，令牌不可预测则跨源/跨进程读取不可行。

var (
	serverOnce sync.Once
	serverPort int
	serverTok  string
	serveMu    sync.Mutex
	servePath  string
)

func randomToken() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand 失败极其罕见；退化为多次时间戳拼接
		return fmt.Sprintf("%x%x", time.Now().UnixNano(), os.Getpid())
	}
	return hex.EncodeToString(buf)
}

// ServeVideo 注册要播放的本地视频，返回带令牌的 http://127.0.0.1:{port}/media 形式的流地址。
// 同一时刻只保留一个待播放文件，与前端单播放器的 UI 一致。
func ServeVideo(videoPath string) (string, error) {
	abs, err := filepath.Abs(videoPath)
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}
	if _, err := os.Stat(abs); err != nil {
		return "", fmt.Errorf("video file: %w", err)
	}

	serverOnce.Do(func() {
		serverTok = randomToken()
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return
		}
		serverPort = listener.Addr().(*net.TCPAddr).Port
		mux := http.NewServeMux()
		mux.HandleFunc("/media", handleMedia)
		go func() {
			_ = http.Serve(listener, mux)
		}()
	})

	if serverPort == 0 {
		return "", fmt.Errorf("media server failed to start")
	}

	serveMu.Lock()
	servePath = abs
	serveMu.Unlock()
	return fmt.Sprintf("http://127.0.0.1:%d/media?t=%s", serverPort, serverTok), nil
}

func handleMedia(w http.ResponseWriter, r *http.Request) {
	// 令牌校验：防本机跨进程读取与 DNS rebinding
	if r.URL.Query().Get("t") != serverTok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	serveMu.Lock()
	path := servePath
	serveMu.Unlock()

	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "video not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "stat failed", http.StatusInternalServerError)
		return
	}

	// ServeContent 按 ModTime 处理缓存协商，并完整支持 Range / If-Range
	http.ServeContent(w, r, "video", stat.ModTime(), file)
}
