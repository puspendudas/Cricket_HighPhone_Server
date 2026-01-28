// Script to clean up duplicate fancyOdds entries
// Run this script with: node scripts/cleanup-fancyodds-duplicates.js
// Or in MongoDB shell / compass

const mongoose = require('mongoose');

// Update this connection string with your MongoDB URI
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cricket_server';

async function cleanupDuplicates() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('fancyodds');

        // Step 1: Find all duplicates grouped by gameId + sid
        console.log('Finding duplicates...');
        const duplicates = await collection.aggregate([
            {
                $group: {
                    _id: { gameId: "$gameId", sid: "$sid" },
                    count: { $sum: 1 },
                    docs: { $push: { _id: "$_id", isEnabled: "$isEnabled", isActive: "$isActive", createdAt: "$createdAt" } }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        console.log(`Found ${duplicates.length} groups with duplicates`);

        let totalDeleted = 0;

        // Step 2: For each group of duplicates, keep the one with isEnabled=true or the oldest one
        for (const dup of duplicates) {
            const docs = dup.docs;

            // Sort: prioritize isEnabled=true, then isActive=true, then oldest (createdAt)
            docs.sort((a, b) => {
                if (a.isEnabled !== b.isEnabled) return b.isEnabled ? 1 : -1;
                if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            // Keep the first one (best match), delete the rest
            const toKeep = docs[0];
            const toDelete = docs.slice(1).map(d => d._id);

            if (toDelete.length > 0) {
                const result = await collection.deleteMany({ _id: { $in: toDelete } });
                totalDeleted += result.deletedCount;
                console.log(`GameId: ${dup._id.gameId}, Sid: ${dup._id.sid} - Kept 1, Deleted ${result.deletedCount}`);
            }
        }

        console.log(`\nTotal duplicates deleted: ${totalDeleted}`);

        // Step 3: Verify no more duplicates
        const remainingDuplicates = await collection.aggregate([
            {
                $group: {
                    _id: { gameId: "$gameId", sid: "$sid" },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (remainingDuplicates.length === 0) {
            console.log('✅ No more duplicates! Unique index can now be created.');

            // Step 4: Try to create the unique index
            try {
                await collection.createIndex({ gameId: 1, sid: 1 }, { unique: true, background: true });
                console.log('✅ Unique index created successfully!');
            } catch (indexError) {
                console.log('⚠️ Index creation error:', indexError.message);
            }
        } else {
            console.log(`⚠️ Still have ${remainingDuplicates.length} duplicate groups. Please run again.`);
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanupDuplicates();
