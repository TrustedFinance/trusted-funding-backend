// import axios from 'axios';

// let cachedPrices = null;
// let lastFetch = 0;
// const CACHE_TTL = 30 * 1000; // 30 seconds

// /**
//  * Fetch real-time crypto prices in USDT from CoinGecko
//  * Returns: { BTC: 40000, ETH: 2500, BNB: 350, USDT: 1 }
//  */
// const COIN_MAP = {
//   BTC: 'bitcoin',
//   ETH: 'ethereum',
//   BNB: 'binancecoin',
//   USDT: 'tether',
//   ADA: 'cardano',
//   SOL: 'solana',
//   XRP: 'ripple',
//   DOT: 'polkadot',
//   LTC: 'litecoin',
//   DOGE: 'dogecoin',
//   MATIC: 'matic-network',
//   AVAX: 'avalanche-2'
// };

// /**
//  * Fetch crypto prices in USD from CoinGecko
//  */
// export async function getCryptoPrices() {
//   const now = Date.now();
//   if (cachedPrices && now - lastFetch < CACHE_TTL) return cachedPrices;

//   try {
//     const res = await axios.get(
//       'https://api.coingecko.com/api/v3/simple/price',
//       {
//         params: {
//           ids: Object.values(COIN_MAP).join(','),
//           vs_currencies: 'usd'
//         }
//       }
//     );

//     const data = res.data;

//     cachedPrices = {};
//     for (const [symbol, id] of Object.entries(COIN_MAP)) {
//       cachedPrices[symbol] = data[id]?.usd || 0;
//     }

//     lastFetch = now;
//     return cachedPrices;
//   } catch (err) {
//     console.error('Error fetching crypto prices:', err.message);
//     // fallback to previous cached prices or zeros
//     return cachedPrices || Object.fromEntries(Object.keys(COIN_MAP).map(k => [k, 0]));
//   }
// }

// export async function recalcUserBalance(user) {
//   const prices = await getCryptoPrices();
//   let total = 0;

//   for (const [coin, amount] of user.balances.entries()) {
//     const price = prices[coin] || 0;
//     total += amount * price;
//   }

//   user.balance = total;
//   await user.save();
//   return total;
// }


import axios from 'axios';

let cachedCoinList = null;
let coinListFetchedAt = 0;
const COIN_LIST_TTL = 24 * 60 * 60 * 1000; // 24h cache

let cachedPrices = null;
let lastFetch = 0;
const PRICE_CACHE_TTL = 30 * 1000; // 30s

/**
 * Fetch and cache CoinGecko coin list
 * Returns array of { id, symbol, name }
 */
async function getCoinList() {
  const now = Date.now();
  if (cachedCoinList && now - coinListFetchedAt < COIN_LIST_TTL) return cachedCoinList;

  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    cachedCoinList = res.data; // [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }, ...]
    coinListFetchedAt = now;
    return cachedCoinList;
  } catch (err) {
    console.error('Error fetching coin list:', err.message);
    return cachedCoinList || [];
  }
}

/**
 * Convert user balance symbols to CoinGecko IDs
 * @param {Array<string>} symbols - e.g. ['BTC', 'ETH']
 */
async function mapSymbolsToIds(symbols) {
  if (!symbols || !Array.isArray(symbols)) return {};

  const list = await getCoinList();
  const map = {};

  for (const symbol of symbols) {
    const coin = list.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (coin) map[symbol.toUpperCase()] = coin.id;
  }

  return map;
}


/**
 * Fetch crypto prices in USD for user balances
 * @param {Array<string>} symbols - e.g. ['BTC','ETH']
 */
export async function getCryptoPrices(symbols) {
  const now = Date.now();
  if (cachedPrices && now - lastFetch < PRICE_CACHE_TTL) return cachedPrices;

  const symbolMap = await mapSymbolsToIds(symbols);
  const ids = Object.values(symbolMap);
  if (ids.length === 0) return {};

  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: ids.join(','), vs_currencies: 'usd' }
    });

    const data = res.data;
    cachedPrices = {};

    for (const [symbol, id] of Object.entries(symbolMap)) {
      cachedPrices[symbol] = data[id]?.usd || 0;
    }

    lastFetch = now;
    return cachedPrices;
  } catch (err) {
    console.error('Error fetching crypto prices:', err.message);
    return cachedPrices || {};
  }
}

/**
 * Recalculate total user balance in USDT
 */
export async function recalcUserBalance(user) {
  const symbols = Array.from(user.balances.keys()).map(c => c.toUpperCase());
  const prices = await getCryptoPrices(symbols);

  let total = 0;
  for (const [coin, amount] of user.balances.entries()) {
    total += amount * (prices[coin.toUpperCase()] || 0);
  }

  user.balance = total;
  await user.save();
  return total;
}
