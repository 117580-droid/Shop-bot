  // Discord data endpoint — returns all servers the bot is in with their members
  if (req.method === 'GET' && req.url === '/api/discord-data') {
    (async () => {
    try {
      const servers = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
      }));

      const members = {};
      const MEMBER_CACHE_FILE = '/data/member_cache.json';

      // Load cached members from file
      let cachedMembers = {};
      try {
        if (fs.existsSync(MEMBER_CACHE_FILE)) {
          const cacheData = fs.readFileSync(MEMBER_CACHE_FILE, 'utf-8');
          cachedMembers = JSON.parse(cacheData);
          log('INFO', `Loaded member cache from file: ${Object.keys(cachedMembers).length} guilds`);
        }
      } catch (cacheErr) {
        log('WARN', `Could not load member cache: ${cacheErr.message}`);
      }

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
          cachedMembers[guild.id] = members[guild.id];
          
          log('INFO', `Filtered to ${members[guild.id].length} non-bot members from ${guild.name}`);
        } catch (err) {
          log('ERROR', `Failed to fetch members for guild ${guild.name} (${guild.id}): ${err.message}`);
          
          // Return cached members if available, otherwise empty array
          members[guild.id] = cachedMembers[guild.id] || [];
          log('INFO', `Using cached members for ${guild.name}: ${members[guild.id].length} members`);
        }
      }

      // Save updated cache to file
      try {
        fs.mkdirSync('/data', { recursive: true });
        fs.writeFileSync(MEMBER_CACHE_FILE, JSON.stringify(cachedMembers, null, 2));
        log('INFO', `Saved member cache to file`);
      } catch (saveErr) {
        log('WARN', `Could not save member cache: ${saveErr.message}`);
      }

      log('INFO', `Discord data: ${servers.length} servers, ${Object.keys(members).length} servers with members`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers, members }));
    } catch (err) {
      logError('callbackServer: discord-data error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Failed to fetch Discord data' }));
    }
    })();
    return;
  }

