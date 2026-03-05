import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@SkipThrottle({ global: true, payments: true, strict: true })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all accounts' })
  findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findById(id);
  }
}
