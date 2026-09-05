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

      // Channel notification removed — purchase alerts are DM-only (owner privacy).

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

