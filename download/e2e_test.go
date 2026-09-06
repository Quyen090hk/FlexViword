package download

import (
	"os"
	"path/filepath"
	"testing"
)

// 真实网络集成测试：默认跳过（CI 不依赖外网）。
// 运行方式：FLEXVIWORD_E2E=1 go test ./download -run TestBilibiliE2E -v
func TestBilibiliE2E(t *testing.T) {
	if os.Getenv("FLEXVIWORD_E2E") == "" {
		t.Skip("set FLEXVIWORD_E2E=1 to run the real Bilibili download E2E")
	}
	const url = "https://www.bilibili.com/video/BV1GJ411x7h7"
	dest := t.TempDir()
	path, err := WithYtDlp(url, dest)
	if err != nil {
		t.Fatalf("WithYtDlp: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat downloaded file: %v", err)
	}
	if info.Size() < 1024*1024 {
		t.Fatalf("downloaded file too small: %d bytes", info.Size())
	}
	t.Logf("downloaded: %s (%d bytes)", path, info.Size())
	// 保留一份到临时目录外层，供前端转写 E2E 使用
	keep := filepath.Join(os.TempDir(), "flexviword-bili-sample.mp4")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read downloaded: %v", err)
	}
	if err := os.WriteFile(keep, data, 0o644); err != nil {
		t.Fatalf("keep copy: %v", err)
	}
	t.Logf("kept: %s", keep)
}
