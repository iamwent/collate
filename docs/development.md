# 开发与发布

## 开发与验证

依赖 Go（版本见 `go.mod`）与 Bun（版本见 `package.json` 的 `packageManager`）。在项目根目录执行以下命令；安装时使用已提交的锁文件，避免依赖版本意外变化：

```sh
bun install --frozen-lockfile
bun run dev           # MyGo 桌面开发
bun run dev:web       # 浏览器开发预览
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
| push 到 `main` | macOS、Windows 分别安装锁定依赖，检查 Go 依赖和生成绑定，运行 Bun/Go 测试、MyGo vet、前端构建及原生编译 | 不打安装包，不创建 Release |
| push tag | 校验版本、重复执行两端 CI，成功后构建 macOS 与 Windows 安装包，统一发布到该 tag 的 GitHub Release | macOS 通用 DMG、完整 `.app` 的 ZIP、Windows x64 安装包、SHA-256 清单 |

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
- `collate-0.1.0-windows-x64-setup.exe`：包含 MyGo 安装程序和微软官方 WebView2 Evergreen x64 离线安装程序；检测到缺少 WebView2 或版本低于 140 时先安装运行时，再安装应用，无需用户单独下载依赖。运行时下载只发生在构建阶段，并检查微软 Authenticode 签名。安装器沿用 MyGo 的每用户安装、快捷方式与卸载注册。
- `SHA256SUMS.txt`：上述三个资产的 SHA-256 校验值。

PDF.js 使用带兼容性补丁的 legacy 构建，以适配系统 WebKit；macOS 包最低要求 15.0（Safari/WebKit 18）。Windows x64 使用 WebView2 140 或更新版本。

安装后无需 Go、Bun 或 Node.js。Windows 最终安装包由 `scripts/release/windows-installer.nsi` 包装 MyGo 产物；`windows.ps1` 负责获取并校验离线依赖、编译安装包，`test-windows.ps1` 验证安装、应用启动和卸载。共享 WebView2 运行时在卸载 Collate 时保留，避免影响其他应用。

### 权限和首次运行限制

当前没有 Apple Developer ID 和 Windows 发布者签名证书，工作流不要求额外 Secrets，仅最终发布 job 使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，其余 job 只读。仓库或组织须允许 Actions 运行和该发布权限。

macOS 应用目前只有 ad-hoc 签名，没有 Apple 公证；Windows 外层安装包及应用目前未作发布者签名。因此，**不能保证从互联网下载后首次打开无安全提示**：macOS 可能被 Gatekeeper 阻止，Windows 可能显示未知发布者或 SmartScreen 提示。完整依赖打包不能替代代码签名。未来取得发布凭据后，应通过 GitHub Secrets 接入 Developer ID 签名与公证、Windows 代码签名，并验证真实下载与首次启动；不要把证书或密码提交到仓库。

Release 使用的固定安装说明见 [release-notes.md](release-notes.md)，会与 GitHub 自动生成的变更说明一起展示。
