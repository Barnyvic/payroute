import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';


config();

export const databaseOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'payroute',
  password: process.env.DATABASE_PASSWORD || 'payroute_secret_123',
  database: process.env.DATABASE_NAME || 'payroute_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};


export default new DataSource(databaseOptions);
