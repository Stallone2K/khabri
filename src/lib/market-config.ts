export interface IndexInfo {
  symbol: string;
  name: string;
  yahooSymbol: string;
}

export interface MarketConfig {
  currencyCode: string;
  currencyName: string;
  forexPairs: string[];
  localIndices: IndexInfo[];
}

const GLOBAL_INDICES: IndexInfo[] = [
  { symbol: "S&P 500", name: "S&P 500", yahooSymbol: "^GSPC" },
  { symbol: "NASDAQ", name: "NASDAQ Composite", yahooSymbol: "^IXIC" },
  { symbol: "FTSE 100", name: "FTSE 100", yahooSymbol: "^FTSE" },
  { symbol: "Nikkei 225", name: "Nikkei 225", yahooSymbol: "^N225" },
];

const COUNTRY_MARKET_MAP: Record<string, MarketConfig> = {
  US: {
    currencyCode: "USD",
    currencyName: "US Dollar",
    forexPairs: ["EUR", "GBP", "JPY", "CAD"],
    localIndices: [
      { symbol: "S&P 500", name: "S&P 500", yahooSymbol: "^GSPC" },
      { symbol: "NASDAQ", name: "NASDAQ Composite", yahooSymbol: "^IXIC" },
      { symbol: "Dow Jones", name: "Dow Jones Industrial", yahooSymbol: "^DJI" },
    ],
  },
  IN: {
    currencyCode: "INR",
    currencyName: "Indian Rupee",
    forexPairs: ["USD", "EUR", "GBP", "JPY"],
    localIndices: [
      { symbol: "SENSEX", name: "BSE SENSEX", yahooSymbol: "^BSESN" },
      { symbol: "NIFTY 50", name: "NIFTY 50", yahooSymbol: "^NSEI" },
    ],
  },
  GB: {
    currencyCode: "GBP",
    currencyName: "British Pound",
    forexPairs: ["USD", "EUR", "JPY", "CHF"],
    localIndices: [
      { symbol: "FTSE 100", name: "FTSE 100", yahooSymbol: "^FTSE" },
      { symbol: "FTSE 250", name: "FTSE 250", yahooSymbol: "^FTMC" },
    ],
  },
  DE: {
    currencyCode: "EUR",
    currencyName: "Euro",
    forexPairs: ["USD", "GBP", "JPY", "CHF"],
    localIndices: [
      { symbol: "DAX", name: "DAX Performance", yahooSymbol: "^GDAXI" },
    ],
  },
  FR: {
    currencyCode: "EUR",
    currencyName: "Euro",
    forexPairs: ["USD", "GBP", "JPY", "CHF"],
    localIndices: [
      { symbol: "CAC 40", name: "CAC 40", yahooSymbol: "^FCHI" },
    ],
  },
  JP: {
    currencyCode: "JPY",
    currencyName: "Japanese Yen",
    forexPairs: ["USD", "EUR", "GBP", "CNY"],
    localIndices: [
      { symbol: "Nikkei 225", name: "Nikkei 225", yahooSymbol: "^N225" },
      { symbol: "TOPIX", name: "TOPIX", yahooSymbol: "^TPX" },
    ],
  },
  CN: {
    currencyCode: "CNY",
    currencyName: "Chinese Yuan",
    forexPairs: ["USD", "EUR", "JPY", "HKD"],
    localIndices: [
      { symbol: "SSE", name: "Shanghai Composite", yahooSymbol: "000001.SS" },
      { symbol: "SZSE", name: "Shenzhen Component", yahooSymbol: "399001.SZ" },
    ],
  },
  HK: {
    currencyCode: "HKD",
    currencyName: "Hong Kong Dollar",
    forexPairs: ["USD", "EUR", "CNY", "JPY"],
    localIndices: [
      { symbol: "Hang Seng", name: "Hang Seng Index", yahooSymbol: "^HSI" },
    ],
  },
  KR: {
    currencyCode: "KRW",
    currencyName: "South Korean Won",
    forexPairs: ["USD", "EUR", "JPY", "CNY"],
    localIndices: [
      { symbol: "KOSPI", name: "KOSPI Composite", yahooSymbol: "^KS11" },
    ],
  },
  AU: {
    currencyCode: "AUD",
    currencyName: "Australian Dollar",
    forexPairs: ["USD", "EUR", "GBP", "NZD"],
    localIndices: [
      { symbol: "ASX 200", name: "S&P/ASX 200", yahooSymbol: "^AXJO" },
    ],
  },
  CA: {
    currencyCode: "CAD",
    currencyName: "Canadian Dollar",
    forexPairs: ["USD", "EUR", "GBP", "JPY"],
    localIndices: [
      { symbol: "TSX", name: "S&P/TSX Composite", yahooSymbol: "^GSPTSE" },
    ],
  },
  BR: {
    currencyCode: "BRL",
    currencyName: "Brazilian Real",
    forexPairs: ["USD", "EUR", "GBP", "ARS"],
    localIndices: [
      { symbol: "BOVESPA", name: "Ibovespa", yahooSymbol: "^BVSP" },
    ],
  },
  ZA: {
    currencyCode: "ZAR",
    currencyName: "South African Rand",
    forexPairs: ["USD", "EUR", "GBP", "JPY"],
    localIndices: [
      { symbol: "JSE Top 40", name: "FTSE/JSE Top 40", yahooSymbol: "^JN0U.JO" },
    ],
  },
  KE: {
    currencyCode: "KES",
    currencyName: "Kenyan Shilling",
    forexPairs: ["USD", "EUR", "GBP", "ZAR"],
    localIndices: [
      { symbol: "NSE 20", name: "Nairobi Securities Exchange", yahooSymbol: "^NSE20" },
    ],
  },
  NG: {
    currencyCode: "NGN",
    currencyName: "Nigerian Naira",
    forexPairs: ["USD", "EUR", "GBP", "ZAR"],
    localIndices: [
      { symbol: "NGX ASI", name: "NGX All-Share Index", yahooSymbol: "^NGSE" },
    ],
  },
  SG: {
    currencyCode: "SGD",
    currencyName: "Singapore Dollar",
    forexPairs: ["USD", "EUR", "JPY", "MYR"],
    localIndices: [
      { symbol: "STI", name: "Straits Times Index", yahooSymbol: "^STI" },
    ],
  },
  AE: {
    currencyCode: "AED",
    currencyName: "UAE Dirham",
    forexPairs: ["USD", "EUR", "GBP", "INR"],
    localIndices: [
      { symbol: "ADX", name: "Abu Dhabi Securities Exchange", yahooSymbol: "^ADI" },
    ],
  },
  SA: {
    currencyCode: "SAR",
    currencyName: "Saudi Riyal",
    forexPairs: ["USD", "EUR", "GBP", "AED"],
    localIndices: [
      { symbol: "TASI", name: "Tadawul All Share", yahooSymbol: "^TASI.SR" },
    ],
  },
  MX: {
    currencyCode: "MXN",
    currencyName: "Mexican Peso",
    forexPairs: ["USD", "EUR", "GBP", "CAD"],
    localIndices: [
      { symbol: "IPC", name: "S&P/BMV IPC", yahooSymbol: "^MXX" },
    ],
  },
  CH: {
    currencyCode: "CHF",
    currencyName: "Swiss Franc",
    forexPairs: ["USD", "EUR", "GBP", "JPY"],
    localIndices: [
      { symbol: "SMI", name: "Swiss Market Index", yahooSymbol: "^SSMI" },
    ],
  },
  SE: {
    currencyCode: "SEK",
    currencyName: "Swedish Krona",
    forexPairs: ["USD", "EUR", "GBP", "NOK"],
    localIndices: [
      { symbol: "OMX 30", name: "OMX Stockholm 30", yahooSymbol: "^OMX" },
    ],
  },
  PL: {
    currencyCode: "PLN",
    currencyName: "Polish Zloty",
    forexPairs: ["USD", "EUR", "GBP", "CZK"],
    localIndices: [
      { symbol: "WIG20", name: "Warsaw WIG20", yahooSymbol: "WIG20.WA" },
    ],
  },
  TH: {
    currencyCode: "THB",
    currencyName: "Thai Baht",
    forexPairs: ["USD", "EUR", "JPY", "CNY"],
    localIndices: [
      { symbol: "SET", name: "SET Index", yahooSymbol: "^SET.BK" },
    ],
  },
  ID: {
    currencyCode: "IDR",
    currencyName: "Indonesian Rupiah",
    forexPairs: ["USD", "EUR", "JPY", "SGD"],
    localIndices: [
      { symbol: "JCI", name: "Jakarta Composite", yahooSymbol: "^JKSE" },
    ],
  },
  MY: {
    currencyCode: "MYR",
    currencyName: "Malaysian Ringgit",
    forexPairs: ["USD", "EUR", "SGD", "JPY"],
    localIndices: [
      { symbol: "KLCI", name: "FTSE Bursa Malaysia KLCI", yahooSymbol: "^KLSE" },
    ],
  },
  PH: {
    currencyCode: "PHP",
    currencyName: "Philippine Peso",
    forexPairs: ["USD", "EUR", "JPY", "SGD"],
    localIndices: [
      { symbol: "PSEi", name: "PSE Composite", yahooSymbol: "PSEI.PS" },
    ],
  },
  EG: {
    currencyCode: "EGP",
    currencyName: "Egyptian Pound",
    forexPairs: ["USD", "EUR", "GBP", "SAR"],
    localIndices: [
      { symbol: "EGX 30", name: "EGX 30 Price", yahooSymbol: "^CASE" },
    ],
  },
  PK: {
    currencyCode: "PKR",
    currencyName: "Pakistani Rupee",
    forexPairs: ["USD", "EUR", "GBP", "SAR"],
    localIndices: [
      { symbol: "KSE 100", name: "Karachi 100", yahooSymbol: "^KSE" },
    ],
  },
  BD: {
    currencyCode: "BDT",
    currencyName: "Bangladeshi Taka",
    forexPairs: ["USD", "EUR", "GBP", "INR"],
    localIndices: [
      { symbol: "DSEX", name: "Dhaka Stock Exchange", yahooSymbol: "^DSEX" },
    ],
  },
  NZ: {
    currencyCode: "NZD",
    currencyName: "New Zealand Dollar",
    forexPairs: ["USD", "EUR", "AUD", "GBP"],
    localIndices: [
      { symbol: "NZX 50", name: "S&P/NZX 50", yahooSymbol: "^NZ50" },
    ],
  },
};

