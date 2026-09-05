// Replace the !redeem command section with this:

    if (command === 'redeem') {
      if (!message.guild) {
        return await safeReply(message, { content: '❌ This command only works in server channels.' });
      }

      db.prepare(`
        CREATE TABLE IF NOT EXISTS shop_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price INTEGER NOT NULL
        )
      `).run();

      const itemName = args.slice(1).join(' ').trim();

      if (!itemName) {
        return await safeReply(message, {
          content: '❌ Usage: `!redeem <item name>`\\nExample: `!redeem Golden Sword`',
        });
      }

      const item = db.prepare('SELECT id, price FROM shop_items WHERE name = ?').get(itemName);

      if (!item) {
        return await safeReply(message, {
          content: `❌ Item **${itemName}** not found in shop.`,
        });
      }

      const userRow = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(message.author.id);
      const balance = userRow ? userRow.balance : 0;

      if (balance < item.price) {
        return await safeReply(message, {
          content: `❌ You don't have enough gems! You need **${item.price}** gems but only have **${balance}**.`,
        });
      }

      const newBalance = balance - item.price;
      db.prepare('INSERT INTO users (user_id, username, balance) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?')
        .run(message.author.id, message.author.username, newBalance, newBalance);

      // ✅ NOTIFY OWNER - Send DM and @mention in channel
      const OWNER_ID = process.env.OWNER_ID;
      const now = new Date().toLocaleString();
      
      try {
        // Send DM to owner
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🛍️ Purchase Alert!')
              .addFields(
                { name: 'Buyer', value: `<@${message.author.id}> (${message.author.username})`, inline: true },
                { name: 'Item', value: itemName, inline: true },
                { name: 'Price', value: `💎 ${item.price}`, inline: true },
                { name: 'Time', value: now, inline: false }
              )
              .setThumbnail(message.author.avatarURL())
              .setTimestamp()
          ]
        });
      } catch (dmErr) {
        console.error('[ERROR] Failed to send purchase DM to owner:', dmErr.message);
      }

      // Send @mention notification in the channel
      try {
        await message.channel.send({
          content: `<@${OWNER_ID}> 🔔 **Purchase Notification**`,
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle('🛍️ Someone Bought an Item!')
              .addFields(
                { name: 'Buyer', value: `${message.author.username}`, inline: true },
                { name: 'Item', value: itemName, inline: true },
                { name: 'Price', value: `💎 ${item.price}`, inline: true },
                { name: 'Time', value: now, inline: false }
              )
              .setThumbnail(message.author.avatarURL())
              .setTimestamp()
          ]
        });
      } catch (pingErr) {
        console.error('[ERROR] Failed to send purchase ping in channel:', pingErr.message);
      }

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Item Purchased!')
            .addFields(
              { name: 'Item', value: itemName, inline: true },
              { name: 'Price', value: `💎 ${item.price}`, inline: true },
              { name: 'Remaining Balance', value: `💎 ${newBalance}`, inline: true }
            )
            .setTimestamp(),
        ],
      });
    }


    // -- !kick --
    if (command === 'kick') {
      if (!message.member.permissions.has('KickMembers')) {
        return await safeReply(message, {
          content: '❌ You need the **Kick Members** permission to use this command.',
        });
      }

      const target = message.mentions.members.first();
      const reason = args.slice(2).join(' ') || 'No reason provided';

      if (!target) {
        return await safeReply(message, {
          content: '❌ Usage: `!kick @user [reason]`\\nExample: `!kick @John Spam`',
        });
      }

      if (target.id === message.author.id) {
        return await safeReply(message, {
          content: '❌ You cannot kick yourself!',
        });
      }

      if (target.user.bot) {
        return await safeReply(message, {
          content: '❌ You cannot kick bots!',
        });
      }

      if (!message.guild.members.me.permissions.has('KickMembers')) {
        return await safeReply(message, {
          content: '❌ I do not have the **Kick Members** permission!',
        });
      }

      if (target.roles.highest.position >= message.member.roles.highest.position) {
        return await safeReply(message, {
          content: '❌ You cannot kick someone with an equal or higher role than you!',
        });
      }

      try {
        await target.kick(reason);

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('👢 Member Kicked')
              .addFields(
                { name: 'User', value: `${target.user.username}#${target.user.discriminator}`, inline: true },
                { name: 'Kicked By', value: message.author.username, inline: true },
                { name: 'Reason', value: reason, inline: false }
              )
              .setThumbnail(target.user.avatarURL())
              .setTimestamp(),
          ],
        });
      } catch (err) {
        logError('kick', err);
        return await safeReply(message, {
          content: '❌ Failed to kick member. Please try again.',
        });
      }
    }

    // -- !ban --
    if (command === 'ban') {
      if (!message.member.permissions.has('BanMembers')) {
        return await safeReply(message, {
          content: '❌ You need the **Ban Members** permission to use this command.',
        });
      }

      const target = message.mentions.members.first();
      const reason = args.slice(2).join(' ') || 'No reason provided';

      if (!target) {
        return await safeReply(message, {
          content: '❌ Usage: `!ban @user [reason]`\\nExample: `!ban @John Hacking`',
        });
      }

      if (target.id === message.author.id) {
        return await safeReply(message, {
          content: '❌ You cannot ban yourself!',
        });
      }

      if (target.user.bot) {
        return await safeReply(message, {
          content: '❌ You cannot ban bots!',
        });
      }

      if (!message.guild.members.me.permissions.has('BanMembers')) {
        return await safeReply(message, {
          content: '❌ I do not have the **Ban Members** permission!',
        });
      }

      if (target.roles.highest.position >= message.member.roles.highest.position) {
        return await safeReply(message, {
          content: '❌ You cannot ban someone with an equal or higher role than you!',
        });
      }

      try {
        await message.guild.members.ban(target, { reason });

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('🔨 Member Banned')
              .addFields(
                { name: 'User', value: `${target.user.username}#${target.user.discriminator}`, inline: true },
                { name: 'Banned By', value: message.author.username, inline: true },
                { name: 'Reason', value: reason, inline: false }
              )
              .setThumbnail(target.user.avatarURL())
              .setTimestamp(),
          ],
        });
      } catch (err) {
        logError('ban', err);
        return await safeReply(message, {
          content: '❌ Failed to ban member. Please try again.',
        });
      }
    }

  } catch (err) {
    logError(`handleTextCommands [${command}]`, err);
  }
}

module.exports = { handleTextCommands };
