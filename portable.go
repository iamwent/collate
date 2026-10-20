package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/egoist/mygo"
)

func configurePortable() error {
	if runtime.GOOS != "windows" {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return configurePortableAt(exe)
}

// The marker is resolved beside the executable, never against the working
// directory. Installed builds without it keep all MyGo defaults.
func configurePortableAt(exe string) error {
	marker := filepath.Join(filepath.Dir(exe), "collate.portable")
	info, err := os.Stat(marker)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read portable marker: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("portable marker must be a file: %s", marker)
	}
	root := filepath.Join(filepath.Dir(exe), "Data")
	paths := map[mygo.PathName]string{
		mygo.PathAppData:  filepath.Join(root, "AppData"),
		mygo.PathUserData: filepath.Join(root, "Settings"),
		mygo.PathCache:    filepath.Join(root, "Cache"),
		mygo.PathLogs:     filepath.Join(root, "Logs"),
		mygo.PathTemp:     filepath.Join(root, "Temp"),
	}
	// MyGo 0.5.5 derives the WebView2 profile directly from LOCALAPPDATA,
	// independently of App.SetPath. Override only this process's environment.
	local := filepath.Join(root, "LocalAppData")
	for _, dir := range append([]string{local}, mapPaths(paths)...) {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("create portable data directory: %w", err)
		}
		probe, err := os.CreateTemp(dir, ".write-check-*")
		if err != nil {
			return fmt.Errorf("portable directory must be writable (%s): %w", dir, err)
		}
		probe.Close()
		if err := os.Remove(probe.Name()); err != nil {
			return err
		}
	}
	// Override inherited WebView2 profile settings too; a host-level setting must
	// not silently redirect a portable copy into another app's profile.
	env := map[string]string{
		"APPDATA":                   paths[mygo.PathAppData],
		"LOCALAPPDATA":              local,
		"TEMP":                      paths[mygo.PathTemp],
		"TMP":                       paths[mygo.PathTemp],
		"WEBVIEW2_USER_DATA_FOLDER": filepath.Join(local, "collate", "WebView2"),
	}
	for key, value := range env {
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	mygo.App.SetName("collate")
	for key, value := range paths {
		mygo.App.SetPath(key, value)
	}
	return nil
}

func mapPaths(paths map[mygo.PathName]string) []string {
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		result = append(result, path)
	}
	return result
}
