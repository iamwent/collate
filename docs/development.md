# 开发与发布

## 开发与验证

依赖 Go（版本见 `go.mod`）与 Bun（版本见 `package.json` 的 `packageManager`）。在项目根目录执行以下命令；安装时使用已提交的锁文件，避免依赖版本意外变化：

```sh
bun install --frozen-lockfile
bun run dev           # MyGo 桌面开发
bun run dev:web       # 浏览器开发预览
bun run preview:web   # 预览 dist 中的生产构建
bun run generate      # Go 服务变更后重新生成 src/mygo.ts
bun test              # 六项操作的导出/重读与边界测试
bun run build:web     # TypeScript 检查与前端打包
CGO_ENABLED=0 go test ./...
go run github.com/egoist/mygo/cmd/mygo vet .
bun run build         # 原生应用打包
```

也可用 `bunx mygo build -skip-dmg` 只生成 macOS 应用包。MyGo CLI 与 Go 版本不匹配导致 vet 的 export-data 版本错误时，上述 `go run … vet .` 会用项目 Go 工具链编译同一版本的检查器。

关键文件：`src/pdf.ts` 为页面模型与导出逻辑，`src/main.ts` 为交互和缩略图，`main.go` 为原生保存服务，`vite.config.ts` 负责离线预览资源。生成的 TypeScript 服务绑定保留在 `src/mygo.ts`，不要手动编辑。


## 仓库约定

- 提交 `go.mod`、`go.sum` 和 `bun.lock`，保持 Go 与前端依赖可复现。
- 提交源码、`resources/` 图标、测试，以及生成的 `src/mygo.ts` 服务绑定。修改 Go 服务后运行 `bun run generate`，并一并提交绑定变化。
- `.agents/skills/mygo-maintenance/` 是项目共享的 MyGo 维护规范，随仓库保留。
- `.gitignore` 排除 `node_modules/`、`dist/`、`build/`、`release/`、`.mygo/`、测试覆盖率、本地缓存、环境变量文件和系统临时文件。环境变量示例可使用 `.env.example`。
- 本地测试 PDF 和导出结果放入 `tmp/`、`exports/` 或系统临时目录，避免将个人文档提交到仓库。必要的脱敏测试样本可以放入测试目录；当前测试在内存中生成 PDF，无需外部样本。

## 当前验证状态

已验证六项操作组合后的导出与重新读取、拆分结果、批量移动和非法页码等边界处理；浏览器中已检查缩略图、旋转、替换、重排、合并及导出。拆分 ZIP 已实际解包并确认每份 PDF 的页数。

TypeScript 检查、前端生产构建、Go 测试命令和 MyGo vet 已通过。macOS ARM64 应用已完成本地签名打包并启动；原生保存窗口从选择路径到写入文件的完整流程尚未验证。发布工作流另含 macOS/Windows 启动检查和 Windows 安装/卸载检查；Windows 在本机仅交叉编译和安装器编译验证，尚未实机执行。


## GitHub Actions 与发布

工作流分为两部分：

| 事件 | 自动执行 | 发布产物 |
| --- | --- | --- |
| push 到 `main` | macOS、Windows 分别运行现有测试和编译检查；Linux 独立验证纯浏览器测试和子路径构建 | 不打桌面安装包，不创建 Release；全部检查通过后更新 GitHub Pages |
| push tag | 校验版本、重复执行两端 CI，成功后构建 macOS 与 Windows 安装包，统一发布到该 tag 的 GitHub Release | macOS 通用 DMG、完整 `.app` 的 ZIP、Windows x64 小型安装包与便携 ZIP、SHA-256 清单 |

配置分别位于 [CI](../.github/workflows/ci.yml) 和 [Release](../.github/workflows/release.yml)。Release 不提供手动触发或普通分支触发入口。任一平台的检查、打包、应用启动或 Windows 安装冒烟测试失败，都不会公开新 Release；上传过程中失败则保留草稿供排查。重跑可恢复同 tag 草稿，但不会覆盖已经公开的 Release。

使用 `v1.2.3` 或 `1.2.3` 形式的 tag 发布；`v1.2.3-beta.1` 等预发布 tag 自动标记为 GitHub prerelease。其他 tag 也会触发工作流，但版本校验会失败，不生成安装包。应用版本和产物文件名从 tag 获取，通过 `COLLATE_VERSION` 传给 MyGo；本地默认版本仍为 `0.1.0`。正式版本不接受构建元数据后缀（如 `+build.1`）。

```sh
# 先将要发布的代码提交并推送到 main，再推送版本 tag。
git tag v0.1.0
git push origin v0.1.0
```

发布资产示例：

