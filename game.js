async function handleGame(interaction, updateBalance, client, onWin = null, targetGuild = null) {
  const { commandName, user } = interaction;

  // Read OWNER_ID once at the top of every invocation.
  const OWNER_ID = process.env.OWNER_ID;

  try {

    // /currentpoi ──────────────────────────────────────────────────────────────
    if (commandName === 'currentpoi') {
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎮 Where is foxyboy3?')
            .setDescription(`**foxyboy3** is hiding somewhere on the Fortnite map!\\n\\nUse \\`/guess <poi>\\` to find them and win **🪙 1 point**!\\n\\n*There are **${FORTNITE_POIS.length}** possible POIs across all chapters.*`)
            .setFooter({ text: 'Wrong guesses give you a 1hr 30min cooldown!' })
            .setTimestamp()
        ]
      });
    }

    // /guess ───────────────────────────────────────────────────────────────────
    if (commandName === 'guess') {
      const poi = getCurrentPoi();
      if (!poi || !poi.name) { console.error(`[ERROR] poi is null/undefined, FORTNITE_POIS.length=${FORTNITE_POIS.length}`); return await safeReply(interaction, { content: "❌ Game error: POI not initialized.", ephemeral: true }); }
      // Check if command is being used in the correct channel
      const GUESS_CHANNEL_ID = '1529364927415062618';
      if (interaction.channelId !== GUESS_CHANNEL_ID) {
        return await safeReply(interaction, {
          content: `❌ You can only use /guess in <#${GUESS_CHANNEL_ID}>`,
          ephemeral: true,
        });
      }


      const isOwner = false; // Everyone gets cooldown
      const remaining = getCooldownRemaining(user.id);
      if (remaining > 0) {
        return await safeReply(interaction, {
          content: `⏳ You guessed recently! You can guess again in **${formatMs(remaining)}**.`,
          ephemeral: true,
        });
      }

      // Validate and sanitize the guess input.
      const rawGuess = interaction.options.getString('poi');
      if (!rawGuess) {
        return await safeReply(interaction, { content: '❌ Please provide a POI name to guess.', ephemeral: true });
      }
      const guess = rawGuess.trim().slice(0, 100);
      if (!guess) {
        return await safeReply(interaction, { content: '❌ Your guess cannot be empty.', ephemeral: true });
      }

      // Validate that the guess is a real POI name
      const validPois = FORTNITE_POIS.map(p => p.name.toLowerCase());
      if (!validPois.includes(guess.toLowerCase())) {
        return await safeReply(interaction, { content: `❌ **${guess}** is not a valid POI name. Please guess a real Fortnite location.`, ephemeral: true });
      }

      // Defer the reply so we can edit it multiple times during the animation.
      // All subsequent responses must use editReply / followUp.
      await interaction.deferReply();

      if (guess.toLowerCase() === poi.name.toLowerCase()) {
        // ✅ Correct! — run the wheel animation landing on the winning POI.
        updateBalance(user.id, 1);
        setCooldown(user.id);
        const newPoi = newRandomPoi();

        // Notify any tracked leaderboard messages immediately so the new win
        // shows up without waiting for the next 30-second background tick.
        if (onWin) onWin();

        // Alert owner + secondary user: someone found them — new hiding spot revealed.
        await alertBothUsers(
          client,
          '🎯 Someone Found Madmotherflupa!',
          `**${user.username}** (<@${user.id}>) found Madmotherflupa at **${poi.name}**!\nNew hiding spot: **${newPoi.name}**`,
          0x57F287,
        );

        // Final reveal: correct guess result.
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🎉 Correct!')
              .setThumbnail(poi.image)
              .setDescription(
                `🪙 1 point **${user.username}** found Madmotherflupa in **${poi.name}**\n\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your points!`
              )
              .setFooter({ text: poi.name })
              .setTimestamp()
          ],
        });

      } else {
        // ❌ Wrong guess — run the wheel animation landing on the real POI,
        //    then reveal it with the wrong-guess message.
        const revealedPoi = poi;
        setCooldown(user.id);
        newRandomPoi();

        // Alert owner + secondary user: someone guessed wrong.
        await alertBothUsers(
          client,
          '❌ Wrong Guess!',
          `**${user.username}** (<@${user.id}>) guessed **${guess}** but Madmotherflupa was at **${revealedPoi.name}**.\nNew hiding spot: **${currentPoi.name}**`,
          0xED4245,
        );

        // Final reveal: wrong guess result.
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setThumbnail(revealedPoi.image)
              .setDescription(`**Madmotherflupa** was hiding at **${revealedPoi.name}**`)
              .setFooter({ text: revealedPoi.name })
              .setTimestamp()
          ],
        });
      }
    }

    // /skipcooldown ────────────────────────────────────────────────────────────
    if (commandName === 'skipcooldown') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser('player');

      if (!userCooldowns.has(target.id)) {
        return await safeReply(interaction, {
          content: `ℹ️ **${target.username}** does not have an active cooldown.`,
          ephemeral: true,
        });
      }

      userCooldowns.delete(target.id);
      return await safeReply(interaction, {
        content: `✅ **${target.username}**'s cooldown has been removed — they can guess again!`,
      });
    }

    // /setitem ─────────────────────────────────────────────────────────────────
    if (commandName === 'setitem') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      if (!targetGuild) {
        return await safeReply(interaction, {
          content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/setitem name:Item Name server:My Server Name`',
          ephemeral: true,
        });
      }

      const rawName = interaction.options.getString('name');
      if (!rawName) {
        return await safeReply(interaction, { content: '❌ Please provide an item name.', ephemeral: true });
      }
      const itemName = rawName.trim().slice(0, 200);
      if (!itemName) {
        return await safeReply(interaction, { content: '❌ Item name cannot be empty.', ephemeral: true });
      }

      // Reset the item game state for the new item (scoped to this guild).
      const game = getItemGame(targetGuild.id);
      game.item            = { name: itemName };
      game.hints           = [];
      game.hintDay         = null;
      game.lastHintSentDay = null;
      game.guesses         = [];
      getItemCooldownMap(targetGuild.id).clear();

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎯 Item Game Started')
            .setDescription(`The hidden item has been set to **${itemName}**.\nAll previous hints and guesses have been cleared.`)
            .addFields({ name: 'Server', value: targetGuild.name, inline: true })
            .setFooter({ text: `Set by ${user.username}` })
            .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    // /additemhint ─────────────────────────────────────────────────────────────
    if (commandName === 'additemhint') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      if (!targetGuild) {
        return await safeReply(interaction, {
          content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/additemhint hint:Your hint here server:My Server Name`',
          ephemeral: true,
        });
      }

      const game = getItemGame(targetGuild.id);

      if (!game.item) {
        return await safeReply(interaction, {
          content: '❌ No item game is active. Use `/setitem` first.',
          ephemeral: true,
        });
      }

      const rawHint = interaction.options.getString('hint');
      if (!rawHint) {
        return await safeReply(interaction, { content: '❌ Please provide a hint.', ephemeral: true });
      }
      const hintText = rawHint.trim().slice(0, 500);
      if (!hintText) {
        return await safeReply(interaction, { content: '❌ Hint cannot be empty.', ephemeral: true });
      }

      game.hints.push(hintText);
      const hintNumber = game.hints.length;

      const hintEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`💡 Hint ${hintNumber} Added`)
        .setDescription(`**Hint ${hintNumber}:** ${hintText}`)
        .addFields({ name: 'Server', value: targetGuild.name, inline: true })
        .setFooter({ text: `Added by ${user.username}` })
        .setTimestamp();

      // Post the hint to the specified channel, or fall back to the topmost
      // sendable text channel in the target guild so all players can see it.
      const channelArg = (interaction.options.getString('channel') ?? '').trim();

      // Resolve the target channel: by explicit ID first, then fall back to topmost.
      let sendableChannel = null;
      if (channelArg) {
        // channelArg may be a raw ID or the "Name (id)" format from autocomplete.
        const channelIdMatch = channelArg.match(/(\d{17,20})\)?$/);
        const resolvedId = channelIdMatch ? channelIdMatch[1] : channelArg;
        const resolved = targetGuild.channels.cache.get(resolvedId);
        if (resolved && resolved.isTextBased() && !resolved.isThread() &&
            resolved.permissionsFor(targetGuild.members.me)?.has('SendMessages')) {
          sendableChannel = resolved;
      try {
        const poi = getCurrentPoi();
        console.log(`[DEBUG] /guess - poi is:`, poi);
        if (!poi) {
          console.error(`[ERROR] /guess - getCurrentPoi() returned falsy: ${JSON.stringify(poi)}`);
          console.error(`[ERROR] /guess - FORTNITE_POIS.length: ${FORTNITE_POIS.length}`);
          return await safeReply(interaction, { content: '❌ Game not initialized. Try again.', ephemeral: true });
        }
        
        // Check if command is being used in the correct channel
        const GUESS_CHANNEL_ID = '1529364927415062618';
        if (interaction.channelId !== GUESS_CHANNEL_ID) {
          return await safeReply(interaction, {
            content: `❌ You can only use /guess in <#${GUESS_CHANNEL_ID}>`,
            ephemeral: true,
          });
        }


        const isOwner = false; // Everyone gets cooldown
        const remaining = getCooldownRemaining(user.id);
        if (remaining > 0) {
          return await safeReply(interaction, {
            content: `⏳ You guessed recently! You can guess again in **${formatMs(remaining)}**.`,
            ephemeral: true,
          });
        }

        // Validate and sanitize the guess input.
        const rawGuess = interaction.options.getString('poi');
        if (!rawGuess) {
          return await safeReply(interaction, { content: '❌ Please provide a POI name to guess.', ephemeral: true });
        }
        const guess = rawGuess.trim().slice(0, 100);
        if (!guess) {
          return await safeReply(interaction, { content: '❌ Your guess cannot be empty.', ephemeral: true });
        }

        // Validate that the guess is a real POI name
        const validPois = FORTNITE_POIS.map(p => p.name.toLowerCase());
        if (!validPois.includes(guess.toLowerCase())) {
          return await safeReply(interaction, { content: `❌ **${guess}** is not a valid POI name. Please guess a real Fortnite location.`, ephemeral: true });
        }

        // Defer the reply so we can edit it multiple times during the animation.
        // All subsequent responses must use editReply / followUp.
        await interaction.deferReply();

        if (guess.toLowerCase() === poi.name.toLowerCase()) {
          // ✅ Correct! — run the wheel animation landing on the winning POI.
          updateBalance(user.id, 1);
          setCooldown(user.id);
          const newPoi = newRandomPoi();

          // Notify any tracked leaderboard messages immediately so the new win
          // shows up without waiting for the next 30-second background tick.
          if (onWin) onWin();

          // Alert owner + secondary user: someone found them — new hiding spot revealed.
          await alertBothUsers(
            client,
            '🎯 Someone Found Madmotherflupa!',
            `**${user.username}** (<@${user.id}>) found Madmotherflupa at **${poi.name}**!\\nNew hiding spot: **${newPoi.name}**`,
            0x57F287,
          );

          // Final reveal: correct guess result.
          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🎉 Correct!')
                .setThumbnail(poi.image)
                .setDescription(
                  `🪙 1 point **${user.username}** found Madmotherflupa in **${poi.name}**\\n\\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your points!`
                )
                .setFooter({ text: poi.name })
                .setTimestamp()
            ],
          });

        } else {

