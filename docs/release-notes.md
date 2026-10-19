## 下载与安装

- **macOS 15+（Apple Silicon / Intel）**：下载 `macos-universal.dmg`，打开后将 `collate.app` 拖到 Applications；也可下载 `macos-universal.zip`，解压得到完整的 `.app`。ZIP 保留了应用结构和可执行权限。
- **Windows x64**：下载 `windows-x64-setup.exe`，运行安装向导。安装包包含应用资源和微软官方 WebView2 离线安装程序；缺少兼容运行时时会自动安装，无需另行下载。
- 无需安装 Go、Bun 或 Node.js。SHA-256 校验值见 `SHA256SUMS.txt`。

## 当前签名状态

当前版本尚无正式发布证书。macOS 应用使用 ad-hoc 签名，未经过 Apple 公证，首次打开可能被 Gatekeeper 阻止；Windows 安装包未作发布者签名，可能显示未知发布者或 SmartScreen 提示。此版本不能保证首次下载后无提示启动。后续接入 Developer ID 签名、公证和 Windows 代码签名后，再验证正常下载、安装与启动体验。
