package download

import (
	"strings"
	"testing"
)

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
