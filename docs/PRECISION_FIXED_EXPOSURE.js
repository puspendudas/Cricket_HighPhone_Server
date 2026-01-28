/**
 * PRECISION-FIXED EXPOSURE CALCULATION IMPLEMENTATION
 * This implementation addresses floating-point precision issues
 * and provides accurate decimal handling for betting calculations
 */

const { MongoClient } = require('mongodb');

// Utility function to handle decimal precision
function roundToDecimal(num, decimals = 2) {
    return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Utility function for safe decimal arithmetic
function safeAdd(a, b) {
    return roundToDecimal(a + b);
}

function safeSubtract(a, b) {
    return roundToDecimal(a - b);
}

function safeMultiply(a, b) {
    return roundToDecimal(a * b);
}

function safeDivide(a, b) {
    return roundToDecimal(a / b);
}

class PrecisionFixedExposureCalculator {
    constructor() {
        this.client = null;
        this.db = null;
    }

    /**
     * Connect to MongoDB database
     */
    async connect() {
        try {
            this.client = new MongoClient('mongodb://localhost:27017');
            await this.client.connect();
            this.db = this.client.db('cricket_betting');
            console.log('✅ Connected to MongoDB successfully');
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            throw error;
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('✅ Disconnected from MongoDB');
        }
    }

    /**
     * Calculate exposure with precision handling
     * @param {Array} bets - Array of bet objects
     * @returns {Object} - Precise exposure calculation result
     */
    calculatePreciseExposure(bets) {
        let teamAPnL = 0;
        let teamBPnL = 0;

        // Calculate cumulative P&L for each team with precision
        bets.forEach(bet => {
            const { selection, betType, odds, stake } = bet;
            
            if (betType === 'LAY') {
                const liability = safeMultiply(stake, safeDivide(odds, 100));
                if (selection === 'Team A') {
                    teamAPnL = safeSubtract(teamAPnL, liability); // Loss if Team A wins
                    teamBPnL = safeAdd(teamBPnL, stake);          // Win if Team B wins
                } else {
                    teamBPnL = safeSubtract(teamBPnL, liability); // Loss if Team B wins
                    teamAPnL = safeAdd(teamAPnL, stake);          // Win if Team A wins
                }
            } else { // BACK
                const winnings = safeMultiply(stake, safeDivide(odds, 100));
                if (selection === 'Team A') {
                    teamAPnL = safeAdd(teamAPnL, winnings);       // Win if Team A wins
                    teamBPnL = safeSubtract(teamBPnL, stake);     // Loss if Team B wins
                } else {
                    teamBPnL = safeAdd(teamBPnL, winnings);       // Win if Team B wins
                    teamAPnL = safeSubtract(teamAPnL, stake);     // Loss if Team A wins
                }
            }
        });

        // Calculate exposure (maximum potential loss) with precision
        const teamALoss = Math.min(teamAPnL, 0);
        const teamBLoss = Math.min(teamBPnL, 0);
        const maxLoss = Math.max(Math.abs(teamALoss), Math.abs(teamBLoss));
        
        return {
            teamAPnL: roundToDecimal(teamAPnL),
            teamBPnL: roundToDecimal(teamBPnL),
            netExposure: roundToDecimal(Math.abs(teamAPnL - teamBPnL)),
            totalExposure: roundToDecimal(maxLoss),
            maxLoss: roundToDecimal(maxLoss)
        };
    }

    /**
     * Simulate precise wallet update
     * @param {number} currentWallet - Current wallet balance
     * @param {number} currentExposure - Current exposure amount
     * @param {number} newExposure - New exposure amount
     * @returns {Object} - Precise wallet update result
     */
    simulatePreciseWalletUpdate(currentWallet, currentExposure, newExposure) {
        const exposureChange = safeSubtract(newExposure, currentExposure);
        const walletChange = safeSubtract(0, exposureChange); // Opposite of exposure change
        const newWallet = safeAdd(currentWallet, walletChange);

        return {
            exposureChange: roundToDecimal(exposureChange),
            walletChange: roundToDecimal(walletChange),
            newWallet: roundToDecimal(newWallet),
            newExposure: roundToDecimal(newExposure)
        };
    }

    /**
     * Simulate precise automatic settlement
     * @param {number} wallet - Current wallet
     * @param {number} exposure - Current exposure
     * @param {number} pnl - Profit/Loss amount
     * @returns {Object} - Precise settlement result
     */
    simulatePreciseSettlement(wallet, exposure, pnl) {
        // Release exposure back to wallet
        const exposureReleased = roundToDecimal(exposure);
        const walletAfterExposureRelease = safeAdd(wallet, exposureReleased);
        
        // Apply P&L
        const finalWallet = safeAdd(walletAfterExposureRelease, pnl);
        
        return {
            exposureReleased: roundToDecimal(exposureReleased),
            walletAfterExposureRelease: roundToDecimal(walletAfterExposureRelease),
            pnlApplied: roundToDecimal(pnl),
            finalWallet: roundToDecimal(finalWallet),
            finalExposure: 0
        };
    }

    /**
     * Validate all scenarios with precision fixes
     */
    async validatePrecisionFixedScenarios() {
        console.log('\n🔍 VALIDATING PRECISION-FIXED EXPOSURE CALCULATIONS');
        console.log('=' .repeat(65));

        let currentWallet = 500;
        let currentExposure = 0;
        const bets = [];

        console.log(`Initial State: Wallet=₹${currentWallet}, Exposure=₹${currentExposure}`);

        // SCENARIO 1: Single Lay Bet (Team A)
        console.log('\n📊 SCENARIO 1: Single Lay Bet (Team A)');
        console.log('-'.repeat(40));
        
        bets.push({ selection: 'Team A', betType: 'LAY', odds: 40, stake: 100 });
        const scenario1 = this.calculatePreciseExposure(bets);
        const wallet1 = this.simulatePreciseWalletUpdate(currentWallet, currentExposure, scenario1.totalExposure);
        
        console.log(`Bet: Lay Team A, Odds 40, Stake ₹100`);
        console.log(`Team A P&L: ₹${scenario1.teamAPnL}`);
        console.log(`Team B P&L: ₹${scenario1.teamBPnL}`);
        console.log(`Total Exposure: ₹${scenario1.totalExposure}`);
        console.log(`Wallet Update: ₹${currentWallet} → ₹${wallet1.newWallet}`);
        console.log(`Expected: Wallet=₹460, Exposure=₹40`);
        console.log(`Actual: Wallet=₹${wallet1.newWallet}, Exposure=₹${wallet1.newExposure}`);
        console.log(`✅ Match: ${wallet1.newWallet === 460 && wallet1.newExposure === 40 ? 'PASS' : 'FAIL'}`);
        
        currentWallet = wallet1.newWallet;
        currentExposure = wallet1.newExposure;

        // SCENARIO 2: Lay + Back Combination (Team A)
        console.log('\n📊 SCENARIO 2: Lay + Back Combination (Team A)');
        console.log('-'.repeat(40));
        
        bets.push({ selection: 'Team A', betType: 'BACK', odds: 38, stake: 100 });
        const scenario2 = this.calculatePreciseExposure(bets);
        const wallet2 = this.simulatePreciseWalletUpdate(currentWallet, currentExposure, scenario2.totalExposure);
        
        console.log(`Bet: Back Team A, Odds 38, Stake ₹100`);
        console.log(`Team A P&L: ₹${scenario2.teamAPnL}`);
        console.log(`Team B P&L: ₹${scenario2.teamBPnL}`);
        console.log(`Total Exposure: ₹${scenario2.totalExposure}`);
        console.log(`Wallet Update: ₹${currentWallet} → ₹${wallet2.newWallet}`);
        console.log(`Expected: Wallet=₹498, Exposure=₹2`);
        console.log(`Actual: Wallet=₹${wallet2.newWallet}, Exposure=₹${wallet2.newExposure}`);
        console.log(`✅ Match: ${wallet2.newWallet === 498 && wallet2.newExposure === 2 ? 'PASS' : 'FAIL'}`);
        
        currentWallet = wallet2.newWallet;
        currentExposure = wallet2.newExposure;

        // SCENARIO 3: Add Lay Bet (Team B)
        console.log('\n📊 SCENARIO 3: Add Lay Bet (Team B)');
        console.log('-'.repeat(40));
        
        bets.push({ selection: 'Team B', betType: 'LAY', odds: 60, stake: 100 });
        const scenario3 = this.calculatePreciseExposure(bets);
        const wallet3 = this.simulatePreciseWalletUpdate(currentWallet, currentExposure, scenario3.totalExposure);
        
        console.log(`Bet: Lay Team B, Odds 60, Stake ₹100`);
        console.log(`Team A P&L: ₹${scenario3.teamAPnL}`);
        console.log(`Team B P&L: ₹${scenario3.teamBPnL}`);
        console.log(`Total Exposure: ₹${scenario3.totalExposure}`);
        console.log(`Wallet Update: ₹${currentWallet} → ₹${wallet3.newWallet}`);
        console.log(`Expected: Wallet=₹440, Exposure=₹60`);
        console.log(`Actual: Wallet=₹${wallet3.newWallet}, Exposure=₹${wallet3.newExposure}`);
        console.log(`✅ Match: ${wallet3.newWallet === 440 && wallet3.newExposure === 60 ? 'PASS' : 'FAIL'}`);
        
        currentWallet = wallet3.newWallet;
        currentExposure = wallet3.newExposure;

        // SCENARIO 4: Lay + Back Combination (Team B) - PRECISION CRITICAL
        console.log('\n📊 SCENARIO 4: Lay + Back Combination (Team B) [PRECISION CRITICAL]');
        console.log('-'.repeat(40));
        
        bets.push({ selection: 'Team B', betType: 'BACK', odds: 56, stake: 100 });
        const scenario4 = this.calculatePreciseExposure(bets);
        const wallet4 = this.simulatePreciseWalletUpdate(currentWallet, currentExposure, scenario4.totalExposure);
        
        console.log(`Bet: Back Team B, Odds 56, Stake ₹100`);
        console.log(`Team A P&L: ₹${scenario4.teamAPnL}`);
        console.log(`Team B P&L: ₹${scenario4.teamBPnL}`);
        console.log(`Total Exposure: ₹${scenario4.totalExposure}`);
        console.log(`Wallet Update: ₹${currentWallet} → ₹${wallet4.newWallet}`);
        console.log(`Expected: Wallet=₹496, Exposure=₹4`);
        console.log(`Actual: Wallet=₹${wallet4.newWallet}, Exposure=₹${wallet4.newExposure}`);
        console.log(`✅ Match: ${wallet4.newWallet === 496 && wallet4.newExposure === 4 ? 'PASS' : 'FAIL'}`);
        
        currentWallet = wallet4.newWallet;
        currentExposure = wallet4.newExposure;

        // AUTOMATIC SETTLEMENT VALIDATION WITH PRECISION
        console.log('\n🏆 PRECISION-FIXED AUTOMATIC SETTLEMENT');
        console.log('=' .repeat(50));
        
        // Team A Wins Settlement
        console.log('\n🎯 TEAM A WINS SETTLEMENT:');
        const teamAWinsSettlement = this.simulatePreciseSettlement(currentWallet, currentExposure, scenario4.teamAPnL);
        console.log(`User P&L: ₹${scenario4.teamAPnL}`);
        console.log(`Exposure Released: ₹${teamAWinsSettlement.exposureReleased}`);
        console.log(`Final Wallet: ₹${teamAWinsSettlement.finalWallet}`);
        console.log(`Expected Final: ₹498`);
        console.log(`✅ Match: ${teamAWinsSettlement.finalWallet === 498 ? 'PASS' : 'FAIL'}`);
        
        // Team B Wins Settlement
        console.log('\n🎯 TEAM B WINS SETTLEMENT:');
        const teamBWinsSettlement = this.simulatePreciseSettlement(currentWallet, currentExposure, scenario4.teamBPnL);
        console.log(`User P&L: ₹${scenario4.teamBPnL}`);
        console.log(`Exposure Released: ₹${teamBWinsSettlement.exposureReleased}`);
        console.log(`Final Wallet: ₹${teamBWinsSettlement.finalWallet}`);
        console.log(`Expected Final: ₹496`);
        console.log(`✅ Match: ${teamBWinsSettlement.finalWallet === 496 ? 'PASS' : 'FAIL'}`);

        // FINAL VERIFICATION WITH PRECISION
        console.log('\n✅ PRECISION-FIXED FINAL VERIFICATION');
        console.log('=' .repeat(40));
        console.log(`Initial Wallet: ₹500`);
        console.log(`Final Wallet: ₹${currentWallet}`);
        console.log(`Final Exposure: ₹${currentExposure}`);
        console.log(`Total Committed: ₹${safeAdd(currentWallet, currentExposure)}`);
        console.log(`Balance Check: ${safeAdd(currentWallet, currentExposure) === 500 ? '✅ PASSED' : '❌ FAILED'}`);
        
        return {
            allScenariosPass: (
                wallet1.newWallet === 460 && wallet1.newExposure === 40 &&
                wallet2.newWallet === 498 && wallet2.newExposure === 2 &&
                wallet3.newWallet === 440 && wallet3.newExposure === 60 &&
                wallet4.newWallet === 496 && wallet4.newExposure === 4 &&
                teamAWinsSettlement.finalWallet === 498 &&
                teamBWinsSettlement.finalWallet === 496 &&
                safeAdd(currentWallet, currentExposure) === 500
            ),
            finalState: {
                wallet: currentWallet,
                exposure: currentExposure,
                totalCommitted: safeAdd(currentWallet, currentExposure)
            }
        };
    }

    /**
     * Run complete precision-fixed validation
     */
    async runPrecisionValidation() {
        try {
            await this.connect();
            
            console.log('🚀 STARTING PRECISION-FIXED EXPOSURE VALIDATION');
            console.log('=' .repeat(65));
            
            const result = await this.validatePrecisionFixedScenarios();
            
            console.log('\n🎉 PRECISION VALIDATION COMPLETE');
            console.log('=' .repeat(40));
            
            if (result.allScenariosPass) {
                console.log('✅ ALL SCENARIOS PASSED WITH PERFECT PRECISION!');
                console.log('✅ Floating-point precision issues have been resolved.');
                console.log('✅ The exposure calculation system is production-ready.');
            } else {
                console.log('❌ Some scenarios failed - review precision handling.');
            }
            
            console.log('\n📊 FINAL SYSTEM STATE:');
            console.log(`   Wallet: ₹${result.finalState.wallet}`);
            console.log(`   Exposure: ₹${result.finalState.exposure}`);
            console.log(`   Total: ₹${result.finalState.totalCommitted}`);
            
        } catch (error) {
            console.error('❌ Precision validation failed:', error.message);
        } finally {
            await this.disconnect();
        }
    }
}

// Execute validation if run directly
if (require.main === module) {
    const calculator = new PrecisionFixedExposureCalculator();
    calculator.runPrecisionValidation().catch(console.error);
}

module.exports = { PrecisionFixedExposureCalculator, roundToDecimal, safeAdd, safeSubtract, safeMultiply, safeDivide };