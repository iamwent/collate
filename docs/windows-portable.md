# Windows portable / Windows 便携版

Extract the entire ZIP into a writable folder, then run `collate.exe`. Keep `collate.portable` beside the executable: it enables portable storage. Do not run from inside the ZIP. A compatible Microsoft WebView2 Runtime (140+) must already be installed; this archive does not install it. If MyGo cannot find a runtime, Collate displays a native dialog with a link to Microsoft’s download page and exits before opening the workspace. Use Collate's regular installer to set up the runtime if needed.

Unzip and keep the entire folder together, including `Data` when moving or updating. Close Collate and wait for its WebView2 processes to exit before moving or deleting the folder. Deleting `Data` resets settings and caches. No uninstaller or automatic shortcut is created.

解压整个 ZIP 到可写目录，运行 `collate.exe`。同目录的 `collate.portable` 文件启用便携模式，请勿删除，也不要直接从 ZIP 内运行。电脑须已安装 WebView2 140+；便携包不会安装运行时，缺少时显示原生提示，可手动打开微软官方下载页面，或先运行常规安装包安装依赖；提示后退出，不创建网页窗口。

## Data directory / 数据目录

All application-managed persistent settings, WebView2 profile/cache and temporary files are routed beneath the executable's `Data` folder:

- `Data/Settings`: window position/size and application settings.
- `Data/LocalAppData/collate/WebView2`: WebView2 profile, browser preferences and caches.
- `Data/Cache`, `Data/Logs`, `Data/Temp`, `Data/AppData`: reserved application paths and temporary files.

应用管理的设置、缓存和临时文件均定向到上述 `Data` 目录。路径相对于 EXE，而非启动时的工作目录；移动时携带整个目录，关闭应用后方可移动或删除。更新时保留 `Data`，删除它可重置设置。数据目录不可写时提示错误并退出，不回退到用户目录。

PDFs and exports stay at the locations you choose. This does not promise zero Windows artifacts: Windows, antivirus, file dialogs and the shared WebView2 runtime can keep their own history, logs and update data. WebView2 may protect some profile data using Windows user/machine credentials; copying the folder does not guarantee encrypted profile data works on another user account or PC. Collate does not persist the PDF workspace, so export before closing.

PDF 和导出文件保存到用户选择的位置。本便携模式不承诺系统零痕迹：Windows、杀毒软件、文件对话框和共享运行时可能维护自身记录；跨账号或跨电脑时，WebView2 加密数据也不保证可迁移。Collate 不持久保存 PDF 工作台，关闭前请导出结果。
