import BasePlugin from './base-plugin.js';
import { UpdateManager } from '../utils/update-manager.js';
import { COPYRIGHT_MESSAGE } from '../utils/constants.js';
import { fileURLToPath } from 'url';

// UpdateManager configuration for this plugin
// IMPORTANT: Update these constants to match your GitHub repository
const PLUGIN_VERSION = 'v1.0.0';
const GITHUB_OWNER = 'Armyrat60';  // Change to your GitHub username
const GITHUB_REPO = 'SquadJS-Project';  // Change to your repository name

export default class UpdateManagerPlugin extends BasePlugin {
  static get description() {
    return 'Centralized plugin update management with Discord integration using UpdateManager';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      // Discord integration (optional)
      discordClient: {
        required: false,
        description: 'Discord connector name for notifications',
        connector: 'discord',
        default: 'discord'
      },
      channelID: {
        required: false,
        description: 'Discord channel ID for update notifications',
        default: ''
      },
      adminRoleID: {
        required: false,
        description: 'Discord role ID to ping for update notifications',
        default: ''
      },
      
      // Notification settings
      enableUpdateNotifications: {
        required: false,
        description: 'Enable Discord notifications for plugin updates',
        default: true
      },
      enableRestartReminders: {
        required: false,
        description: 'Send restart notifications about required restarts',
        default: true
      },
      
      // Message customization
      updateColor: {
        required: false,
        description: 'Discord embed color for update notifications',
        default: 0x00ff00 // Green
      },
      restartColor: {
        required: false,
        description: 'Discord embed color for restart notifications',
        default: 0xffa500 // Orange
      },
      
      // Batching settings
      batchDelay: {
        required: false,
        description: 'Delay in milliseconds to batch multiple plugin updates (default: 5000ms)',
        default: 5000
      },
      
      // Update check frequency
      updateCheckInterval: {
        required: false,
        description: 'How often to check for updates (5m, 30m, 1h, 1d)',
        default: '30m'
      },
      
      // Reminder settings
      reminderSettings: {
        required: false,
        description: 'Settings for restart reminders',
        default: {
          enabled: false,
          interval: '6h', // 1h, 6h, 12h, 1d
          maxReminders: 3
        }
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    
    this.updateEvents = new Map(); // pluginName -> update event
    this.batchTimer = null;
    this.batchDelay = this.options.batchDelay || 5000; // Configurable batch delay
    
    // Initialize reminder tracking
    this.reminderTimers = new Map(); // pluginName -> reminder timer
    this.reminderCounts = new Map(); // pluginName -> reminder count
    
    // Discord channel (optional)
    this.channel = null;
    
    // Listen for update events from other plugins
    this.onPluginUpdated = this.onPluginUpdated.bind(this);
    this.onRestartRequired = this.onRestartRequired.bind(this);
  }

  async mount() {
    // Initialize Discord if available
    await this.initializeDiscord();
    
    // Set up global event listeners for plugin updates
    this.server.on('PLUGIN_UPDATED', this.onPluginUpdated);
    this.server.on('RESTART_REQUIRED', this.onRestartRequired);
    
    this.verbose(1, 'UpdateManagerPlugin mounted successfully');
    
    // Configure UpdateManager with Discord notifier
    UpdateManager.setDiscordNotifier(this);
    
    // Configure UpdateManager settings
    UpdateManager.configure({
      enabled: true,
      checkInterval: this.parseTimeInterval(this.options.updateCheckInterval),
      initialDelay: 15000,
      batchDelay: this.batchDelay,
      staggerDelay: 5 * 60 * 1000 // 5 minutes between plugin checks
    });
    
    // Register this plugin with UpdateManager
    UpdateManager.registerPlugin(
      'UpdateManagerPlugin',
      PLUGIN_VERSION,
      GITHUB_OWNER,
      GITHUB_REPO,
      fileURLToPath(import.meta.url),
      (message, ...args) => this.verbose(1, message, ...args)
    );
    
    // Add admin commands
    this.server.on('CHAT_COMMAND:!updatecheck', this.onUpdateCheckCommand.bind(this));
    this.server.on('CHAT_COMMAND:!updatestatus', this.onUpdateStatusCommand.bind(this));
    this.server.on('CHAT_COMMAND:!updateplugins', this.onUpdatePluginsCommand.bind(this));
    
    this.verbose(1, `UpdateManagerPlugin will check for updates every ${this.options.updateCheckInterval}`);
  }

  // Initialize Discord connection if available
  async initializeDiscord() {
    try {
      // Check if Discord is properly configured (not just defaults)
      const hasValidDiscord = this.options.discordClient && 
                             typeof this.options.discordClient.channels !== 'undefined' &&
                             this.options.channelID && 
                             this.options.channelID !== '' && 
                             this.options.channelID !== 'default';
      
      if (hasValidDiscord) {
        this.verbose(1, `Attempting to fetch Discord channel: ${this.options.channelID}`);
        this.channel = await this.options.discordClient.channels.fetch(this.options.channelID);
        this.verbose(1, `✅ Discord channel fetched successfully: ${this.channel.name}`);
      } else {
        this.verbose(1, 'Discord not configured - notifications will be disabled');
        this.verbose(1, `Discord client: ${!!this.options.discordClient}, Channel ID: "${this.options.channelID}"`);
      }
    } catch (error) {
      this.channel = null;
      this.verbose(1, `❌ Could not fetch Discord channel: ${error.message}`);
      // Don't throw error - let plugin continue without Discord
    }
  }

  // Send Discord message (if Discord is available)
  async sendDiscordMessage(message) {
    if (!this.channel) {
      this.verbose(2, `Could not send Discord Message. Channel not initialized.`);
      return;
    }

    try {
      if (typeof message === 'object' && 'embed' in message) {
        message.embed.footer = message.embed.footer || { text: COPYRIGHT_MESSAGE };
        if (typeof message.embed.color === 'string')
          message.embed.color = parseInt(message.embed.color, 16);
        message = { ...message, embeds: [message.embed] };
      }

      await this.channel.send(message);
    } catch (error) {
      this.verbose(1, `Failed to send Discord message: ${error.message}`);
      // Don't throw error - continue without Discord
    }
  }

  async unmount() {
    this.server.off('PLUGIN_UPDATED', this.onPluginUpdated);
    this.server.off('RESTART_REQUIRED', this.onRestartRequired);
    
    // Clear any pending batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Clear all reminder timers
    for (const timer of this.reminderTimers.values()) {
      clearTimeout(timer);
    }
    this.reminderTimers.clear();
    this.reminderCounts.clear();
    
    // Remove admin commands
    this.server.off('CHAT_COMMAND:!updatecheck', this.onUpdateCheckCommand);
    this.server.off('CHAT_COMMAND:!updatestatus', this.onUpdateStatusCommand);
    this.server.off('CHAT_COMMAND:!updateplugins', this.onUpdatePluginsCommand);
    
    // Stop UpdateManager
    UpdateManager.stop();
  }

  onPluginUpdated(pluginName, oldVersion, newVersion, backupPath = null) {
    if (!this.options.enableUpdateNotifications) return;
    
    const updateEvent = {
      pluginName,
      oldVersion,
      newVersion,
      backupPath,
      timestamp: new Date(),
      notified: false
    };
    
    this.updateEvents.set(pluginName, updateEvent);
    
    // Clear existing batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    // Set new batch timer to send consolidated notification
    this.batchTimer = setTimeout(() => {
      this.sendBatchUpdateNotification();
    }, this.batchDelay);
    
    // Set up reminder system if enabled
    if (this.options.reminderSettings.enabled) {
      this.setupReminderSystem(pluginName);
    }
  }

  onRestartRequired(pluginName) {
    if (!this.options.enableRestartReminders) return;
    
    // Check if we already sent a notification for this plugin update
    const updateEvent = this.updateEvents.get(pluginName);
    if (updateEvent && updateEvent.notified) {
      // Already sent notification, don't send duplicate
      return;
    }
    
    // Send restart notification only if no update notification was sent
    this.sendRestartNotification(pluginName);
  }

  async sendBatchUpdateNotification() {
    if (!this.channel) return;
    
    const pendingUpdates = Array.from(this.updateEvents.values()).filter(event => !event.notified);
    
    if (pendingUpdates.length === 0) return;
    
    const isSingleUpdate = pendingUpdates.length === 1;
    const updateEvent = pendingUpdates[0];
    
    if (isSingleUpdate) {
      // Single update - use the original format
      await this.sendSingleUpdateNotification(updateEvent);
    } else {
      // Multiple updates - use batch format
      await this.sendMultipleUpdatesNotification(pendingUpdates);
    }
    
    // Mark all as notified
    pendingUpdates.forEach(event => {
      event.notified = true;
    });
  }

  async sendSingleUpdateNotification(updateEvent) {
    if (!this.channel) return;
    
    const embed = {
      title: '🔄 Plugin Update Completed',
      description: `${updateEvent.pluginName} has been successfully updated and requires a SquadJS restart to apply changes.`,
      color: this.options.updateColor,
      fields: [
        { name: 'Plugin', value: updateEvent.pluginName, inline: true },
        { name: 'Version', value: `${updateEvent.oldVersion} → ${updateEvent.newVersion}`, inline: true },
        { name: 'Status', value: 'Update Complete', inline: true },
        { name: 'Backup', value: updateEvent.backupPath ? '✅ Created' : '❌ Failed', inline: true },
        { name: 'Action Required', value: '⚠️ Restart SquadJS', inline: true },
        { name: 'Priority', value: 'Medium', inline: true },
        { name: 'Timestamp', value: updateEvent.timestamp.toLocaleString(), inline: false }
      ],
      footer: { text: 'SquadJS UpdateManager' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} 🔄 Plugin update completed - restart required!`;
    }
    
    await this.sendDiscordMessage(message);
  }

  async sendMultipleUpdatesNotification(updateEvents) {
    if (!this.channel) return;
    
    const embed = {
      title: '🔄 Batch Plugin Updates Completed',
      description: `${updateEvents.length} plugins have been updated and require a SquadJS restart to apply changes.`,
      color: this.options.updateColor,
      fields: [
        ...updateEvents.map(event => ({
          name: event.pluginName,
          value: `${event.oldVersion} → ${event.newVersion}`,
          inline: true
        })),
        { name: 'Total Updates', value: updateEvents.length.toString(), inline: true },
        { name: 'Action Required', value: '⚠️ Restart SquadJS', inline: true },
        { name: 'Priority', value: 'Medium', inline: true },
        { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
      ],
      footer: { text: 'SquadJS UpdateManager - Batch Update' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} 🔄 ${updateEvents.length} plugin updates completed - restart required!`;
    }
    
    await this.sendDiscordMessage(message);
  }

  async sendRestartNotification(pluginName) {
    if (!this.channel) return;
    
    const embed = {
      title: '⚠️ Restart Required',
      description: `${pluginName} has been updated and requires a SquadJS restart to apply changes.`,
      color: this.options.restartColor,
      fields: [
        { name: 'Plugin', value: pluginName, inline: true },
        { name: 'Action Required', value: 'Restart SquadJS', inline: true },
        { name: 'Priority', value: 'Medium', inline: true },
        { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
      ],
      footer: { text: 'SquadJS UpdateManager' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} ⚠️ SquadJS restart required for ${pluginName}!`;
    }
    
    await this.sendDiscordMessage(message);
  }

  async sendPendingUpdatesList() {
    if (!this.channel) return;
    
    const pendingUpdates = Array.from(this.updateEvents.values());
    
    if (pendingUpdates.length === 0) return;
    
    const embed = {
      title: '📋 Plugins Requiring Updates',
      description: 'The following plugins have been updated and require a SquadJS restart:',
      color: this.options.restartColor,
      fields: pendingUpdates.map(event => ({
        name: event.pluginName,
        value: `${event.oldVersion} → ${event.newVersion} (${this.getTimeSinceUpdate(event)})`,
        inline: true
      })),
      footer: { text: 'SquadJS UpdateManager - Pending Updates' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} 📋 Current plugins requiring updates:`;
    }
    
    await this.sendDiscordMessage(message);
  }

  getTimeSinceUpdate(event) {
    const timeDiff = Date.now() - event.timestamp.getTime();
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
  }

  getRolePing() {
    // Check if admin role ID is properly configured (not just defaults)
    if (this.options.adminRoleID && 
        this.options.adminRoleID !== '' && 
        this.options.adminRoleID !== 'default') {
      return `<@&${this.options.adminRoleID}>`;
    }
    return '';
  }

  // Method to manually trigger pending updates list
  async showPendingUpdates() {
    await this.sendPendingUpdatesList();
  }

  // Convert time interval string to milliseconds
  parseTimeInterval(interval) {
    const timeMap = {
      '5m': 5 * 60 * 1000,      // 5 minutes
      '30m': 30 * 60 * 1000,    // 30 minutes
      '1h': 60 * 60 * 1000,     // 1 hour
      '1d': 24 * 60 * 60 * 1000 // 1 day
    };
    
    return timeMap[interval] || timeMap['30m']; // Default to 30m if invalid
  }

  // Convert reminder interval string to milliseconds
  parseReminderInterval(interval) {
    const timeMap = {
      '1h': 60 * 60 * 1000,     // 1 hour
      '6h': 6 * 60 * 60 * 1000, // 6 hours
      '12h': 12 * 60 * 60 * 1000, // 12 hours
      '1d': 24 * 60 * 60 * 1000   // 1 day
    };
    
    return timeMap[interval] || timeMap['6h']; // Default to 6h if invalid
  }

  // Set up reminder system for a plugin
  setupReminderSystem(pluginName) {
    // Clear existing reminder timer for this plugin
    if (this.reminderTimers.has(pluginName)) {
      clearTimeout(this.reminderTimers.get(pluginName));
    }
    
    // Reset reminder count
    this.reminderCounts.set(pluginName, 0);
    
    // Set up first reminder
    const reminderInterval = this.parseReminderInterval(this.options.reminderSettings.interval);
    this.scheduleNextReminder(pluginName, reminderInterval);
  }

  // Schedule the next reminder for a plugin
  scheduleNextReminder(pluginName, delay) {
    const timer = setTimeout(() => {
      this.sendReminderNotification(pluginName);
    }, delay);
    
    this.reminderTimers.set(pluginName, timer);
  }

  // Send a reminder notification
  async sendReminderNotification(pluginName) {
    if (!this.channel) return;
    
    const currentCount = this.reminderCounts.get(pluginName) || 0;
    const maxReminders = this.options.reminderSettings.maxReminders;
    
    if (currentCount >= maxReminders) {
      this.verbose(1, `Max reminders reached for ${pluginName}`);
      return;
    }
    
    // Increment reminder count
    this.reminderCounts.set(pluginName, currentCount + 1);
    
    const embed = {
      title: '⏰ Restart Reminder',
      description: `${pluginName} still requires a SquadJS restart to apply updates.`,
      color: 0xffa500, // Orange
      fields: [
        { name: 'Plugin', value: pluginName, inline: true },
        { name: 'Action Required', value: 'Restart SquadJS', inline: true },
        { name: 'Reminder', value: `${currentCount + 1}/${maxReminders}`, inline: true },
        { name: 'Priority', value: 'Medium', inline: true },
        { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
      ],
      footer: { text: 'SquadJS UpdateManager - Restart Reminder' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} ⏰ Reminder: ${pluginName} still needs restart!`;
    }
    
    await this.sendDiscordMessage(message);
    
    // Schedule next reminder if we haven't reached the limit
    if (currentCount + 1 < maxReminders) {
      const reminderInterval = this.parseReminderInterval(this.options.reminderSettings.interval);
      this.scheduleNextReminder(pluginName, reminderInterval);
    }
  }

  // Validate GitHub configuration
  validateGitHubConfig() {
    if (!GITHUB_OWNER || !GITHUB_REPO) {
      this.verbose(1, '❌ GitHub configuration missing - GITHUB_OWNER or GITHUB_REPO not defined');
      this.verbose(1, '   Please check the constants at the top of UpdateManagerPlugin.js');
      return false;
    }
    
    if (GITHUB_OWNER === 'YOUR_GITHUB_USERNAME' || GITHUB_REPO === 'YOUR_REPOSITORY_NAME') {
      this.verbose(1, '❌ GitHub configuration not customized - using placeholder values');
      this.verbose(1, '   Please update GITHUB_OWNER and GITHUB_REPO constants');
      return false;
    }
    
    this.verbose(1, `✅ GitHub configuration valid: ${GITHUB_OWNER}/${GITHUB_REPO}`);
    return true;
  }

  // Method to manually check for updates
  async checkForUpdates() {
    this.verbose(1, '🔄 Manually checking for updates...');
    await UpdateManager.checkAllPlugins();
  }
  
  // Method to get update status
  getUpdateStatus() {
    return UpdateManager.getUpdateStatus();
  }

  // Special notification for when this plugin needs updating
  async sendSelfUpdateNotification(latestVersion) {
    if (!this.channel) return;
    
    const embed = {
      title: '🔧 UpdateManagerPlugin Update Available',
      description: '**The UpdateManagerPlugin itself has an update available!** This plugin manages all other plugin update notifications.',
      color: 0xff6b6b, // Red color to make it stand out
      fields: [
        { name: 'Current Version', value: PLUGIN_VERSION, inline: true },
        { name: 'Latest Version', value: latestVersion, inline: true },
        { name: 'Status', value: '⚠️ Update Required', inline: true },
        { name: 'Repository', value: `[${GITHUB_REPO}](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO})`, inline: true },
        { name: 'Action Required', value: 'Manual Update + Restart', inline: true },
        { name: 'Priority', value: '🔴 HIGH', inline: true },
        { name: 'Note', value: 'This plugin cannot auto-update itself. Please update manually and restart SquadJS.', inline: false },
        { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
      ],
      footer: { text: 'SquadJS UpdateManager - Self-Update Alert' },
      timestamp: new Date()
    };

    const rolePing = this.getRolePing();
    const message = {
      embed: embed
    };
    
    if (rolePing) {
      message.content = `${rolePing} 🔧 CRITICAL: UpdateManagerPlugin needs updating!`;
    }
    
    await this.sendDiscordMessage(message);
  }
  
  // Admin command handlers
  async onUpdateCheckCommand(info) {
    const player = this.server.getPlayerByEOSID(info.player.eosID);
    if (!player || !this.server.isAdmin(player.steamID)) {
      await this.server.rcon.warn(info.player.eosID, 'You need admin permissions to use this command.');
      return;
    }

    try {
      await this.server.rcon.warn(info.player.eosID, '🔄 Manually checking for updates...');
      await this.checkForUpdates();
      await this.server.rcon.warn(info.player.eosID, '✅ Update check completed');
    } catch (error) {
      await this.server.rcon.warn(info.player.eosID, `❌ Update check failed: ${error.message}`);
    }
  }

  async onUpdateStatusCommand(info) {
    const player = this.server.getPlayerByEOSID(info.player.eosID);
    if (!player || !this.server.isAdmin(player.steamID)) {
      await this.server.rcon.warn(info.player.eosID, 'You need admin permissions to use this command.');
      return;
    }

    try {
      const status = this.getUpdateStatus();
      const message = [
        '=== UPDATE MANAGER STATUS ===',
        `Total Plugins: ${status.totalPlugins}`,
        `Updates Available: ${status.updatesAvailable}`,
        `Last Check: ${status.lastCheck ? status.lastCheck.toLocaleString() : 'Never'}`,
        '',
        '=== PLUGIN STATUS ==='
      ];

      for (const plugin of status.plugins) {
        const statusText = plugin.needsUpdate ? '🔄 Update Available' : 
                          plugin.error ? `❌ Error: ${plugin.error}` : '✅ Up to Date';
        message.push(`${plugin.name}: ${plugin.currentVersion} ${statusText}`);
      }

      await this.sendSplitWarning(player, message.join('\n'));
    } catch (error) {
      await this.server.rcon.warn(info.player.eosID, `❌ Failed to get status: ${error.message}`);
    }
  }

  async onUpdatePluginsCommand(info) {
    const player = this.server.getPlayerByEOSID(info.player.eosID);
    if (!player || !this.server.isAdmin(player.steamID)) {
      await this.server.rcon.warn(info.player.eosID, 'You need admin permissions to use this command.');
      return;
    }

    const args = info.message.split(' ').slice(1);
    if (args.length === 0) {
      await this.server.rcon.warn(info.player.eosID, 'Usage: !updateplugins <plugin-name> or !updateplugins all');
      return;
    }

    try {
      if (args[0].toLowerCase() === 'all') {
        await this.server.rcon.warn(info.player.eosID, '🔄 Updating all plugins...');
        await this.checkForUpdates();
        await this.server.rcon.warn(info.player.eosID, '✅ All plugins update check completed');
      } else {
        const pluginName = args[0];
        await this.server.rcon.warn(info.player.eosID, `🔄 Checking updates for ${pluginName}...`);
        await UpdateManager.checkPluginUpdates(pluginName);
        await this.server.rcon.warn(info.player.eosID, `✅ ${pluginName} update check completed`);
      }
    } catch (error) {
      await this.server.rcon.warn(info.player.eosID, `❌ Update failed: ${error.message}`);
    }
  }

  async sendSplitWarning(player, message, maxLength = 200) {
    try {
      if (message.length <= maxLength) {
        await this.server.rcon.warn(player.eosID, message);
        return;
      }

      const lines = message.split('\n');
      let currentMessage = '';
      
      for (const line of lines) {
        if ((currentMessage + line).length > maxLength) {
          if (currentMessage) {
            await this.server.rcon.warn(player.eosID, currentMessage.trim());
            currentMessage = '';
          }
          
          if (line.length > maxLength) {
            const words = line.split(' ');
            let tempLine = '';
            for (const word of words) {
              if ((tempLine + word).length > maxLength) {
                if (tempLine) {
                  await this.server.rcon.warn(player.eosID, tempLine.trim());
                  tempLine = '';
                }
                tempLine = word + ' ';
              } else {
                tempLine += word + ' ';
              }
            }
            if (tempLine) {
              currentMessage = tempLine;
            }
          } else {
            currentMessage = line + '\n';
          }
        } else {
          currentMessage += line + '\n';
        }
      }
      
      if (currentMessage.trim()) {
        await this.server.rcon.warn(player.eosID, currentMessage.trim());
      }
    } catch (error) {
      this.verbose(1, `Error sending split warning to ${player.name}: ${error.message}`);
    }
  }
}
