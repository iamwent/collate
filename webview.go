package main

import (
	"log"
	"runtime"

	"github.com/egoist/mygo"
)

const webView2DownloadURL = "https://developer.microsoft.com/microsoft-edge/webview2/#download-section"

// Called once the native application is ready, before creating a web window.
// MyGo's native dialogs work without WebView2; NewWindow with a URL does not.
func requireWindowsWebView() bool {
	if runtime.GOOS != "windows" || mygo.WebViewAvailable() {
		return true
	}
	result, err := mygo.Dialog.Message(mygo.MessageOptions{
		Type:          mygo.MessageWarning,
		Title:         "Collate · 需要 WebView2",
		Message:       "未检测到可用的 Microsoft Edge WebView2 Runtime，Collate 无法启动。",
		Detail:        "请安装 Microsoft Edge WebView2 Runtime（140 或更新版本），然后重新打开 Collate。\n\n可从微软官网下载 Evergreen Runtime，或使用 Collate 常规安装包自动安装依赖。\n\nMicrosoft Edge WebView2 Runtime is required. Install the Evergreen Runtime, then restart Collate.\n\n" + webView2DownloadURL,
		Buttons:       []string{"打开下载页面 / Download", "退出 / Exit"},
		DefaultButton: 1,
		CancelButton:  1,
	})
	if err != nil {
		log.Printf("show WebView2 requirement: %v", err)
		return false
	}
	if result.Button == 0 {
		if err := mygo.Shell.OpenExternal(webView2DownloadURL); err != nil {
			mygo.Dialog.Message(mygo.MessageOptions{
				Type:    mygo.MessageError,
				Title:   "Collate · 打开下载页面失败",
				Message: "请在浏览器中手动打开以下微软官方下载页面，安装 WebView2 后重试。",
				Detail:  webView2DownloadURL + "\n\n" + err.Error(),
			})
		}
	}
	return false
}
