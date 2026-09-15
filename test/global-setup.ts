import { DataSource } from 'typeorm';

export default async () => {
  // Set NODE_ENV to test
  process.env.NODE_ENV = 'test';

  // Create a data source to drop and recreate the schema before tests
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'cheapest',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });

  try {
    await dataSource.initialize();

    // Drop all tables. El esquema se recrea al arrancar la app gracias a
    // synchronize: true, y DatabaseSeederService vuelve a sembrar los datos.
    await dataSource.dropDatabase();

    await dataSource.destroy();
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
};
