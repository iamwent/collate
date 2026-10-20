package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/egoist/mygo"
)

func portableTestState(t *testing.T) {
	t.Helper()
	base := t.TempDir()
	for _, key := range []string{"APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "WEBVIEW2_USER_DATA_FOLDER"} {
		dir := filepath.Join(base, "inherited-"+key)
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatal(err)
		}
		t.Setenv(key, dir)
	}
	for _, key := range []mygo.PathName{mygo.PathAppData, mygo.PathUserData, mygo.PathCache, mygo.PathLogs, mygo.PathTemp} {
		mygo.App.SetPath(key, "")
		k := key
		t.Cleanup(func() { mygo.App.SetPath(k, "") })
	}
	name := mygo.App.Name()
	t.Cleanup(func() { mygo.App.SetName(name) })
}

func TestInstalledCopyKeepsDefaultPaths(t *testing.T) {
	portableTestState(t)
	before := os.Getenv("LOCALAPPDATA")
	exe := filepath.Join(t.TempDir(), "collate.exe")
	if err := configurePortableAt(exe); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("LOCALAPPDATA") != before {
		t.Fatal("installed environment changed")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(exe), "Data")); !os.IsNotExist(err) {
		t.Fatal("installed copy created portable data")
	}
}

func TestPortableDataFollowsExecutableAndMove(t *testing.T) {
	portableTestState(t)
	base := t.TempDir()
	dir := filepath.Join(base, "便携 copy with spaces")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "collate.portable"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	for _, next := range []string{dir, filepath.Join(base, "moved copy")} {
		if next != dir {
			if err := os.Rename(dir, next); err != nil {
				t.Fatal(err)
			}
			b, err := os.ReadFile(filepath.Join(next, "Data", "Settings", "probe"))
			if err != nil || string(b) != "persist" {
				t.Fatal("settings lost while moving")
			}
		}
		if err := configurePortableAt(filepath.Join(next, "collate.exe")); err != nil {
			t.Fatal(err)
		}
		root := filepath.Join(next, "Data")
		for _, key := range []mygo.PathName{mygo.PathAppData, mygo.PathUserData, mygo.PathCache, mygo.PathLogs, mygo.PathTemp} {
			got, err := mygo.App.Path(key)
			if err != nil {
				t.Fatal(err)
			}
			rel, err := filepath.Rel(root, got)
			if err != nil || rel == ".." || filepath.IsAbs(rel) {
				t.Fatalf("%s escaped portable root: %s", key, got)
			}
			if err := os.WriteFile(filepath.Join(got, "probe"), []byte("persist"), 0o600); err != nil {
				t.Fatal(err)
			}
		}
		expected := filepath.Join(root, "LocalAppData", "collate", "WebView2")
		if os.Getenv("WEBVIEW2_USER_DATA_FOLDER") != expected {
			t.Fatalf("unexpected profile %s", os.Getenv("WEBVIEW2_USER_DATA_FOLDER"))
		}
		if os.Getenv("LOCALAPPDATA") != filepath.Join(root, "LocalAppData") {
			t.Fatal("MyGo profile base escaped root")
		}
	}
	b, err := os.ReadFile(filepath.Join(base, "moved copy", "Data", "Settings", "probe"))
	if err != nil || string(b) != "persist" {
		t.Fatal("portable settings were not retained after moving")
	}
}

func TestPortableFailsInsteadOfFallingBack(t *testing.T) {
	portableTestState(t)
	dir := t.TempDir()
	before := os.Getenv("LOCALAPPDATA")
	os.WriteFile(filepath.Join(dir, "collate.portable"), nil, 0o600)
	os.WriteFile(filepath.Join(dir, "Data"), []byte("blocks directory"), 0o600)
	if err := configurePortableAt(filepath.Join(dir, "collate.exe")); err == nil {
		t.Fatal("expected error for unwritable data root")
	}
	if os.Getenv("LOCALAPPDATA") != before {
		t.Fatal("failed setup changed environment")
	}
}
