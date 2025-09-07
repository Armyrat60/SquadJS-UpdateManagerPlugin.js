# UpdateManagerPlugin

A SquadJS plugin that provides Discord notifications and admin commands for the centralized UpdateManager system. This plugin automatically manages plugin updates and sends notifications when updates are available or completed.

## 📦 Installation

1. Place `UpdateManagerPlugin.js` in your `squad-server/plugins/` directory
2. Add the plugin to your SquadJS configuration
3. Configure Discord settings (optional)

## ✨ Features

- **🔄 Automatic Update Management**: Works with UpdateManager to check for plugin updates
- **📱 Discord Notifications**: Real-time Discord alerts for update events
- **⚡ Admin Commands**: Manual control via Discord chat commands
- **📊 Batch Notifications**: Groups multiple updates into single notifications
- **⏰ Restart Reminders**: Periodic reminders to restart SquadJS after updates
- **🎨 Customizable**: Configurable colors, timing, and notification settings
- **🛡️ Safe Operation**: Graceful handling when Discord is not configured

## 🚀 Quick Start

### 1. Basic Configuration (No Discord)
```json
{
  "plugin": "UpdateManagerPlugin",
  "enabled": true
}
```

### 2. Full Configuration (With Discord)
```json
{
  "plugin": "UpdateManagerPlugin",
  "enabled": true,
  "discordClient": "discord",
  "channelID": "your-discord-channel-id",
  "adminRoleID": "your-admin-role-id",
  "enableUpdateNotifications": true,
  "enableRestartReminders": true,
  "updateCheckInterval": "30m",
  "updateColor": 65280,
  "restartColor": 16753920,
  "reminderSettings": {
    "enabled": true,
    "interval": "1h",
    "maxReminders": 3
  }
}
```

## ⚙️ Configuration Options

### Required Settings
- **`plugin`**: Must be `"UpdateManagerPlugin"`
- **`enabled`**: Enable/disable the plugin

### Discord Integration (Optional)
- **`discordClient`**: Discord connector name (default: `"discord"`)
- **`channelID`**: Discord channel ID for notifications
- **`adminRoleID`**: Discord role ID to ping for notifications

### Notification Settings
- **`enableUpdateNotifications`**: Enable Discord update notifications (default: `true`)
- **`enableRestartReminders`**: Enable restart reminder notifications (default: `true`)

### Timing Settings
- **`updateCheckInterval`**: How often to check for updates
  - Options: `"5m"`, `"30m"`, `"1h"`, `"1d"`
  - Default: `"30m"`

### Visual Settings
- **`updateColor`**: Discord embed color for update notifications (default: `65280` - Green)
- **`restartColor`**: Discord embed color for restart notifications (default: `16753920` - Orange)

### Reminder Settings
- **`reminderSettings.enabled`**: Enable periodic restart reminders (default: `false`)
- **`reminderSettings.interval`**: How often to send reminders
  - Options: `"1h"`, `"6h"`, `"12h"`, `"1d"`
  - Default: `"6h"`
- **`reminderSettings.maxReminders`**: Maximum number of reminders per update (default: `3`)

## 💬 Admin Commands

**Where to use**: Type these commands in your Discord server where the SquadJS bot is running.

### Available Commands

- **`!updatecheck`** - Manually check all plugins for updates
- **`!updatestatus`** - Show current update status for all registered plugins
- **`!updateplugins all`** - Check updates for all plugins (same as !updatecheck)
- **`!updateplugins PluginName`** - Check updates for a specific plugin

### Example Usage
```
!updatecheck
!updatestatus
!updateplugins BM-OverlayMonitor
!updateplugins admin-camera-warnings
```

### Requirements
- UpdateManagerPlugin must be installed and configured
- You must have admin permissions in SquadJS
- Discord bot must be connected and monitoring the channel

## 🔄 How It Works

### 1. Automatic Update Process
1. **Plugin Registration**: Other plugins register with UpdateManager
2. **Periodic Checks**: UpdateManager checks for updates every 30 minutes (configurable)
3. **Update Detection**: When updates are found, they're automatically downloaded
4. **Discord Notification**: UpdateManagerPlugin sends Discord notification
5. **Restart Reminder**: Optional periodic reminders to restart SquadJS

