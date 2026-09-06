package download

import (
	"errors"
	"strings"
	"testing"
)

// ExecNotFound 识别：未安装 yt-dlp 时的错误必须能被前端区分出来
func TestIsExecNotFound(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"windows missing", errors.New("exec: \"yt-dlp\": executable file not found in %PATH%"), true},
		{"unix missing", errors.New("exec: \"yt-dlp\": no such file or directory"), true},
		{"other error", errors.New("exit status 1: unsupported URL"), false},
	}
	for _, tc := range cases {
		if got := isExecNotFound(tc.err); got != tc.want {
			t.Fatalf("%s: isExecNotFound = %v, want %v", tc.name, got, tc.want)
		}
	}
}

// URL 校验：非 http(s) 直接拒绝
func TestWithYtDlpRejectsNonHTTP(t *testing.T) {
	if _, err := WithYtDlp("javascript:alert(1)", t.TempDir()); err == nil {
		t.Fatal("expected error for non-http url")
	} else if !strings.Contains(err.Error(), "http") {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := WithYtDlp("   ", t.TempDir()); err == nil {
		t.Fatal("expected error for empty url")
	}
}
