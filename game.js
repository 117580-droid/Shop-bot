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

