package media

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 安全回归测试：本地流服务必须校验令牌，防本机跨进程读取与 DNS rebinding。
func TestServeVideoRequiresToken(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "clip.mp4")
	if err := os.WriteFile(video, []byte("fake-video-bytes"), 0o600); err != nil {
		t.Fatal(err)
	}

	url, err := ServeVideo(video)
	if err != nil {
		t.Fatalf("ServeVideo: %v", err)
	}
	if !strings.Contains(url, "t=") {
		t.Fatalf("stream URL must carry a token, got %q", url)
	}

	// 1) 无令牌 → 403
	resNoToken, err := http.Get(stripQuery(url))
	if err != nil {
		t.Fatalf("GET without token: %v", err)
	}
	body, _ := io.ReadAll(resNoToken.Body)
	resNoToken.Body.Close()
	if resNoToken.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 without token, got %d (%s)", resNoToken.StatusCode, body)
	}

	// 2) 错误令牌 → 403
	resBad, err := http.Get(url + "deadbeef")
	if err != nil {
		t.Fatalf("GET with wrong token: %v", err)
	}
	resBad.Body.Close()
	if resBad.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 with wrong token, got %d", resBad.StatusCode)
	}

	// 3) 正确令牌 → 200 且内容一致（含 Range 请求仍工作）
	resRange, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET with token: %v", err)
	}
	defer resRange.Body.Close()
	if resRange.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 with token, got %d", resRange.StatusCode)
	}
	got, _ := io.ReadAll(resRange.Body)
	if string(got) != "fake-video-bytes" {
		t.Fatalf("unexpected body: %q", string(got))
	}
}

func stripQuery(url string) string {
	if i := strings.Index(url, "?"); i >= 0 {
		return url[:i]
	}
	return url
}