const DEFAULT_CONFIG: MarketConfig = COUNTRY_MARKET_MAP.US;

export function getMarketConfig(countryCode: string | undefined): MarketConfig {
  if (!countryCode) return DEFAULT_CONFIG;
  return COUNTRY_MARKET_MAP[countryCode.toUpperCase()] || DEFAULT_CONFIG;
}

export function getGlobalIndices(): IndexInfo[] {
  return GLOBAL_INDICES;
}

export function getAllStockSymbols(config: MarketConfig): string[] {
  const localSymbols = config.localIndices.map((i) => i.yahooSymbol);
  const globalSymbols = GLOBAL_INDICES.map((i) => i.yahooSymbol);
  // Deduplicate (e.g., US user would have S&P 500 in both local and global)
  return [...new Set([...localSymbols, ...globalSymbols])];
}

export const CRYPTO_WATCHLIST = [
  "bitcoin",
  "ethereum",
  "tether",
  "binancecoin",
  "solana",
  "ripple",
  "dogecoin",
  "cardano",
  "avalanche-2",
  "polkadot",
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", CNY: "¥",
  KRW: "₩", RUB: "₽", BRL: "R$", CAD: "C$", AUD: "A$", CHF: "Fr",
  SGD: "S$", HKD: "HK$", AED: "د.إ", SAR: "﷼", TRY: "₺", MXN: "Mex$",
  IDR: "Rp", THB: "฿", VND: "₫", PKR: "₨", BDT: "৳", NGN: "₦", ZAR: "R",
};

/** Display symbol for a currency code; falls back to the code itself. */
export function getCurrencySymbol(currencyCode: string | undefined): string {
  if (!currencyCode) return "$";
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] ?? `${currencyCode} `;
}
