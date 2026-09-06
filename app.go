package main

import (
	"FlexViword/download"
	"FlexViword/media"
	"FlexViword/transcription"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

// SelectVideo 打开文件选择对话框，返回选中的媒体文件路径（视频或音频）
func (a *App) SelectVideo() string {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择媒体文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Media Files", Pattern: "*.mp4;*.mov;*.mkv;*.mp3;*.wav;*.m4a;*.aac;*.ogg;*.opus;*.flac"},
		},
	})

	if err != nil {
		return ""
	}
	return selection
}

// DownloadMedia 用本机 yt-dlp 把在线链接下载到用户下载目录，返回最终文件路径（同步，耗时操作）
func (a *App) DownloadMedia(mediaURL string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	destDir := filepath.Join(home, "Downloads", "FlexViword")
	return download.WithYtDlp(mediaURL, destDir)
}

// MediaFile 文件夹导入的媒体文件条目
type MediaFile struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Size int64  `json:"size"`
	Mime string `json:"mime"`
}

var mediaExts = map[string]string{
	".mp4": "video/mp4", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
	".aac": "audio/aac", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac",
}

// ImportMediaFolder 打开文件夹选择框，返回文件夹顶层（不递归）的媒体文件列表
func (a *App) ImportMediaFolder() ([]MediaFile, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择包含媒体文件的文件夹",
	})
	if err != nil {
		return nil, err
	}
	if dir == "" {
		return nil, nil // 用户取消
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("读取文件夹失败: %w", err)
	}

	var files []MediaFile
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		mime, ok := mediaExts[ext]
		if !ok {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, MediaFile{
			Name: entry.Name(),
			Path: filepath.Join(dir, entry.Name()),
			Size: info.Size(),
			Mime: mime,
		})
	}
	return files, nil
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

// TranscribeAPI 接收 API Key、模型名和音频路径，返回转录文本
func (a *App) TranscribeAPI(apiKey string, model string, audioPath string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("请输入 API Key")
	}
	if audioPath == "" {
		return "", fmt.Errorf("音频路径为空")
	}

	return transcription.TranscribeWithAPI(apiKey, model, audioPath)
}

// GetVideoStreamURL 返回本地视频的流媒体地址，供前端 <video> 播放（支持拖动进度条）
func (a *App) GetVideoStreamURL(videoPath string) (string, error) {
	if videoPath == "" {
		return "", fmt.Errorf("路径为空")
	}
	return media.ServeVideo(videoPath)
}
