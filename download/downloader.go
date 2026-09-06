// Package download 链接导入：调用本机 yt-dlp 把在线视频/音频下载到下载目录。
// 前置：用户机器需安装 yt-dlp（https://github.com/yt-dlp/yt-dlp）。
package download

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ErrYtDlpMissing 的错误文本用于前端识别（提示安装 yt-dlp）
const ErrYtDlpMissing = "yt-dlp not found"

// WithYtDlp 把 url 指向的媒体下载到 destDir，返回最终文件路径。
// 同步执行（长视频耗时长，前端以忙态呈现）；--no-playlist 避免误下整个列表。
func WithYtDlp(mediaURL string, destDir string) (string, error) {
	mediaURL = strings.TrimSpace(mediaURL)
	if mediaURL == "" {
		return "", fmt.Errorf("链接为空")
	}
	if !strings.HasPrefix(mediaURL, "http://") && !strings.HasPrefix(mediaURL, "https://") {
		return "", fmt.Errorf("仅支持 http(s) 链接")
	}
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", fmt.Errorf("创建下载目录失败: %w", err)
	}

	outputTemplate := filepath.Join(destDir, "%(title)s.%(ext)s")
	cmd := exec.Command(
		"yt-dlp",
		"-f", "bv*+ba/b",
		"--merge-output-format", "mp4",
		"--no-playlist",
		"--newline",
		"-o", outputTemplate,
		"--print", "after_move:filepath",
		mediaURL,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		// yt-dlp 未安装时 exec 直接失败（可执行文件找不到）
		if isExecNotFound(err) {
			return "", fmt.Errorf("%s: %w", ErrYtDlpMissing, err)
		}
		trimmed := strings.TrimSpace(string(output))
		if len(trimmed) > 400 {
			trimmed = trimmed[len(trimmed)-400:] // 保留尾部错误摘要
		}
		return "", fmt.Errorf("下载失败: %s", trimmed)
	}

	// --print after_move:filepath 的最后一行非空输出即最终路径
	lines := strings.Split(string(output), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		candidate := strings.TrimSpace(lines[i])
		if candidate != "" && !strings.HasPrefix(candidate, "[") {
			if _, err := os.Stat(candidate); err == nil {
				return candidate, nil
			}
		}
	}
	return "", fmt.Errorf("下载完成但未找到输出文件")
}

func isExecNotFound(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "executable file not found") ||
		strings.Contains(msg, "system cannot find the file") ||
		strings.Contains(msg, "no such file or directory")
}
