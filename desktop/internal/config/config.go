package config

import "strings"

type Settings struct {
	Gateway          GatewaySettings   `json:"gateway" toml:"gateway"`
	Workspace        WorkspaceSettings `json:"workspace" toml:"workspace"`
	Projects         []ProjectSettings `json:"projects" toml:"projects"`
	CurrentProjectID string            `json:"currentProjectId" toml:"current_project_id"`
	UI               UISettings        `json:"ui" toml:"ui"`
}

type GatewaySettings struct {
	BaseURL        string `json:"baseUrl" toml:"base_url"`
	DefaultAgentID string `json:"defaultAgentId" toml:"default_agent_id"`
}

type WorkspaceSettings struct {
	RootDir string `json:"rootDir" toml:"root_dir"`
}

type ProjectSettings struct {
	ID      string `json:"id" toml:"id"`
	Name    string `json:"name" toml:"name"`
	RootDir string `json:"rootDir" toml:"root_dir"`
}

type UISettings struct {
	ShowTimestamps bool `json:"showTimestamps" toml:"show_timestamps"`
}

func DefaultSettings() Settings {
	return Settings{
		Gateway: GatewaySettings{
			BaseURL:        "http://127.0.0.1:8080",
			DefaultAgentID: "",
		},
		Workspace: WorkspaceSettings{},
		Projects:  []ProjectSettings{},
		UI: UISettings{
			ShowTimestamps: true,
		},
	}
}

func (s Settings) Normalize() Settings {
	normalized := DefaultSettings()
	normalized.Gateway.BaseURL = normalizeBaseURL(s.Gateway.BaseURL)
	normalized.Gateway.DefaultAgentID = strings.TrimSpace(s.Gateway.DefaultAgentID)
	normalized.Workspace.RootDir = strings.TrimSpace(s.Workspace.RootDir)
	normalized.Projects = normalizeProjects(s.Projects)
	normalized.CurrentProjectID = normalizeCurrentProjectID(s.CurrentProjectID, normalized.Projects)
	if project := findProject(normalized.Projects, normalized.CurrentProjectID); project != nil {
		normalized.Workspace.RootDir = project.RootDir
	}
	normalized.UI.ShowTimestamps = s.UI.ShowTimestamps
	return normalized
}

func normalizeProjects(projects []ProjectSettings) []ProjectSettings {
	normalized := make([]ProjectSettings, 0, len(projects))
	seen := map[string]struct{}{}

	for _, project := range projects {
		project = ProjectSettings{
			ID:      strings.TrimSpace(project.ID),
			Name:    strings.TrimSpace(project.Name),
			RootDir: strings.TrimSpace(project.RootDir),
		}
		if project.ID == "" || project.Name == "" || project.RootDir == "" {
			continue
		}
		if _, exists := seen[project.ID]; exists {
			continue
		}
		seen[project.ID] = struct{}{}
		normalized = append(normalized, project)
	}

	return normalized
}

func normalizeCurrentProjectID(value string, projects []ProjectSettings) string {
	value = strings.TrimSpace(value)
	if findProject(projects, value) == nil {
		return ""
	}
	return value
}

func findProject(projects []ProjectSettings, projectID string) *ProjectSettings {
	for index := range projects {
		if projects[index].ID == projectID {
			return &projects[index]
		}
	}
	return nil
}

func normalizeBaseURL(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimRight(value, "/")
	return value
}
