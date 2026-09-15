import { Module } from '@nestjs/common';

// Database
import { DatabaseModule } from '../datasources/database.module';

// Repositories
import { TiendaRepository } from './repositories';

// Services
import { TiendaService } from './services';

// Controllers
import { TiendaController } from './controllers';

import { repositoryProviders } from './repositories/repository.providers';

@Module({
  imports: [DatabaseModule],
  controllers: [TiendaController],
  providers: [
    // Repository Providers
    ...repositoryProviders,
    // Repositories
    TiendaRepository,
    // Services
    TiendaService,
  ],
  exports: [TiendaService],
})
export class IdentificacionModule {}
