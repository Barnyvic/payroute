import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountRepository.find({ order: { userId: 'ASC', currency: 'ASC' } });
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  async findByUserAndCurrency(userId: string, currency: string): Promise<Account | null> {
    return this.accountRepository.findOne({ where: { userId, currency } });
  }
  async lockForUpdate(id: string, manager: EntityManager): Promise<Account> {
    const account = await manager
      .createQueryBuilder(Account, 'account')
      .where('account.id = :id', { id })
      .setLock('pessimistic_write', undefined, ['nowait'])
      .getOne();

    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }

    return account;
  }
}
