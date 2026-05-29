      for (const guild of client.guilds.cache.values()) {
        try {
          log('INFO', `Fetching members for guild: ${guild.name} (${guild.id})`);
          const guildMembers = await guild.members.fetch();
          log('INFO', `Successfully fetched ${guildMembers.size} members from ${guild.name}`);

          members[guild.id] = guildMembers
            .filter(m => !m.user.bot)
            .map(m => ({
              id: m.user.id,
              username: m.user.username,
            }));
          
          // Update cache with fresh members
          memberCache[guild.id] = members[guild.id];
          
          log('INFO', `Filtered to ${members[guild.id].length} non-bot members from ${guild.name}`);
        } catch (err) {
          log('ERROR', `Failed to fetch members for guild ${guild.name} (${guild.id}): ${err.message}`);
          
          // Return cached members if available, otherwise empty array
          members[guild.id] = memberCache[guild.id] || [];
          log('INFO', `Using cached members for ${guild.name}: ${members[guild.id].length} members`);
        }
      }

