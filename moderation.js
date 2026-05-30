const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// ─── Moderation Commands ──────────────────────────────────────────────────────

const commands = [
  // /warn command
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // /kick command
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  // /mute command
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g., 1h, 30m, 1d)').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Reason for mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // /unmute command
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for unmute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // /ban command
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // /website command
  new SlashCommandBuilder()
    .setName('website')
    .setDescription('Get the link to the coin shop website'),
];

async function handleModeration(interaction) {
  const { commandName, user, options } = interaction;
  const targetUser = options.getUser('user');
  const reason = options.getString('reason') || 'No reason provided';
  const guild = interaction.guild;

  try {
    switch (commandName) {
      case 'warn': {
        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ User Warned')
          .setDescription(`${targetUser} has been warned`)
          .addFields(
            { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
            { name: 'Moderator', value: `${user}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Try to DM the user
        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ You have been warned')
                .setDescription(`You were warned in ${guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp()
            ]
          });
        } catch (err) {
          console.log(`Could not DM ${targetUser.tag}`);
        }
        break;
      }

      case 'kick': {
        const member = await guild.members.fetch(targetUser.id);
        await member.kick(reason);

        const embed = new EmbedBuilder()
          .setColor(0xFF6B6B)
          .setTitle('👢 User Kicked')
          .setDescription(`${targetUser} has been kicked`)
          .addFields(
            { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
            { name: 'Moderator', value: `${user}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Try to DM the user
        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('👢 You have been kicked')
                .setDescription(`You were kicked from ${guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp()
            ]
          });
        } catch (err) {
          console.log(`Could not DM ${targetUser.tag}`);
        }
        break;
      }

      case 'mute': {
        const durationStr = options.getString('duration') || '1h';
        const duration = parseDuration(durationStr);

        if (!duration) {
          return await interaction.reply({
            content: '❌ Invalid duration format. Use: 1h, 30m, 1d, etc.',
            ephemeral: true
          });
        }

        const member = await guild.members.fetch(targetUser.id);
        await member.timeout(duration, reason);

        const embed = new EmbedBuilder()
          .setColor(0x4169E1)
          .setTitle('🔇 User Muted')
          .setDescription(`${targetUser} has been muted for ${durationStr}`)
          .addFields(
            { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
            { name: 'Moderator', value: `${user}`, inline: true },
            { name: 'Duration', value: durationStr, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Try to DM the user
        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x4169E1)
                .setTitle('🔇 You have been muted')
                .setDescription(`You were muted in ${guild.name} for ${durationStr}`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp()
            ]
          });
        } catch (err) {
          console.log(`Could not DM ${targetUser.tag}`);
        }
        break;
      }

      case 'unmute': {
        const member = await guild.members.fetch(targetUser.id);
        await member.timeout(null, reason);

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🔊 User Unmuted')
          .setDescription(`${targetUser} has been unmuted`)
          .addFields(
            { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
            { name: 'Moderator', value: `${user}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Try to DM the user
        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔊 You have been unmuted')
                .setDescription(`You were unmuted in ${guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp()
            ]
          });
        } catch (err) {
          console.log(`Could not DM ${targetUser.tag}`);
        }
        break;
      }

      case 'ban': {
        const deleteDays = options.getInteger('delete_days') || 0;
        await guild.members.ban(targetUser.id, { reason, deleteMessageDays: deleteDays });

        const embed = new EmbedBuilder()
          .setColor(0x8B0000)
          .setTitle('🔨 User Banned')
          .setDescription(`${targetUser} has been banned`)
          .addFields(
            { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
            { name: 'Moderator', value: `${user}`, inline: true },
            { name: 'Delete Days', value: deleteDays.toString(), inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Try to DM the user
        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x8B0000)
                .setTitle('🔨 You have been banned')
                .setDescription(`You were banned from ${guild.name}`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp()
            ]
          });
        } catch (err) {
          console.log(`Could not DM ${targetUser.tag}`);
        }
        break;
      }

      case 'website': {
        const embed = new EmbedBuilder()
          .setColor(0x667EEA)
          .setTitle('🌐 Coin Shop Website')
          .setDescription('Visit the coin shop website to manage your coins and shop!')
          .addFields({
            name: 'Website Link',
            value: '[Click here to visit](https://lottery-wheel-website-production.up.railway.app/)',
            inline: false
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  } catch (err) {
    console.error(`Error handling moderation command ${commandName}:`, err);
    await interaction.reply({
      content: '❌ An error occurred while processing this command.',
      ephemeral: true
    });
  }
}

function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([smhd])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

module.exports = { commands, handleModeration };

