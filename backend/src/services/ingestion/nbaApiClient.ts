/**
 * NBA Data API Client
 *
 * Fetches NBA game data from balldontlie.io API
 * Requires API key authentication
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://api.balldontlie.io';
const API_KEY = process.env.NBA_API_KEY;

// Create axios instance with default headers
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});

/**
 * NBA Game interface (from balldontlie.io API)
 */
export interface NBAGame {
  id: number;
  date: string;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  status: string;
  home_team_score?: number;
  visitor_team_score?: number;
}

/**
 * NBA Player Stats interface (from balldontlie.io API)
 */
export interface NBAPlayerStats {
  player: {
    id: number;
    first_name: string;
    last_name: string;
  };
  team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  game: {
    id: number;
    date: string;
  };
  min: string;  // Format: "35:20" (35 minutes, 20 seconds)
  pts: number;  // Points
  reb: number;  // Total rebounds
  ast: number;  // Assists
}

/**
 * Fetch games for a specific date
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of NBA games
 */
export async function fetchGames(date: string): Promise<NBAGame[]> {
  try {
    console.log(`Fetching games for ${date}...`);

    const response = await apiClient.get('/nba/v1/games', {
      params: {
        'dates[]': date,
        per_page: 100
      }
    });

    const games = response.data.data as NBAGame[];
    console.log(`✓ Found ${games.length} games for ${date}`);

    return games;
  } catch (error) {
    console.error(`✗ Error fetching games for ${date}:`, error);
    throw error;
  }
}

/**
 * Fetch player stats for a specific date
 * @param date - Date in YYYY-MM-DD format
 * @param page - Page number for pagination
 * @returns Array of player stats
 */
export async function fetchPlayerStats(
  date: string,
  page: number = 1
): Promise<NBAPlayerStats[]> {
  try {
    console.log(`Fetching player stats for ${date} (page ${page})...`);

    const response = await apiClient.get('/nba/v1/stats', {
      params: {
        'dates[]': date,
        per_page: 100,
        page
      }
    });

    const stats = response.data.data as NBAPlayerStats[];
    console.log(`✓ Found ${stats.length} player stats for ${date} (page ${page})`);

    return stats;
  } catch (error) {
    console.error(`✗ Error fetching player stats for ${date}:`, error);
    throw error;
  }
}

/**
 * Fetch ALL player stats for a date (handles pagination)
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of all player stats for that date
 */
export async function fetchAllPlayerStats(date: string): Promise<NBAPlayerStats[]> {
  const allStats: NBAPlayerStats[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const stats = await fetchPlayerStats(date, page);

    if (stats.length > 0) {
      allStats.push(...stats);
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`✓ Total player stats fetched for ${date}: ${allStats.length}`);
  return allStats;
}

/**
 * Convert minutes string to integer
 * Example: "35:20" → 35 minutes
 * @param minStr - Minutes string in "MM:SS" format
 * @returns Integer minutes played
 */
export function parseMinutes(minStr: string | null): number {
  if (!minStr || minStr === '') return 0;

  const parts = minStr.split(':');
  if (parts.length === 0) return 0;

  return parseInt(parts[0]) || 0;
}

/**
 * Get date range (for fetching multiple days of data)
 * @param startDate - Start date (YYYY-MM-DD)
 * @param days - Number of days
 * @returns Array of date strings
 */
export function getDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}
