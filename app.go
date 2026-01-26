package main

import (
	"FlexViword/media"
	"FlexViword/transcription"
	"context"
	"fmt"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SelectVideo 打开文件选择对话框，返回选中的视频文件路径
func (a *App) SelectVideo() string {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择 MP4 视频文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Video Files", Pattern: "*.mp4;*.mov;*.mkv"},
		},
	})

	if err != nil {
		return ""
	}
	return selection
}

// ConvertToAudio 将选中的视频文件转换为音频文件，返回生成的音频文件路径
func (a *App) ConvertToAudio(videoPath string) (string, error) {
	if videoPath == "" {
		return "", fmt.Errorf("路径为空")
	}

	audioPath, err := media.ExtractAudio(videoPath)
	if err != nil {
		return "", err
	}

	absPath, _ := filepath.Abs(audioPath)
	return absPath, nil
}

// TranscribeAPI 接收 API Key 和音频路径，返回转录文本
func (a *App) TranscribeAPI(apiKey string, audioPath string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("请输入 API Key")
	}
	if audioPath == "" {
		return "", fmt.Errorf("音频路径为空")
	}

	return transcription.TranscribeWithAPI(apiKey, audioPath)
}
