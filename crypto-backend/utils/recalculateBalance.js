import axios from 'axios';

let cachedPrices = null;
let lastFetch = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Fetch real-time crypto prices in USDT from CoinGecko
 * Returns: { BTC: 40000, ETH: 2500, BNB: 350, USDT: 1 }
 */
const COIN_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  USDT: 'tether',
  ADA: 'cardano',
  SOL: 'solana',
  XRP: 'ripple',
  DOT: 'polkadot',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2'
};

/**
 * Fetch crypto prices in USD from CoinGecko
 */
export async function getCryptoPrices() {
  const now = Date.now();
  if (cachedPrices && now - lastFetch < CACHE_TTL) return cachedPrices;

  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: Object.values(COIN_MAP).join(','),
          vs_currencies: 'usd'
        }
      }
    );

    const data = res.data;

    cachedPrices = {};
    for (const [symbol, id] of Object.entries(COIN_MAP)) {
      cachedPrices[symbol] = data[id]?.usd || 0;
    }

    lastFetch = now;
    return cachedPrices;
  } catch (err) {
    console.error('Error fetching crypto prices:', err.message);
    // fallback to previous cached prices or zeros
    return cachedPrices || Object.fromEntries(Object.keys(COIN_MAP).map(k => [k, 0]));
  }
}

export async function recalcUserBalance(user) {
  const prices = await getCryptoPrices();
  let total = 0;

  for (const [coin, amt] of Object.entries(user.wallets || {})) {
    const price = prices[coin] || 0;
    total += amt * price;
  }

  user.balance = total;

  if (user.currency && user.currency !== 'USDT') {
    user.balanceInCurrency = await convertUsdtToCurrency(total, user.currency);
  }

  await user.save();
  return user.balance;
}
