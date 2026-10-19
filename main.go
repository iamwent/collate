package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/egoist/mygo"
)

// Files saves exports through the native file chooser.
type Files struct{}

// Save returns false when the user cancels. Data is a base64 PDF or ZIP.
func (Files) Save(name, data string) (bool, error) {
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".pdf" && ext != ".zip" {
		return false, fmt.Errorf("不支持的导出格式")
	}
	bytes, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return false, fmt.Errorf("无法解码导出文件: %w", err)
	}
	path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Parent: mygo.FocusedWindow(), Title: "导出文件", DefaultPath: filepath.Base(name),
		Filters: []mygo.FileFilter{{Name: strings.ToUpper(ext[1:]), Extensions: []string{ext[1:]}}},
	})
	if err != nil || path == "" {
		return false, err
	}
	if filepath.Ext(path) == "" {
		path += ext
	}
	// Write beside the destination, then rename so a failed write never truncates it.
	file, err := os.CreateTemp(filepath.Dir(path), ".collate-*")
	if err != nil {
		return false, err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(bytes); err != nil {
		file.Close()
		return false, err
	}
	if err = file.Close(); err != nil {
		return false, err
	}
	if err = os.Rename(file.Name(), path); err != nil {
		return false, err
	}
	return true, nil
}

func main() {
	mygo.Bind(Files{})
	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{
			Title: "Collate · PDF 页面工具", Width: 1200, Height: 800,
			MinWidth: 760, MinHeight: 560, BackgroundColor: "#f5f5f2",
			StateKey: "main", URL: "/",
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