- `collate-0.1.0-macos-universal.dmg`：适用于 macOS 15 及以上，兼容 Apple Silicon 和 Intel，包含可拖入 Applications 的应用。
- `collate-0.1.0-macos-universal.zip`：解压得到完整 `collate.app`，使用 `ditto` 保留结构与可执行权限。
- `collate-0.1.0-windows-x64-setup.exe`：推荐的小型安装包，包含 MyGo 安装程序与微软官方 Evergreen Bootstrapper。检测到缺少 WebView2 或版本低于 140 时自动联网下载安装运行时；已有兼容版本时不执行引导程序。安装器沿用 MyGo 的每用户安装、快捷方式与卸载注册。构建时验证微软 Authenticode 签名，并限制默认安装包不超过 30 MiB，防止误带完整离线运行时。
- `SHA256SUMS.txt`：上述三个资产的 SHA-256 校验值。

PDF.js 使用带兼容性补丁的 legacy 构建，以适配系统 WebKit；macOS 包最低要求 15.0（Safari/WebKit 18）。Windows x64 使用 WebView2 140 或更新版本。

安装后无需 Go、Bun 或 Node.js。Windows 最终安装包由 `scripts/release/windows-installer.nsi` 包装 MyGo 产物；`windows.ps1` 获取并校验微软引导程序、编译安装包，`test-windows.ps1` 验证安装、应用启动和卸载。共享 WebView2 运行时在卸载 Collate 时保留，避免影响其他应用。

Windows 包体优化采用微软官方的 [WebView2 分发方式](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)：仅提供使用小型引导程序的安装包，缺少兼容运行时时需要联网自动补装。安装时下载微软运行时与 PDF 数据处理无关；编辑和导出仍在本机完成。macOS 使用系统 WebKit，无需捆绑 WebView2。

### 权限和首次运行限制

当前没有 Apple Developer ID 和 Windows 发布者签名证书，工作流不要求额外 Secrets，仅最终发布 job 使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，其余 job 只读。仓库或组织须允许 Actions 运行和该发布权限。

macOS 应用目前只有 ad-hoc 签名，没有 Apple 公证；Windows 外层安装包及应用目前未作发布者签名。因此，**不能保证从互联网下载后首次打开无安全提示**：macOS 可能被 Gatekeeper 阻止，Windows 可能显示未知发布者或 SmartScreen 提示。完整依赖打包不能替代代码签名。未来取得发布凭据后，应通过 GitHub Secrets 接入 Developer ID 签名与公证、Windows 代码签名，并验证真实下载与首次启动；不要把证书或密码提交到仓库。

Release 使用的固定安装说明见 [release-notes.md](release-notes.md)，会与 GitHub 自动生成的变更说明一起展示。


## GitHub Pages 网页版

桌面版和网页版共用页面模型、预览与六项编辑操作。网页版只需构建 Vite 静态资源，无需运行 Go 服务或部署后端；MyGo 原生保存接口仅在桌面窗口中调用，在浏览器中导出为本地下载。

### 首次启用

1. 将包含工作流的代码提交并推送到 GitHub 的 `main` 分支。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**（可在推送前设置）。
3. 等待 `CI` 成功，然后由 `Deploy browser app` 工作流自动构建并部署站点。默认网址为 <https://iamwent.github.io/collate/>。

部署工作流见 [pages.yml](../.github/workflows/pages.yml)。它只接受同仓库 `main` 分支 push 所触发的成功 CI，检出对应的已验证提交后重新构建，不部署 tag 或 PR 的产物。`actions/configure-pages` 提供部署路径，`COLLATE_WEB_BASE` 将该路径传给 Vite；仓库子路径与自定义域名均使用同一套资源路径处理。Pages 构建只需读取 Pages 元数据，只有部署 job 授予 `pages: write` 和 `id-token: write`，不需要额外 Secrets。

### 本地验证与路径

```sh
# 模拟 GitHub Pages 的 /collate/ 路径（macOS/Linux shell）。
COLLATE_WEB_BASE=/collate/ bun run build:web
COLLATE_WEB_BASE=/collate/ bun run preview:web
# 打开终端显示的预览地址下的 /collate/。

# 重新生成桌面版使用的根路径资源。
bun run build:web
```

`COLLATE_WEB_BASE` 默认是 `/`，桌面打包保持使用根路径。PDF.js 的 worker 由 Vite 打包，CMap、字体、ICC 与 WASM 资源复制到 `dist/pdf-assets/`，浏览器通过构建时的 base URL 访问，不从第三方 CDN 获取。

### 本地数据和运行范围

网页使用文件选择器或拖放读取用户选择的 PDF，文件内容、编辑状态和撤销历史只在浏览器内存中处理；不上传文件，不使用服务器 API，也不持久保存工作台。导出通过浏览器下载 PDF 或 ZIP。关闭或刷新页面前请导出结果；浏览器可能按自身设置询问下载位置。

