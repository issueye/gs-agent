package config

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/pelletier/go-toml/v2"
)

type Store struct {
	path string
}

func NewDefaultStore(appSlug string) (*Store, error) {
	baseDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Store{
		path: filepath.Join(baseDir, appSlug, "settings.toml"),
	}, nil
}

func NewStore(path string) *Store {
	return &Store{path: path}
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) Load() (Settings, error) {
	settings := DefaultSettings()
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	if err := toml.Unmarshal(data, &settings); err != nil {
		return DefaultSettings(), err
	}
	return settings.Normalize(), nil
}

func (s *Store) Save(settings Settings) (Settings, error) {
	settings = settings.Normalize()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return settings, err
	}
	payload, err := toml.Marshal(settings)
	if err != nil {
		return settings, err
	}
	if err := os.WriteFile(s.path, payload, 0o644); err != nil {
		return settings, err
	}
	return settings, nil
}
