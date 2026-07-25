const { EmbedBuilder } = require('discord.js');

// Channel where welcome/farewell messages are posted.
const WELCOME_CHANNEL_ID = '1529359748288479283';

/**
 * Sends a welcome embed to the configured channel when a member joins.
 *
 * @param {import('discord.js').GuildMember} member
 */
async function handleMemberJoin(member) {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('👋 Welcome to Mad Customs!')
      .setDescription(`Welcome, ${member}! We're glad you joined us. Make yourself at home and check out the channels to get started.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[ERROR] handleMemberJoin: ${err?.message ?? err}`);
  }
}

/**
 * Sends a farewell embed to the configured channel when a member leaves.
 *
 * @param {import('discord.js').GuildMember} member
 */
async function handleMemberRemove(member) {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('👋 See You Later!')
      .setDescription(`Thanks for being part of Mad Customs, ${member.user.username}. We hope to see you again soon!`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[ERROR] handleMemberRemove: ${err?.message ?? err}`);
  }
}

module.exports = { handleMemberJoin, handleMemberRemove };