首次打开需要网络加载静态程序资源；未配置 Service Worker 或离线缓存，不能保证断网后重新打开网页可用。数据本地处理不等于无需网络加载程序。建议使用最新桌面 Chrome、Edge、Firefox 或 Safari 18+；网页版本不受桌面安装包代码签名与公证的限制。


## 项目入口

侧边栏底部保留本地处理说明，并提供低调的单行下划线文字链接 `GitHub Repository`，悬停提示“在 GitHub 查看项目”，指向 `https://github.com/iamwent/collate` 的 GitHub 项目链接。链接使用 `target="_blank"` 和 `rel="noopener noreferrer"`：网页版在新标签页打开，桌面版通过 MyGo 默认的外链行为打开系统浏览器。窄屏布局中同样显示该入口，保留无障碍标签，无需额外网络图标或 Go 服务接口。


## 应用图标

当前图标使用最初生成的位图 [`resources/collate-icon.png`](../resources/collate-icon.png)，通过 `mygo.config.ts` 的 `icon` 字段指定。桌面 PNG 从最初的 1254×1254 缩放为 1024×1024，并压缩为索引色 PNG，文件约 286 KB（原始文件约 1.30 MB），保留原图设计，不使用 SVG 重绘。图标保留原有边缘质感和透明背景，[原始生成提示词](collate-icon-prompt.txt)保留供参考。

网页单独使用从原图缩放的 `resources/collate-icon-web.webp`（102×102，约 2.8 KB），覆盖品牌图标 34×34 像素显示尺寸的 3 倍像素密度；浏览器标签页使用 `resources/favicon.png`（32×32 PNG，约 2.4 KB）。品牌图片使用空 `alt`，由品牌链接提供无障碍名称。

MyGo 将 PNG 源图转换为 macOS `.icns` 和 Windows 多尺寸图标，无需手工维护 `.icns` 或 `.ico`。未使用的原始模板图标 `resources/icon.png` 已删除。

README 的中英文版本共用 [`docs/images/screenshot.jpg`](images/screenshot.jpg)，使用用户提供的 macOS 应用首页截图，保留完整标题栏、底部状态栏和原始 2198×1506 像素尺寸，适度压缩为 JPEG，展示当前界面的左上角图标和底部项目链接。更新界面时，应从实际运行的页面重新截图。

## Windows 便携模式

[便携版说明](windows-portable.md)同时打入 ZIP。`scripts/release/windows-portable.ps1` 将原生 EXE、`collate.portable` 标记、协议与说明放入 `Collate Portable` 目录；应用前端资源嵌入 EXE，无需安装器与图标旁载文件。产物为 `collate-<版本>-windows-x64-portable.zip`，与安装包一起发布。它依赖电脑上已有的 WebView2 140+，不会自动安装运行时。`webview.go` 在创建窗口前调用 MyGo 的 `WebViewAvailable()`；未找到运行时时显示原生提示，用户可选择打开微软官网下载页面或退出，然后结束应用，避免直接创建窗口触发 panic。可用性接口不校验版本号，也不保证已安装运行时未损坏。

`portable.go` 在 `App.Run` 前检测 EXE 同目录的标记，将 MyGo 的用户数据、缓存、日志与临时路径，以及当前进程的 `APPDATA`、`LOCALAPPDATA`、`TEMP`、`TMP` 和 WebView2 profile 定向到 EXE 同目录的 `Data` 下。MyGo 0.5.5 的 Windows 后端独立按 `LOCALAPPDATA/collate/WebView2` 创建 profile，仅调用 `App.SetPath` 不足以改变它，因此同时配置当前进程环境；不修改系统或用户的环境变量。安装版不带标记，保持原有路径。数据目录不可写时显示错误并退出，不回退到用户目录。

本地 Go 测试覆盖安装版路径不变、含空格/中文目录、整目录移动后数据保留、继承的 profile 覆盖及写入失败。Release 的 Windows 实机检查脚本 `test-windows-portable.ps1` 从不同工作目录启动真实应用，检查 WebView2 子进程的 `--user-data-dir`、实际 profile 与窗口状态文件、关闭后整目录移动与再次启动，以及原有 AppData 下的 Collate 目录未改变；失败阻止发布。脚本须在 Windows 执行，本机交叉编译或语法检查不等于该实机检查已通过。

此处的便携指应用管理的数据目录可随程序移动，不承诺 Windows、原生文件对话框、杀毒软件及共享运行时不留下系统记录，也不保证 WebView2 加密 profile 跨 Windows 用户或电脑可迁移。PDF 工作台仍仅在内存中，导出位置由用户选择。
