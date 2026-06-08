package config

import (
	"path/filepath"
	"testing"
)

func TestStoreLoadReturnsDefaultsWhenFileIsMissing(t *testing.T) {
	t.Parallel()

	store := NewStore(filepath.Join(t.TempDir(), "settings.toml"))
	settings, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if settings.Gateway.BaseURL != "http://127.0.0.1:8080" {
		t.Fatalf("BaseURL = %q", settings.Gateway.BaseURL)
	}
	if len(settings.Projects) != 0 {
		t.Fatalf("Projects length = %d", len(settings.Projects))
	}
	if settings.CurrentProjectID != "" {
		t.Fatalf("CurrentProjectID = %q", settings.CurrentProjectID)
	}
	if !settings.UI.ShowTimestamps {
		t.Fatalf("ShowTimestamps = false, want true")
	}
}

func TestStoreSaveNormalizesAndRoundTrips(t *testing.T) {
	t.Parallel()

	store := NewStore(filepath.Join(t.TempDir(), "settings.toml"))
	_, err := store.Save(Settings{
		Gateway: GatewaySettings{
			BaseURL:        " http://localhost:8088/ ",
			DefaultAgentID: "  agent_main  ",
		},
		Workspace: WorkspaceSettings{
			RootDir: "  E:/workspace/demo  ",
		},
		Projects: []ProjectSettings{
			{ID: " project_1 ", Name: " Demo ", RootDir: " E:/workspace/project-demo "},
			{ID: " project_2 ", Name: " Other ", RootDir: " E:/workspace/other "},
			{ID: " project_1 ", Name: " Duplicate ", RootDir: " E:/workspace/duplicate "},
			{ID: " ", Name: " Invalid ", RootDir: " E:/workspace/invalid "},
		},
		CurrentProjectID: " project_1 ",
		UI: UISettings{
			ShowTimestamps: true,
		},
	})
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if loaded.Gateway.BaseURL != "http://localhost:8088" {
		t.Fatalf("BaseURL = %q", loaded.Gateway.BaseURL)
	}
	if loaded.Gateway.DefaultAgentID != "agent_main" {
		t.Fatalf("DefaultAgentID = %q", loaded.Gateway.DefaultAgentID)
	}
	if loaded.Workspace.RootDir != "E:/workspace/project-demo" {
		t.Fatalf("RootDir = %q", loaded.Workspace.RootDir)
	}
	if len(loaded.Projects) != 2 {
		t.Fatalf("Projects length = %d", len(loaded.Projects))
	}
	if loaded.Projects[0].ID != "project_1" || loaded.Projects[0].Name != "Demo" || loaded.Projects[0].RootDir != "E:/workspace/project-demo" {
		t.Fatalf("Projects[0] = %#v", loaded.Projects[0])
	}
	if loaded.CurrentProjectID != "project_1" {
		t.Fatalf("CurrentProjectID = %q", loaded.CurrentProjectID)
	}
}

func TestStorePreservesWorkspaceRootDirWithoutCurrentProject(t *testing.T) {
	t.Parallel()

	store := NewStore(filepath.Join(t.TempDir(), "settings.toml"))
	_, err := store.Save(Settings{
		Workspace: WorkspaceSettings{
			RootDir: "  E:/workspace/legacy  ",
		},
		Projects: []ProjectSettings{
			{ID: "project_1", Name: "Demo", RootDir: "E:/workspace/project-demo"},
		},
		CurrentProjectID: "missing",
		UI: UISettings{
			ShowTimestamps: true,
		},
	})
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if loaded.Workspace.RootDir != "E:/workspace/legacy" {
		t.Fatalf("RootDir = %q", loaded.Workspace.RootDir)
	}
	if loaded.CurrentProjectID != "" {
		t.Fatalf("CurrentProjectID = %q", loaded.CurrentProjectID)
	}
}
