import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { FxQuote } from './entities/fx-quote.entity';
import { RedisService } from '../redis/redis.service';



const SIMULATED_RATES: Record<string, number> = {
  NGN_USD: 0.000645,   
  NGN_GBP: 0.000513,   
  NGN_EUR: 0.000606,   
  USD_NGN: 1550,
  GBP_NGN: 1950,
  EUR_NGN: 1650,
  USD_GBP: 0.79,
  GBP_USD: 1.27,
  USD_EUR: 0.94,
  EUR_USD: 1.06,
  GBP_EUR: 1.19,
  EUR_GBP: 0.84,
};

const RATE_CACHE_TTL_MS = 60_000;  
const QUOTE_TTL_SECONDS = 60;

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(FxQuote)
    private readonly fxQuoteRepository: Repository<FxQuote>,
    private readonly redisService: RedisService,
  ) {}

  
  async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cacheKey = `fx:rate:${fromCurrency}_${toCurrency}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`FX rate cache hit: ${fromCurrency}_${toCurrency} = ${cached}`);
      return parseFloat(cached);
    }

    const key = `${fromCurrency}_${toCurrency}`;
    const rate = SIMULATED_RATES[key];

    if (!rate) {
      throw new BadRequestException(
        `Unsupported currency pair: ${fromCurrency} → ${toCurrency}`,
      );
    }

    
    await this.redisService.set(cacheKey, rate.toString(), RATE_CACHE_TTL_MS);

    this.logger.debug(`FX rate fetched and cached: ${fromCurrency}_${toCurrency} = ${rate}`);
    return rate;
  }

  
  async createQuote(
    fromCurrency: string,
    toCurrency: string,
    sourceAmount: string,
    manager?: EntityManager,
  ): Promise<FxQuote> {
    const rate = await this.getRate(fromCurrency, toCurrency);
    const destinationAmount = (parseFloat(sourceAmount) * rate).toFixed(8);
    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);

    const repo = manager ? manager.getRepository(FxQuote) : this.fxQuoteRepository;

    const quote = repo.create({
      fromCurrency,
      toCurrency,
      rate: rate.toString(),
      sourceAmount,
      destinationAmount,
      expiresAt,
    });

    const saved = await repo.save(quote);

    this.logger.log(
      `FX quote created: ${fromCurrency}→${toCurrency} rate=${rate} amount=${sourceAmount} expires=${expiresAt.toISOString()}`,
    );

    return saved;
  }

  async findById(id: string): Promise<FxQuote | null> {
    return this.fxQuoteRepository.findOne({ where: { id } });
  }

  
  async getPreview(
    fromCurrency: string,
    toCurrency: string,
    sourceAmount: number,
  ): Promise<{ rate: number; destinationAmount: string; expiresInSeconds: number }> {
    const rate = await this.getRate(fromCurrency, toCurrency);
    const destinationAmount = (sourceAmount * rate).toFixed(8);
    return { rate, destinationAmount, expiresInSeconds: QUOTE_TTL_SECONDS };
  }
}
