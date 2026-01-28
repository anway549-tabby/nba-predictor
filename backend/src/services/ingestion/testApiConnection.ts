/**
 * Simple test to check NBA API connectivity
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testAPI() {
  console.log('🔍 Testing NBA API Connection...\n');

  // Test 1: Check if API is reachable
  try {
    console.log('Test 1: Checking API base URL...');
    const response = await axios.get('https://api.balldontlie.io/nba/v1/games', {
      headers: {
        'Authorization': process.env.NBA_API_KEY || ''
      },
      params: {
        per_page: 5
      }
    });
    console.log('✓ API is reachable');
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Data received: ${response.data?.data?.length || 0} games\n`);
  } catch (error: any) {
    console.log('✗ API request failed');
    console.log(`✗ Status: ${error.response?.status}`);
    console.log(`✗ Error: ${error.message}\n`);
  }

  // Test 2: Try with a specific date (2025-26 season)
  try {
    console.log('Test 2: Trying with date parameter (2025-01-22)...');
    const response = await axios.get('https://api.balldontlie.io/nba/v1/games', {
      headers: {
        'Authorization': process.env.NBA_API_KEY || ''
      },
      params: {
        'dates[]': '2025-01-22',
        per_page: 5
      }
    });
    console.log('✓ Request successful');
    console.log(`✓ Games found: ${response.data?.data?.length || 0}\n`);
  } catch (error: any) {
    console.log('✗ Request failed');
    console.log(`✗ Status: ${error.response?.status}`);
    console.log(`✗ Error: ${error.message}\n`);
  }

  // Test 3: Check what the API documentation says
  console.log('\n📖 API Information:');
  console.log('The balldontlie.io API may have changed or requires authentication.');
  console.log('Visit: https://www.balldontlie.io/ to check current API status');
  console.log('\nAlternative: We can create sample/mock data for testing the system.');
}

testAPI();
