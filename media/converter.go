package media

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ExtractAudio 从视频文件中提取音频并保存为 WAV 格式 (16kHz, 单声道 - 适合 Whisper)
// 返回生成的音频文件绝对路径
func ExtractAudio(videoPath string) (string, error) {
	//1. 确定输出路径 (同目录下，同文件名，后缀改为 .wav)
	ext := filepath.Ext(videoPath)
	outputName := strings.TrimSuffix(filepath.Base(videoPath), ext) + ".wav"
	outputDir := filepath.Dir(videoPath)
	outputPath := filepath.Join(outputDir, outputName)

	//2. 输出文件覆盖模式
	if _, err := os.Stat(outputPath); err == nil {
		os.Remove(outputPath)
	}

	//3. 构建 ffmpeg 命令
	//-i 输入文件
	//-vn 不处理视频流
	//-acodec pcm_s16le 使用 PCM 16-bit little-endian 编码 (WAV)
	//-ar 16000 采样率 16kHz (Whisper 推荐)
	//-ac 1 单声道
	cmd := exec.Command("ffmpeg", "-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", outputPath)

	//4. 执行命令
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg error: %v, output: %s", err, string(output))
	}
	return outputPath, nil
}
