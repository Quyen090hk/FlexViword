package download

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// writeNetscapeCookieFile 是 yt-dlp --cookies 的输出适配器，格式必须正确
func TestWriteNetscapeCookieFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cookies.txt")
	cookies := []collectedCookie{
		{name: "buvid3", value: "abc123", domain: ".bilibili.com", path: "/", secure: true, expires: time.Unix(1900000000, 0)},
		{name: "session", value: "xyz", domain: "bilibili.com", path: "/", expires: time.Unix(1900000000, 0)},
	}
	if err := writeNetscapeCookieFile(path, cookies); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 4 { // 2 行头 + 2 条 cookie
		t.Fatalf("unexpected line count: %d", len(lines))
	}
	// Netscape 格式按 TAB 分隔，字段顺序：domain includeSub path secure expiry name value
	first := strings.Split(lines[2], "\t")
	if first[0] != ".bilibili.com" || first[1] != "TRUE" || first[5] != "buvid3" || first[6] != "abc123" {
		t.Fatalf("unexpected cookie line: %q", lines[2])
	}
	second := strings.Split(lines[3], "\t")
	// host-only cookie 也统一补前导点
	if second[0] != ".bilibili.com" || second[1] != "TRUE" || second[3] != "FALSE" {
		t.Fatalf("unexpected host line: %q", lines[3])
	}
}

// parseSetCookie 保留 Domain/Path 属性（host-only 缺省为响应主机 + "/"）
func TestParseSetCookie(t *testing.T) {
	cc, ok := parseSetCookie(
		"buvid3=abc; Domain=.bilibili.com; Path=/; Secure; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
		"www.bilibili.com",
	)
	if !ok || cc.name != "buvid3" || cc.value != "abc" {
		t.Fatalf("parse failed: %+v", cc)
	}
	if cc.domain != "bilibili.com" || !cc.secure {
		t.Fatalf("domain/secure wrong: %+v", cc)
	}
	if cc.expires.Year() != 2026 {
		t.Fatalf("expires not parsed: %v", cc.expires)
	}

	// 无 Domain/Path 属性 → host-only，path 兜底 "/"
	cc2, ok := parseSetCookie("b_nut=123", "www.bilibili.com")
	if !ok || cc2.domain != "www.bilibili.com" || cc2.path != "/" {
		t.Fatalf("host-only fallback wrong: %+v", cc2)
	}
}

// isBilibiliURL 大小写不敏感
func TestIsBilibiliURL(t *testing.T) {
	if !isBilibiliURL("https://www.BILIBILI.com/video/BV1xx") {
		t.Fatal("should match bilibili.com")
	}
	if isBilibiliURL("https://www.youtube.com/watch?v=x") {
		t.Fatal("should not match youtube")
	}
}
