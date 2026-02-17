import { OPTIONS_MULTIPLIER, OPTIONS_NAKED_MIN_PCT, OPTIONS_NAKED_UNDERLYING_PCT } from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { positions } from '../database/schema';
import { OptionQuote } from '../market-data/types/market-data-provider.types';
import { PlaceOrderDto } from './dto/place-order.dto';

@Injectable()
export class OptionsMarginService {
  /**
   * Calculate margin required for an option order.
   *
   * - Long call/put (buy to open): full premium — no additional margin
   * - Covered call: check if user has >=100 shares of underlying per contract -> no margin
   * - Cash-secured put: strike * qty * 100
   * - Naked call: 20% of underlying + premium - OTM amount (min 10% of underlying + premium)
   * - Naked put: 20% of underlying + premium - OTM amount (min 10% of underlying + premium)
   * - Vertical spread (multi-leg): max loss = width of strikes * qty * 100
   */
  calculateMarginRequired(
    dto: PlaceOrderDto,
    existingPositions: Array<typeof positions.$inferSelect>,
    underlyingPrice: Decimal,
    optionQuote: OptionQuote,
    parsedOption: { type: 'call' | 'put'; strike: string; underlying: string },
  ): Decimal {
    const qty = new Decimal(dto.quantity);
    const premium = new Decimal(optionQuote.ask).mul(qty).mul(OPTIONS_MULTIPLIER);
    const strike = new Decimal(parsedOption.strike);

    // Buy side: full premium, no margin needed beyond the cost
    if (dto.side === 'buy') {
      return premium;
    }

    // Sell side (writing options): check for covered positions
    if (parsedOption.type === 'call') {
      // Check for covered call: user needs >= qty * 100 shares of underlying
      const underlyingPosition = existingPositions.find(
        (p) => p.symbol === parsedOption.underlying && new Decimal(p.quantity).gt(0),
      );
      if (underlyingPosition) {
        const sharesOwned = new Decimal(underlyingPosition.quantity);
        const sharesNeeded = qty.mul(OPTIONS_MULTIPLIER);
        if (sharesOwned.gte(sharesNeeded)) {
          // Covered call — no margin required
          return new Decimal(0);
        }
      }

      // Naked call margin
      return this.nakedCallMargin(underlyingPrice, strike, premium, qty);
    }

    // Put: cash-secured put check
    const cashSecuredAmount = strike.mul(qty).mul(OPTIONS_MULTIPLIER);

    // For simplicity in v1, use cash-secured put margin
    return cashSecuredAmount;
  }

  /**
   * Calculate max loss for a vertical spread (multi-leg).
   */
  calculateSpreadMaxLoss(
    legs: Array<{ side: string; strike: Decimal; type: 'call' | 'put'; quantity: Decimal }>,
  ): Decimal {
    if (legs.length !== 2) return new Decimal(0);

    const [leg1, leg2] = legs;
    const strikeWidth = leg1.strike.minus(leg2.strike).abs();
    const qty = leg1.quantity;

    return strikeWidth.mul(qty).mul(OPTIONS_MULTIPLIER);
  }

  private nakedCallMargin(underlyingPrice: Decimal, strike: Decimal, premium: Decimal, qty: Decimal): Decimal {
    const otmAmount = Decimal.max(strike.minus(underlyingPrice), new Decimal(0));
    const contracts = qty.mul(OPTIONS_MULTIPLIER);

    // Standard: 20% of underlying + premium - OTM amount
    const standard = underlyingPrice
      .mul(OPTIONS_NAKED_UNDERLYING_PCT)
      .mul(contracts)
      .plus(premium)
      .minus(otmAmount.mul(contracts));

    // Minimum: 10% of underlying + premium
    const minimum = underlyingPrice.mul(OPTIONS_NAKED_MIN_PCT).mul(contracts).plus(premium);

    return Decimal.max(standard, minimum);
  }
}
