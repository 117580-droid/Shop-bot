const { EmbedBuilder } = require('discord.js');

// Channel ID where welcome/farewell messages are sent
const WELCOME_CHANNEL_ID = '1529359748288479283'; // Replace with your actual channel ID

/**
 * Handle member join event - sends welcome message
 * @param {GuildMember} member - The member that joined
 */
async function handleMemberJoin(member) {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    
    if (!channel) {
      console.error(`[WELCOME] Channel ${WELCOME_CHANNEL_ID} not found in guild ${member.guild.name}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('👋 Welcome to Mad Customs!')
      .setDescription(`Welcome **${member.user.username}** to **Mad Customs**!\n\nWe're excited to have you here! Feel free to explore and have fun!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
    });

    console.log(`[WELCOME] Sent welcome message for ${member.user.username} (${member.id})`);
  } catch (err) {
    console.error(`[WELCOME] Error handling member join:`, err);
  }
}

/**
 * Handle member leave event - sends farewell message
 * @param {GuildMember} member - The member that left
 */
async function handleMemberRemove(member) {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    
    if (!channel) {
      console.error(`[FAREWELL] Channel ${WELCOME_CHANNEL_ID} not found in guild ${member.guild.name}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('👋 See You Later!')
      .setDescription(`Goodbye **${member.user.username}**! Thanks for joining our server.\n\nWe hope to see you again soon!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await channel.send({
      embeds: [embed],
    });

    console.log(`[FAREWELL] Sent farewell message for ${member.user.username} (${member.id})`);
  } catch (err) {
    console.error(`[FAREWELL] Error handling member remove:`, err);
  }
}

module.exports = { handleMemberJoin, handleMemberRemove, WELCOME_CHANNEL_ID };

