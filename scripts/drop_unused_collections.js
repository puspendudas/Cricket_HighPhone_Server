const mongoose = require('mongoose');

const DB_URL = process.env.DB_URL || 'mongodb+srv://rajababu:OYzsXxquOv79POK5@crickettesting.i5408bt.mongodb.net/gameserver';

async function main() {
    try {
        await mongoose.connect(DB_URL);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n=== ALL COLLECTIONS ===');
        collections.forEach(c => console.log(' -', c.name));

        const unusedCollections = ['notices', 'notifications', 'sliders'];

        console.log('\n=== DROPPING UNUSED COLLECTIONS ===');
        for (const name of unusedCollections) {
            const exists = collections.some(c => c.name === name);
            if (exists) {
                const count = await db.collection(name).countDocuments();
                console.log(`Dropping "${name}" (${count} documents)...`);
                await db.collection(name).drop();
                console.log(`  ✅ Dropped "${name}"`);
            } else {
                console.log(`  ⏭️  "${name}" does not exist, skipping`);
            }
        }

        console.log('\nDone!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
