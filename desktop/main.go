package main

import (
	"embed"
	"log"

	desktopconfig "icoo_claw/desktop/internal/config"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	appName        = "Icoo Claw"
	appDescription = "Desktop AI chat client for the icoo gateway"
	appSlug        = "icoo-claw"
	appVersion     = "0.1.0"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	store, err := desktopconfig.NewDefaultStore(appSlug)
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        appName,
		Description: appDescription,
		Services: []application.Service{
			application.NewService(NewConfigService(store)),
			application.NewService(NewSystemService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     appName,
		Frameless: true,
		MinWidth:  1315,
		MinHeight: 1160,
		Width:     1315,
		Height:    1160,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(9, 12, 19),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
