# FlexViword 🎥➡️📝

FlexViword 是一个基于 **Go** 和 **Wails** 构建的现代化跨平台桌面应用。它能够快速读取 MP4 视频文件，提取其中的音频，并利用强大的 AI 模型（SiliconFlow/SenseVoice）将其转换为高精度的文字摘要。

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg) ![Wails](https://img.shields.io/badge/Wails-v2-red.svg)

## ✨ 功能特性

* **跨平台支持**: 原生运行于 Windows, macOS 和 Linux。
* **本地音频提取**: 使用 FFmpeg 在本地极速提取音频，保护隐私。
* **云端 AI 识别**: 集成 SiliconFlow API (SenseVoiceSmall 模型)，识别速度极快，准确率高。
* **简洁 UI**: 基于 Vue 3 构建的现代化用户界面。

## 🛠️ 开发与运行前置要求

在运行本项目之前，请确保你的电脑上已经安装了以下环境：

### 1. 基础环境

* **Go** (版本 1.21 或更高): [下载地址](https://go.dev/dl/)
* **Node.js** (LTS 版本): [下载地址](https://nodejs.org/)
* **Wails CLI**:
  
  ```bash
  go install [github.com/wailsapp/wails/v2/cmd/wails@latest](https://github.com/wailsapp/wails/v2/cmd/wails@latest)
  ```

### 2. FFmpeg (核心依赖)

本项目依赖 FFmpeg 进行音频处理，**必须安装**并添加到系统环境变量中。

* **Windows**:
  1. 下载构建包: [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)
  2. 解压并将 `bin` 文件夹路径添加到系统环境变量 `Path` 中。
  3. 终端输入 `ffmpeg -version` 确认安装成功。
* **macOS**:
  
  ```bash
  brew install ffmpeg
  ```
* **Linux (Arch)**:
  
  ```bash
  sudo pacman -S ffmpeg
  ```
* **Linux (Ubuntu/Debian)**:
  
  ```bash
  sudo apt install ffmpeg
  ```

## 🚀 快速开始

1. **克隆项目**
   
   ```bash
   git clone [https://github.com/Quyen090hk/FlexViword.git](https://github.com/Quyen090hk/FlexViword.git)
   cd FlexViword
   ```

2. **安装依赖**
   
   ```bash
   # 整理 Go 后端依赖
   go mod tidy
   
   # 前端依赖会在首次运行时自动安装，无需手动操作
   ```

3. **运行开发模式**
   
   ```bash
   wails dev
   ```
   
   应用启动后，你可以实时修改代码并看到效果。

4. **构建发布版本 (生成 .exe / .app)**
   
   ```bash
   wails build
   ```
   
   构建产物将位于 `build/bin/` 目录下。

## 🔑 使用说明

1. 启动应用。
2. 在设置栏输入你的 **SiliconFlow API Key**。
   * *还没有 Key？* 请前往 [SiliconFlow 官网](https://cloud.siliconflow.cn/) 注册并创建 API 密钥（新用户通常有免费额度）。
3. 点击 **“选择 MP4 文件”** 上传你的视频。
4. 点击 **“开始提取并识别”**。
5. 稍等片刻，识别后的文字将显示在下方文本框中。
