import { DataSource } from 'typeorm';
import { databaseOptions } from '../../config/database.config';


async function seed() {
  const dataSource = new DataSource(databaseOptions);
  await dataSource.initialize();

  console.log('Seeding database...');

  const accounts = [
    
    { user_id: 'user_alice', currency: 'NGN', balance: '10000000.00000000' },
    { user_id: 'user_alice', currency: 'USD', balance: '0.00000000' },

    
    { user_id: 'user_bob', currency: 'USD', balance: '5000.00000000' },
    { user_id: 'user_bob', currency: 'GBP', balance: '2000.00000000' },

    
    { user_id: 'user_charlie', currency: 'NGN', balance: '5000000.00000000' },
    { user_id: 'user_charlie', currency: 'EUR', balance: '0.00000000' },

    
    { user_id: 'user_diana', currency: 'EUR', balance: '3000.00000000' },
    { user_id: 'user_diana', currency: 'GBP', balance: '1500.00000000' },
  ];

  for (const account of accounts) {
    await dataSource.query(
      `INSERT INTO accounts (user_id, currency, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, currency) DO UPDATE SET balance = $3`,
      [account.user_id, account.currency, account.balance],
    );
    console.log(`  ✓ ${account.user_id} ${account.currency}: ${account.balance}`);
  }

  console.log(`\nSeeded ${accounts.length} accounts successfully.`);
  console.log('\nTest accounts:');
  console.log('  Sender: user_alice (NGN 10,000,000)');
  console.log('  Recipient USD: user_bob (USD)');
  console.log('  Recipient GBP: user_bob (GBP)');
  console.log('  Recipient EUR: user_diana (EUR)');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