### 2. Notification Types

#### Update Notifications
- **Single Update**: Individual plugin update notification
- **Batch Updates**: Multiple plugins updated together
- **Update Status**: Current status of all registered plugins

#### Restart Notinders
- **Immediate**: Sent when updates are completed
- **Periodic**: Configurable reminders until SquadJS is restarted
- **Maximum Limit**: Stops after reaching max reminder count

### 3. Discord Integration
- **Optional**: Works without Discord (updates still happen, just no notifications)
- **Graceful Degradation**: Continues working if Discord connection fails
- **Role Pings**: Can ping specific Discord roles for important notifications

## 🛠️ Integration with UpdateManager

This plugin works seamlessly with the UpdateManager utility:

1. **Automatic Configuration**: Configures UpdateManager with optimal settings
2. **Event Handling**: Listens for update events from UpdateManager
3. **Discord Notifications**: Formats and sends UpdateManager events to Discord
4. **Admin Commands**: Provides Discord interface for UpdateManager functions

## 📁 File Structure

```
squad-server/
├── plugins/
│   ├── UpdateManagerPlugin.js     ← This plugin
│   ├── YourPlugin.js              ← Your other plugins
│   └── ...
├── utils/
│   └── update-manager.js          ← UpdateManager utility
└── BACKUP-Plugins/                ← Automatic backups
    ├── YourPlugin/
    │   └── YourPlugin.js.backup
    └── ...
```

## 🚨 Important Notes

1. **UpdateManager Required**: This plugin requires the UpdateManager utility to function
2. **Plugin Registration**: Other plugins must register with UpdateManager to be updated
3. **GitHub Releases**: Updates are downloaded from GitHub releases, not commits
4. **Restart Required**: Plugin updates require a SquadJS restart to take effect
5. **Discord Optional**: The plugin works without Discord, but notifications are disabled

## 🐛 Troubleshooting

### Common Issues

**Discord notifications not working?**
- Check Discord channel ID and role ID are correct
- Verify Discord bot has permissions to send messages
- Check console logs for Discord connection errors

**Admin commands not responding?**
- Ensure you have admin permissions in SquadJS
- Check that the plugin is enabled and mounted
- Verify Discord bot is connected and monitoring the channel

**Updates not being checked?**
- Check that other plugins are registered with UpdateManager
- Verify GitHub repository structure matches local structure
- Check console logs for UpdateManager errors

**No updates found?**
- Ensure GitHub repositories have releases with version tags
- Check that plugin versions are properly configured
- Verify GitHub repository URLs are correct

## 📊 Configuration Examples

### Minimal Setup (No Discord)
```json
{
  "plugin": "UpdateManagerPlugin",
  "enabled": true
}
```

### Safe Defaults (Discord Optional)
```json
{
  "plugin": "UpdateManagerPlugin",
  "enabled": true,
  "discordClient": "discord",
  "channelID": "",
  "adminRoleID": "",
  "enableUpdateNotifications": true,
  "enableRestartReminders": true,
  "updateCheckInterval": "30m"
}
```

### Full Discord Setup
```json
{
  "plugin": "UpdateManagerPlugin",
  "enabled": true,
  "discordClient": "discord",
  "channelID": "1411118066464460833",
  "adminRoleID": "1238951374558068820",
  "enableUpdateNotifications": true,
  "enableRestartReminders": true,
  "updateCheckInterval": "30m",
  "updateColor": 65280,
  "restartColor": 16753920,
  "reminderSettings": {
    "enabled": true,
    "interval": "1h",
    "maxReminders": 3
  }
}
```

## 🔗 Related Links

- **UpdateManager Utility**: The core update management system
- **Plugin Development**: How to make your plugins compatible with UpdateManager
- **SquadJS Documentation**: Official SquadJS plugin development guide

## 📄 License

This plugin is part of the SquadJS ecosystem and follows the same licensing terms.

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request!

---

**Need the UpdateManager utility?** This plugin works with the centralized UpdateManager system for automatic plugin updates!
