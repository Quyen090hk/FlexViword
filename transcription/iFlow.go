package transcription

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type OpenAIResponse struct {
	Text  string `json:"text"`
	Error struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// TranscribeWithAPI 调用 SiliconFlow API 进行转录
func TranscribeWithAPI(apiKey string, audioPath string) (string, error) {
	// 1. 打开音频文件
	file, err := os.Open(audioPath)
	if err != nil {
		return "", fmt.Errorf("无法打开音频文件: %v", err)
	}
	defer file.Close()

	// 2. 准备 Multipart 表单数据
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// 添加文件字段
	part, err := writer.CreateFormFile("file", filepath.Base(audioPath))
	if err != nil {
		return "", err
	}
	_, err = io.Copy(part, file)
	if err != nil {
		return "", err
	}

	// --- 修改点 1: 指定模型为 SenseVoiceSmall ---
	// SiliconFlow 支持的模型 ID
	_ = writer.WriteField("model", "FunAudioLLM/SenseVoiceSmall")

	// 关闭 writer
	err = writer.Close()
	if err != nil {
		return "", err
	}

	// --- 修改点 2: 修改请求地址为 SiliconFlow ---
	url := "https://api.siliconflow.cn/v1/audio/transcriptions"

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// 4. 发送请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 5. 解析响应
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API 错误 (%d): %s", resp.StatusCode, string(respBody))
	}

	var result OpenAIResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %v | 原始内容: %s", err, string(respBody))
	}

	return result.Text, nil
}
