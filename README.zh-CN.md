# Collate

[English](README.md) | 简体中文

基于 [MyGo](https://github.com/egoist/mygo) 构建的本地 PDF 页面编辑工具。

## 功能

- **合并**：将多个 PDF 合并为一份文档。
- **拆分**：按页码范围拆分，或每页生成一份 PDF。
- **删除**：删除所选页面。
- **旋转**：以 90° 为单位旋转所选页面。
- **重排**：通过拖动、前后移动或输入页序调整页面顺序。
- **替换**：用另一份 PDF 中的页面替换所选页面。

支持页面缩略图、批量选择、撤销和重做。PDF 文件在设备本地处理。

## 截图

![Collate PDF 页面工作台](docs/images/screenshot.jpg)

## 权限和首次运行限制

- **运行要求**：macOS 15 及以上或 Windows x64，无需安装 Go、Bun 或 Node.js。Windows 安装包包含 WebView2 离线安装程序，会在需要时自动安装运行时。
- **GitHub Actions**：当前配置不要求额外签名 Secrets。只有 Release 发布任务使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，其余任务仅有仓库只读权限；仓库或组织须允许这些 Actions 权限。
- **macOS**：应用当前仅使用 ad-hoc 签名，未经 Apple 公证，从互联网下载后首次打开可能被 Gatekeeper 阻止。
- **Windows**：应用及安装包当前没有发布者代码签名，可能显示未知发布者或 SmartScreen 提示。

只有接入并验证 macOS Developer ID 签名与公证、Windows 发布者代码签名后，才能进一步确认首次下载和启动的体验；当前不能保证首次打开无安全提示。

## 协议

本项目采用 [MIT 协议](LICENSE)。
