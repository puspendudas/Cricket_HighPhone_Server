import mongoose from 'mongoose';
import axios from 'axios';
import FancyOddsService from '../services/fancyodds.service';

// Define match schema directly to avoid import issues
const matchSchema = new mongoose.Schema({
  gameId: { type: String, required: true, select: true },
  marketId: { type: String, required: true, select: true },
  eventId: { type: String, required: true, select: true },
  eventName: { type: String, required: true, select: true },
  selectionId1: { type: Number, required: false, select: false },
  runnerName1: { type: String, required: false, select: false, default: null },
  selectionId2: { type: Number, required: false, select: false },
  runnerName2: { type: String, required: false, select: false, default: null },
  selectionId3: { type: Number, required: false, select: false },
  runnerName3: { type: String, required: false, select: false, default: null },
  eventTime: { type: String, required: true, select: true },
  inPlay: { type: Boolean, required: false, select: true },
  tv: { type: String, required: false, select: false, default: null },
  m1: { type: String, required: false, select: false, default: null },
  f: { type: String, required: false, select: false, default: null },
  vir: { type: Number, required: false, select: false, default: 0 },
  channel: { type: String, required: false, select: false },
  scoreBoardId: { type: String, required: false, select: false },
  seriesId: { type: String, required: false, select: false },
  seriesName: { type: String, required: true, select: true },
  status: { type: Boolean, required: true, select: true, default: false },
  matchOdds: [{ type: mongoose.Schema.Types.Mixed }],
  bookMakerOdds: [{ type: mongoose.Schema.Types.Mixed }],
  otherMarketOdds: [{ type: mongoose.Schema.Types.Mixed }],
  teams: [{ type: mongoose.Schema.Types.Mixed }],
  declared: { type: Boolean, required: false, select: true, default: false },
  wonby: { type: String, required: false, select: true, default: null }
}, {
  timestamps: true
});

// Import existing models instead of redefining schemas

// Use existing models or create new ones if they don't exist

/**
 * MatchWorkerService for worker thread
 * Handles match and fancy odds operations with full functionality
 */
class MatchWorkerService {
  private match: mongoose.Model<any>;
  private fancyOddsService: FancyOddsService;

  constructor() {
    console.log('MatchWorkerService: Creating MatchWorkerService instance...');

    // Use existing models
    this.match = mongoose.models.Match || mongoose.model('Match', matchSchema);
    this.fancyOddsService = new FancyOddsService();

    console.log('MatchWorkerService: MatchWorkerService created successfully');
  }

  /**
   * Fetch matches from external API and save new ones to database
   */
  public async getMatchByCronJob(): Promise<any[]> {
    try {
      // Check if database is connected
      if (mongoose.connection.readyState !== 1) {
        console.warn('MatchWorkerService: Database not connected, skipping match fetch');
        return [];
      }

      console.log('MatchWorkerService: Fetching matches from external API...');

      const response = await axios.get('https://data.hpterminal.com/cricket/matches', {
        timeout: 15000,
        headers: {
          'User-Agent': 'CricketApp/1.0',
          'Accept': 'application/json'
        }
      });

      const matches = response.data?.data?.data;

      if (!matches || !Array.isArray(matches)) {
        console.warn('MatchWorkerService: No matches data received or invalid format');
        return [];
      }

      // Check for existing matches to avoid duplicates
      const existingMatches = await this.match.find({
        gameId: { $in: matches.map(match => match.gameId) }
      });

      const existingGameIds = existingMatches.map(match => match.gameId);
      const newMatches = matches.filter(match => !existingGameIds.includes(match.gameId));

      if (newMatches.length > 0) {
        await this.match.insertMany(newMatches);
        console.log(`MatchWorkerService: Added ${newMatches.length} new matches`);
      } else {
        console.log('MatchWorkerService: No new matches to add');
      }

      return matches;
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn('MatchWorkerService: Access forbidden - API may require authentication');
      } else if (error.code === 'ECONNABORTED') {
        console.warn('MatchWorkerService: Request timeout for matches API');
      } else {
        console.error('MatchWorkerService: Failed to get match by cron job:', error.message);
      }
      return [];
    }
  }

  /**
   * Update odds for all active matches
   */
  public async getMatchOddsDataByStatusCronJob(): Promise<void> {
    try {
      // Check if database is connected
      if (mongoose.connection.readyState !== 1) {
        console.warn('MatchWorkerService: Database not connected, skipping odds update');
        return;
      }

      // Get all active matches
      const matches = await this.match.find({ status: true });

      if (!matches || matches.length === 0) {
        console.log('MatchWorkerService: No active matches found for odds update');
        return;
      }

      console.log(`MatchWorkerService: Updating odds for ${matches.length} active matches...`);

      let successCount = 0;
      let errorCount = 0;

      // Update odds for each active match
      for (const match of matches) {
        try {
          const response = await axios.get(
            `https://data.hpterminal.com/cricket/odds?gameId=${match.gameId}`,
            {
              timeout: 10000,
              headers: {
                'User-Agent': 'CricketApp/1.0',
                'Accept': 'application/json'
              }
            }
          );

          const data = response.data?.data;

          if (data) {
            // Extract team names from odds data
            const teams = this.extractTeamNames(data);
            if (teams.length > 0) {
              await this.match.findByIdAndUpdate(match._id, {
                teams: teams
              });
            }

            // Update match with odds data
            await this.match.findByIdAndUpdate(match._id, {
              matchOdds: data.matchOdds || [],
              bookMakerOdds: data.bookMakerOdds || [],
              otherMarketOdds: data.otherMarketOdds || []
            });

            // Handle fancyOdds using the proper service
            const fancyOdds = data.fancyOdds;
            if (fancyOdds && fancyOdds.length > 0) {
              try {
                await this.fancyOddsService.bulkCreateOrUpdate(fancyOdds, match._id.toString(), match.gameId);
                console.log(`MatchWorkerService: Updated fancy odds for gameId ${match.gameId}`);
              } catch (error: any) {
                console.error(`MatchWorkerService: Failed to update fancy odds for gameId ${match.gameId}:`, error.message);
              }
            }

            successCount++;
          }
        } catch (error: any) {
          errorCount++;
          if (error.response?.status === 403) {
            console.warn(`MatchWorkerService: Access forbidden for gameId ${match.gameId}`);
          } else if (error.code === 'ECONNABORTED') {
            console.warn(`MatchWorkerService: Timeout for gameId ${match.gameId}`);
          } else {
            console.error(`MatchWorkerService: Failed to update odds for gameId ${match.gameId}:`, error.message);
          }
        }
      }

      console.log(`MatchWorkerService: Odds update completed - Success: ${successCount}, Errors: ${errorCount}`);
    } catch (error: any) {
      console.error('MatchWorkerService: Failed to update match odds:', error.message);
    }
  }

  /**
   * Extract team names from odds data
   */
  private extractTeamNames(data: any): any[] {
    const teams: any[] = [];

    if (data.matchOdds && data.matchOdds.length > 0) {
      const matchOdd = data.matchOdds[0];
      if (matchOdd.runners && matchOdd.runners.length >= 2) {
        teams.push(
          { name: matchOdd.runners[0].runnerName, shortName: matchOdd.runners[0].runnerName },
          { name: matchOdd.runners[1].runnerName, shortName: matchOdd.runners[1].runnerName }
        );
      }
    }

    return teams;
  }

  // Removed bulkCreateOrUpdateFancyOdds method - now using FancyOddsService
}

export default MatchWorkerService;
