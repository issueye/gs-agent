package main

import (
	desktopconfig "icoo_claw/desktop/internal/config"
)

type ConfigPayload struct {
	Path     string                 `json:"path"`
	Settings desktopconfig.Settings `json:"settings"`
}

type ConfigService struct {
	store *desktopconfig.Store
}

func NewConfigService(store *desktopconfig.Store) *ConfigService {
	return &ConfigService{store: store}
}

func (s *ConfigService) LoadSettings() (*ConfigPayload, error) {
	settings, err := s.store.Load()
	if err != nil {
		return nil, err
	}
	return &ConfigPayload{
		Path:     s.store.Path(),
		Settings: settings,
	}, nil
}

func (s *ConfigService) SaveSettings(settings desktopconfig.Settings) (*ConfigPayload, error) {
	saved, err := s.store.Save(settings)
	if err != nil {
		return nil, err
	}
	return &ConfigPayload{
		Path:     s.store.Path(),
		Settings: saved,
	}, nil
}
