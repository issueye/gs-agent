package main

import (
	"os"
	"runtime"
)

type AppInfo struct {
	Name          string `json:"name"`
	Version       string `json:"version"`
	GoVersion     string `json:"goVersion"`
	OS            string `json:"os"`
	Arch          string `json:"arch"`
	UserConfigDir string `json:"userConfigDir"`
}

type SystemService struct{}

func NewSystemService() *SystemService {
	return &SystemService{}
}

func (s *SystemService) GetAppInfo() (*AppInfo, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	return &AppInfo{
		Name:          appName,
		Version:       appVersion,
		GoVersion:     runtime.Version(),
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		UserConfigDir: configDir,
	}, nil
}
