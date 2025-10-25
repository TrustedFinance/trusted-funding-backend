import axios from 'axios';

let cachedRates = null;
let lastRateFetch = 0;

// Helper to fetch and cache exchange rates
async function getRates() {
  const now = Date.now();

  if (!cachedRates || now - lastRateFetch > 60000) { // refresh every 60s
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    cachedRates = res.data?.rates || {};
    lastRateFetch = now;
  }

  return cachedRates;
}

// 🔁 Convert USD → Fiat
export async function convertUSDToFiat(amountUSD, userCurrency) {
  if (!userCurrency || ['USD', 'USDT'].includes(userCurrency))
    return { fiat: amountUSD, rate: 1 };

  const rates = await getRates();
  const rate = rates[userCurrency.toUpperCase()] || 1;
  const fiat = amountUSD * rate;

  return { fiat, rate };
}

// 🔁 Convert Fiat → USD
export async function convertFiatToUSD(fiatAmount, userCurrency) {
  if (!userCurrency || ['USD', 'USDT'].includes(userCurrency))
    return { usd: fiatAmount, rate: 1 };

  const rates = await getRates();
  const rate = rates[userCurrency.toUpperCase()] || 1;
  const usd = fiatAmount / rate;

  return { usd, rate };
}
