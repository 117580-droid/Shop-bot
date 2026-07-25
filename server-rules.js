const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] server-rules/${context}: ${err?.message ?? err}`);
}

// ─── Safe interaction reply ───────────────────────────────────────────────────
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    logError('safeReply', err);
  }
}

// ─── Rules data ────────────────────────────────────────────────────────────────
// Each entry becomes a field in the embed: { name, value }
const RULES = [
  {
    name: '#1 Be Respectful & Friendly',
    value: 'No toxic behavior, no hate-speech, racism & harassment will not be tolerated. Warns and Mutes will be given to those who do not follow this rule.',
  },
  {
    name: '#2 Do not start drama, settle it in DMs',
    value: "Any issues with other users, settle it in DM's.",
  },
  {
    name: '#3 No Spamming',
    value: 'We have a bot that helps us protect the community against spam. However in general, There is no need for spam of any type, including memes or images which are unrelated.',
  },
  {
    name: '#4 Do not expose private information of other members',
    value: 'Doxing or threatening to dox other members will lead to permanent bans. This includes the use of IP grabbers.',
  },
  {
    name: '#5 Nicknames',
    value: "No hoisting (adding special characters to your name to appear at the top of the user list), Please include at least two alphanumeric characters in your nickname so moderators can mention you, You may be asked to change your nickname if we believe it's unfit for our community.",
  },
  {
    name: '#6 English Only',
    value: 'This is so that staff can moderate everything properly.',
  },
  {
    name: '#7 No self advertising',
    value: "This includes any social media, channels or platforms of your own. Advertising in DM's to our members is not allowed.",
  },
  {
    name: '#8 Follow staff instructions',
    value: 'Our moderation team is here to keep our community safe & in order. Do not argue with them, they have permission to warn and mute if they seem necessary.',
  },
  {
    name: '#9 Stick to the Theme of Topics',
    value: "Try to avoid spamming unrelated comments, images or memes, don't cause aggravation.",
  },
  {
    name: '#10 No Alts or Ban Evasion',
    value: 'Do not use alternate accounts to bypass bans or mutes, this will lead to warns to your Main Account, a ban to your alts and if the situation is severe, a ban to your main account as well.',
  },
  {
    name: '#11 No Politics or Religion',
    value: 'These topics can cause a lot of drama and arguments, so we ask to avoid them in our community. Do not try and bypass this rule by using code words or indirect references, as this will not be tolerated.',
  },
  {
    name: "#12 Don't backseat moderate",
    value: "Depending on the situation, we'd advise not getting involved in situations meant for our moderation team, although we appreciate it.",
  },
  {
    name: '#13 Use your common sense',
    value: "Just because something isn't mentioned here in the rules, doesn't mean you can get away with it. If our moderation team asks you to stop, they have the right to.",
  },
  {
    name: '#14 Follow the Discord community guidelines',
    value: 'https://dis.gd/guidelines',
  },
];

const FOOTER_TEXT =
  "Warning System: It's important you understand warns cannot be removed, so please use your common sense! " +
  'Your presence in this server implies following these rules, including all further changes. ' +
  'These changes might be done at any time without notice, it is your responsibility to check for them. ' +
  'The Admins and Mods will Mute/Kick/Ban per discretion. If you feel mistreated DM an Admin and we will resolve the issue.\n\n' +
  'Questions? Please DM server staff if you have any questions or need any more info!\n\n' +
  'Thank you for being part of our community!';

// ─── Build the server rules embed(s) ──────────────────────────────────────────
// Embeds support at most 25 fields and 6000 total characters, so a single embed
// comfortably fits all 14 rules. The lengthy footer/notice text is sent as a
// second embed to stay well within Discord's per-embed limits.
function buildRulesEmbeds() {
  const rulesEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📜 Server Rules')
    .setDescription('Please read and follow these rules to maintain a positive community experience.')
    .addFields(RULES)
    .setTimestamp();

  const noticeEmbed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setDescription(FOOTER_TEXT);

  return [rulesEmbed, noticeEmbed];
}

// ─── Slash command definition ─────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('server-rules')
    .setDescription('Post the complete server rules')
    .toJSON(),
];

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleServerRules(interaction) {
  try {
    return await safeReply(interaction, { embeds: buildRulesEmbeds() });
  } catch (err) {
    logError('handleServerRules', err);
    return await safeReply(interaction, {
      content: '❌ Failed to post the server rules.',
      ephemeral: true,
    });
  }
}

module.exports = {
  commands,
  handleServerRules,
};

