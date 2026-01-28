const API_BASE_URL = 'http://localhost:3001/api';

export async function fetchMatches(date: string) {
  const response = await fetch(`${API_BASE_URL}/matches?date=${date}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch matches');
  }

  return response.json();
}

export async function fetchPredictions(matchId: number) {
  const response = await fetch(`${API_BASE_URL}/predictions/${matchId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch predictions');
  }

  return response.json();
}

export async function fetchPlayerStats(playerId: number) {
  const response = await fetch(`${API_BASE_URL}/players/${playerId}/stats`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch player stats');
  }

  return response.json();
}

export async function searchPlayers(query: string) {
  if (query.length < 2) {
    return { success: true, data: [] };
  }

  const response = await fetch(
    `${API_BASE_URL}/players/search?query=${encodeURIComponent(query)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error('Failed to search players');
  }

  return response.json();
}
