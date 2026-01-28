import { fetchESPNScoreboard } from './espnApiClient';

(async () => {
  try {
    // Check recent dates for Lakers games
    const dates = ['2026-01-22', '2026-01-23', '2026-01-24', '2026-01-25'];

    console.log('Checking for Lakers games in ESPN data...\n');

    for (const date of dates) {
      const games = await fetchESPNScoreboard(date);
      const lakersGames = games.filter(g =>
        g.competitions[0].competitors.some(t =>
          t.team.abbreviation === 'LAL' || t.team.displayName?.includes('Lakers')
        )
      );

      if (lakersGames.length > 0) {
        console.log(`${date}: Found ${lakersGames.length} Lakers game(s)`);
        lakersGames.forEach(g => {
          const home = g.competitions[0].competitors.find(c => c.homeAway === 'home');
          const away = g.competitions[0].competitors.find(c => c.homeAway === 'away');
          console.log(`  ${away?.team.abbreviation} @ ${home?.team.abbreviation}`);
          console.log(`  Home: ${home?.team.displayName}, Away: ${away?.team.displayName}`);
        });
      } else {
        console.log(`${date}: No Lakers games found (${games.length} total games)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
