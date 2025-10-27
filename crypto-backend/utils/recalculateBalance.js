import axios from 'axios'

let cachedCoinList = null
let coinListFetchedAt = 0
const COIN_LIST_TTL = 24 * 60 * 60 * 1000 // 24 hours

let cachedPrices = null
let lastFetch = 0
const PRICE_CACHE_TTL = 30 * 1000 // 30 seconds

/**
 * Fetch and cache CoinGecko coin list
 */
// async function getCoinList () {
//   const now = Date.now()
//   if (cachedCoinList && now - coinListFetchedAt < COIN_LIST_TTL)
//     return cachedCoinList

//   try {
//     const res = await axios.get('https://api.coingecko.com/api/v3/coins/list')
//     cachedCoinList = res.data
//     coinListFetchedAt = now
//     return cachedCoinList
//   } catch (err) {
//     console.error('Error fetching coin list:', err.message)
//     return cachedCoinList || []
//   }
// }

/**
 * Map symbols (e.g. ['BTC','ETH']) to CoinGecko IDs
 */
// async function mapSymbolsToIds(symbols = []) {
//   if (!Array.isArray(symbols)) symbols = [symbols]; // handle single symbol
//   if (symbols.length === 0) return {};

//   const list = await getCoinList();
//   const map = {};

//   for (const symbol of symbols) {
//     const coin = list.find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
//     if (coin) map[symbol.toUpperCase()] = coin.id;
//   }

//   return map;
// }

const COIN_ID_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  TRX: 'tron',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  SHIB: 'shiba-inu',
  XMR: 'monero',
  AAVE: 'aave',
  UNI: 'uniswap',
  HBAR: 'hedera',
  SUI: 'sui',
  TON: 'the-open-network'
}
/**
 * Fetch crypto prices in USD for a list of symbols
 */
export async function getCryptoPrices (symbols = []) {
  if (!Array.isArray(symbols)) symbols = [symbols]
  if (symbols.length === 0) return {}

  const now = Date.now()
  if (cachedPrices && now - lastFetch < PRICE_CACHE_TTL) return cachedPrices

  const ids = symbols.map(s => COIN_ID_MAP[s.toUpperCase()]).filter(Boolean)
  console.log('🔍 Symbols:', symbols)
  console.log('🔍 Coin IDs:', ids)

  if (ids.length === 0) {
    console.warn('⚠️ No valid CoinGecko IDs found for symbols:', symbols)
    return {}
  }

  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: { ids: ids.join(','), vs_currencies: 'usd' }
      }
    )

    const data = res.data
    const prices = {}

    for (const symbol of symbols) {
      const id = COIN_ID_MAP[symbol.toUpperCase()]
      const usd = data[id]?.usd
      prices[symbol.toUpperCase()] = typeof usd === 'number' ? usd : 0
    }

    console.log('✅ Prices fetched:', prices)

    cachedPrices = prices
    lastFetch = now
    return prices
  } catch (err) {
    console.error('❌ Error fetching crypto prices:', err.message)
    return cachedPrices || {}
  }
}

/**
 * Recalculate total user balance in USD
 */
export async function recalcUserBalance(user) {
  try {
    // Convert plain object to Map if necessary
    let balancesMap;
    if (user.balances instanceof Map) {
      balancesMap = user.balances;
    } else {
      balancesMap = new Map(Object.entries(user.balances || {}));
    }

    if (balancesMap.size === 0) {
      user.balance = 0;
      await user.save();
      return 0;
    }

    // Fetch current prices
    const symbols = Array.from(balancesMap.keys()).map(c => c.toUpperCase());
    const prices = await getCryptoPrices(symbols);

    let total = 0;
    for (const [coin, amount] of balancesMap.entries()) {
      const price = Number(prices[coin.toUpperCase()] || 0);
      const amt = Number(amount || 0);
      total += amt * price;
    }

    // Save total balance
    user.balance = Number(total);
    await user.save();

    console.log(`✅ Balance recalculated for ${user.email}: $${total.toFixed(2)}`);
    return total;
  } catch (err) {
    console.error('❌ Error recalculating user balance:', err.message);
    throw err;
  }
}
