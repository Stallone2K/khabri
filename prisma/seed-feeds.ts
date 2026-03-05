import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FeedEntry {
  name: string;
  url: string;
  sourceLabel: string;
  category: string;
  region?: string;
  language?: string;
}

const FEEDS: FeedEntry[] = [
  // =========================================================================
  // GOOGLE TRENDS (3)
  // =========================================================================
  { name: "Google Trends India", url: "https://trends.google.com/trends/trendingsearches/daily/rss?geo=IN", sourceLabel: "GoogleTrends", category: "GOOGLE_TRENDS", region: "IN" },
  { name: "Google Trends US", url: "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US", sourceLabel: "GoogleTrends", category: "GOOGLE_TRENDS", region: "US" },
  { name: "Google Trends Global", url: "https://trends.google.com/trends/trendingsearches/daily/rss", sourceLabel: "GoogleTrends", category: "GOOGLE_TRENDS", region: "GLOBAL" },

  // =========================================================================
  // REDDIT (25)
  // =========================================================================
  { name: "Reddit World News", url: "https://www.reddit.com/r/worldnews/rising/.rss", sourceLabel: "r/WorldNews", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit News", url: "https://www.reddit.com/r/news/rising/.rss", sourceLabel: "r/News", category: "REDDIT", region: "US" },
  { name: "Reddit India", url: "https://www.reddit.com/r/india/rising/.rss", sourceLabel: "r/India", category: "REDDIT", region: "IN" },
  { name: "Reddit IndiaSpeaks", url: "https://www.reddit.com/r/IndiaSpeaks/rising/.rss", sourceLabel: "r/IndiaSpeaks", category: "REDDIT", region: "IN" },
  { name: "Reddit Technology", url: "https://www.reddit.com/r/technology/rising/.rss", sourceLabel: "r/Technology", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Politics", url: "https://www.reddit.com/r/politics/rising/.rss", sourceLabel: "r/Politics", category: "REDDIT", region: "US" },
  { name: "Reddit Geopolitics", url: "https://www.reddit.com/r/geopolitics/rising/.rss", sourceLabel: "r/Geopolitics", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit GeopoliticsIndia", url: "https://www.reddit.com/r/GeopoliticsIndia/rising/.rss", sourceLabel: "r/GeoInd", category: "REDDIT", region: "IN" },
  { name: "Reddit Science", url: "https://www.reddit.com/r/science/rising/.rss", sourceLabel: "r/Science", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Cryptocurrency", url: "https://www.reddit.com/r/CryptoCurrency/rising/.rss", sourceLabel: "r/Crypto", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit WallStreetBets", url: "https://www.reddit.com/r/wallstreetbets/rising/.rss", sourceLabel: "r/WSB", category: "REDDIT", region: "US" },
  { name: "Reddit Economics", url: "https://www.reddit.com/r/economics/rising/.rss", sourceLabel: "r/Economics", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Artificial", url: "https://www.reddit.com/r/artificial/rising/.rss", sourceLabel: "r/Artificial", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Environment", url: "https://www.reddit.com/r/environment/rising/.rss", sourceLabel: "r/Environment", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Space", url: "https://www.reddit.com/r/space/rising/.rss", sourceLabel: "r/Space", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Europe", url: "https://www.reddit.com/r/europe/rising/.rss", sourceLabel: "r/Europe", category: "REDDIT", region: "EU" },
  { name: "Reddit UnitedKingdom", url: "https://www.reddit.com/r/unitedkingdom/rising/.rss", sourceLabel: "r/UK", category: "REDDIT", region: "UK" },
  { name: "Reddit China", url: "https://www.reddit.com/r/China/rising/.rss", sourceLabel: "r/China", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Energy", url: "https://www.reddit.com/r/energy/rising/.rss", sourceLabel: "r/Energy", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit UpliftingNews", url: "https://www.reddit.com/r/UpliftingNews/rising/.rss", sourceLabel: "r/Uplifting", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit TrueReddit", url: "https://www.reddit.com/r/TrueReddit/rising/.rss", sourceLabel: "r/TrueReddit", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit NeutralPolitics", url: "https://www.reddit.com/r/NeutralPolitics/rising/.rss", sourceLabel: "r/NeutralPol", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit Futurology", url: "https://www.reddit.com/r/Futurology/rising/.rss", sourceLabel: "r/Futurology", category: "REDDIT", region: "GLOBAL" },
  { name: "Reddit IndianStockMarket", url: "https://www.reddit.com/r/IndianStockMarket/rising/.rss", sourceLabel: "r/IndStocks", category: "REDDIT", region: "IN" },
  { name: "Reddit DataIsBeautiful", url: "https://www.reddit.com/r/dataisbeautiful/rising/.rss", sourceLabel: "r/DataViz", category: "REDDIT", region: "GLOBAL" },

  // =========================================================================
  // GOOGLE NEWS SECTIONS (12)
  // =========================================================================
  { name: "Google News World", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=US&ceid=US:en", sourceLabel: "GN World", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News India Nation", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en", sourceLabel: "GN Nation", category: "GOOGLE_NEWS", region: "IN" },
  { name: "Google News Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en", sourceLabel: "GN Business", category: "GOOGLE_NEWS", region: "IN" },
  { name: "Google News Technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=US&ceid=US:en", sourceLabel: "GN Tech", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News Science", url: "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en&gl=US&ceid=US:en", sourceLabel: "GN Science", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News Health", url: "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en&gl=US&ceid=US:en", sourceLabel: "GN Health", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News Sports", url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en", sourceLabel: "GN Sports", category: "GOOGLE_NEWS", region: "IN" },
  { name: "Google News Entertainment", url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en&gl=US&ceid=US:en", sourceLabel: "GN Entertain", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News Politics India", url: "https://news.google.com/rss/search?q=politics+when:12h&hl=en-IN&gl=IN&ceid=IN:en", sourceLabel: "GN Pol IN", category: "GOOGLE_NEWS", region: "IN" },
  { name: "Google News Politics US", url: "https://news.google.com/rss/search?q=politics+when:12h&hl=en&gl=US&ceid=US:en", sourceLabel: "GN Pol US", category: "GOOGLE_NEWS", region: "US" },
  { name: "Google News Climate", url: "https://news.google.com/rss/search?q=climate+change+when:24h&hl=en&gl=US&ceid=US:en", sourceLabel: "GN Climate", category: "GOOGLE_NEWS", region: "GLOBAL" },
  { name: "Google News Economy", url: "https://news.google.com/rss/search?q=economy+when:12h&hl=en&gl=US&ceid=US:en", sourceLabel: "GN Economy", category: "GOOGLE_NEWS", region: "GLOBAL" },

  // =========================================================================
  // GLOBAL NEWS / WIRE SERVICES (20)
  // =========================================================================
  { name: "Reuters Top News", url: "https://feeds.reuters.com/reuters/topNews", sourceLabel: "Reuters", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews", sourceLabel: "Reuters", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", sourceLabel: "Reuters", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "Reuters Technology", url: "https://feeds.reuters.com/reuters/technologyNews", sourceLabel: "Reuters", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "AP News Top Headlines", url: "https://rsshub.app/apnews/topics/apf-topnews", sourceLabel: "AP News", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", sourceLabel: "BBC", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "BBC UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml", sourceLabel: "BBC", category: "GLOBAL_NEWS", region: "UK" },
  { name: "BBC Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", sourceLabel: "BBC", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", sourceLabel: "BBC", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", sourceLabel: "BBC", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", sourceLabel: "AlJazeera", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", sourceLabel: "Guardian", category: "GLOBAL_NEWS", region: "GLOBAL" },
  { name: "The Guardian UK", url: "https://www.theguardian.com/uk-news/rss", sourceLabel: "Guardian", category: "GLOBAL_NEWS", region: "UK" },
  { name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml", sourceLabel: "NPR", category: "GLOBAL_NEWS", region: "US" },
  { name: "DW News", url: "https://rss.dw.com/rdf/rss-en-all", sourceLabel: "DW", category: "GLOBAL_NEWS", region: "EU" },
  { name: "France24 English", url: "https://www.france24.com/en/rss", sourceLabel: "France24", category: "GLOBAL_NEWS", region: "EU" },
  { name: "ABC News", url: "https://abcnews.go.com/abcnews/topstories", sourceLabel: "ABC", category: "GLOBAL_NEWS", region: "US" },
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", sourceLabel: "CBS", category: "GLOBAL_NEWS", region: "US" },
  { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", sourceLabel: "PBS", category: "GLOBAL_NEWS", region: "US" },
  { name: "The Independent", url: "https://www.independent.co.uk/news/world/rss", sourceLabel: "Independent", category: "GLOBAL_NEWS", region: "UK" },

  // =========================================================================
  // INDIA NEWS (18)
  // =========================================================================
  { name: "NDTV Top Stories", url: "https://feeds.feedburner.com/ndtvnews-top-stories", sourceLabel: "NDTV", category: "INDIA", region: "IN" },
  { name: "NDTV India", url: "https://feeds.feedburner.com/ndtvnews-india-news", sourceLabel: "NDTV", category: "INDIA", region: "IN" },
  { name: "The Hindu", url: "https://www.thehindu.com/news/feeder/default.rss", sourceLabel: "TheHindu", category: "INDIA", region: "IN" },
  { name: "The Hindu National", url: "https://www.thehindu.com/news/national/feeder/default.rss", sourceLabel: "TheHindu", category: "INDIA", region: "IN" },
  { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", sourceLabel: "TOI", category: "INDIA", region: "IN" },
  { name: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", sourceLabel: "HT", category: "INDIA", region: "IN" },
  { name: "Indian Express", url: "https://indianexpress.com/feed/", sourceLabel: "IndExpress", category: "INDIA", region: "IN" },
  { name: "LiveMint", url: "https://www.livemint.com/rss/news", sourceLabel: "LiveMint", category: "INDIA", region: "IN" },
  { name: "Economic Times", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", sourceLabel: "ET", category: "INDIA", region: "IN" },
  { name: "Business Standard", url: "https://www.business-standard.com/rss/home_page_top_stories.rss", sourceLabel: "BizStandard", category: "INDIA", region: "IN" },
  { name: "Scroll.in", url: "https://scroll.in/feed", sourceLabel: "Scroll", category: "INDIA", region: "IN" },
  { name: "The Wire", url: "https://thewire.in/feed", sourceLabel: "TheWire", category: "INDIA", region: "IN" },
  { name: "The Print", url: "https://theprint.in/feed/", sourceLabel: "ThePrint", category: "INDIA", region: "IN" },
  { name: "Firstpost", url: "https://www.firstpost.com/rss/india.xml", sourceLabel: "Firstpost", category: "INDIA", region: "IN" },
  { name: "WION", url: "https://www.wionews.com/feeds/india/rss.xml", sourceLabel: "WION", category: "INDIA", region: "IN" },
  { name: "Deccan Herald", url: "https://www.deccanherald.com/rss/national.rss", sourceLabel: "DeccanHerald", category: "INDIA", region: "IN" },
  { name: "The Quint", url: "https://www.thequint.com/quintlab/rss-feeds/the-quint-top-news.xml", sourceLabel: "TheQuint", category: "INDIA", region: "IN" },
  { name: "MoneyControl", url: "https://www.moneycontrol.com/rss/latestnews.xml", sourceLabel: "MoneyCtrl", category: "INDIA", region: "IN" },

  // =========================================================================
  // TECHNOLOGY (15)
  // =========================================================================
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", sourceLabel: "TechCrunch", category: "TECH", region: "GLOBAL" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", sourceLabel: "ArsTechnica", category: "TECH", region: "GLOBAL" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", sourceLabel: "TheVerge", category: "TECH", region: "GLOBAL" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", sourceLabel: "Wired", category: "TECH", region: "GLOBAL" },
  { name: "Hacker News Best", url: "https://hnrss.org/best", sourceLabel: "HN", category: "TECH", region: "GLOBAL" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", sourceLabel: "MIT Tech", category: "TECH", region: "GLOBAL" },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml", sourceLabel: "Engadget", category: "TECH", region: "GLOBAL" },
  { name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml", sourceLabel: "ZDNet", category: "TECH", region: "GLOBAL" },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom", sourceLabel: "TheRegister", category: "TECH", region: "UK" },
  { name: "9to5Mac", url: "https://9to5mac.com/feed/", sourceLabel: "9to5Mac", category: "TECH", region: "GLOBAL" },
  { name: "Android Authority", url: "https://www.androidauthority.com/feed/", sourceLabel: "AndroidAuth", category: "TECH", region: "GLOBAL" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/", sourceLabel: "VentureBeat", category: "TECH", region: "GLOBAL" },
  { name: "The Information", url: "https://www.theinformation.com/feed", sourceLabel: "TheInfo", category: "TECH", region: "GLOBAL" },
  { name: "TechRadar", url: "https://www.techradar.com/rss", sourceLabel: "TechRadar", category: "TECH", region: "GLOBAL" },
  { name: "Mashable", url: "https://mashable.com/feeds/rss/all", sourceLabel: "Mashable", category: "TECH", region: "GLOBAL" },

  // =========================================================================
  // FINANCE & ECONOMY (12)
  // =========================================================================
  { name: "CNBC Top News", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", sourceLabel: "CNBC", category: "FINANCE", region: "US" },
  { name: "CNBC World", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362", sourceLabel: "CNBC", category: "FINANCE", region: "GLOBAL" },
  { name: "MarketWatch Top Stories", url: "https://feeds.marketwatch.com/marketwatch/topstories/", sourceLabel: "MarketWatch", category: "FINANCE", region: "US" },
  { name: "MarketWatch Markets", url: "https://feeds.marketwatch.com/marketwatch/marketpulse/", sourceLabel: "MarketWatch", category: "FINANCE", region: "US" },
  { name: "Forbes", url: "https://www.forbes.com/real-time/feed2/", sourceLabel: "Forbes", category: "FINANCE", region: "US" },
  { name: "Fortune", url: "https://fortune.com/feed/", sourceLabel: "Fortune", category: "FINANCE", region: "US" },
  { name: "Business Insider", url: "https://markets.businessinsider.com/rss/news", sourceLabel: "BizInsider", category: "FINANCE", region: "US" },
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", sourceLabel: "YahooFin", category: "FINANCE", region: "US" },
  { name: "FT Markets", url: "https://www.ft.com/markets?format=rss", sourceLabel: "FT", category: "FINANCE", region: "UK" },
  { name: "Investopedia", url: "https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline", sourceLabel: "Investopedia", category: "FINANCE", region: "GLOBAL" },
  { name: "ET Markets", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", sourceLabel: "ET Markets", category: "FINANCE", region: "IN" },
  { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml", sourceLabel: "SeekAlpha", category: "FINANCE", region: "US" },

  // =========================================================================
  // GEOPOLITICS & FOREIGN POLICY (10)
  // =========================================================================
  { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml", sourceLabel: "ForeignAff", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "War on the Rocks", url: "https://warontherocks.com/feed/", sourceLabel: "WOTR", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "The Diplomat", url: "https://thediplomat.com/feed/", sourceLabel: "Diplomat", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "Carnegie Endowment", url: "https://carnegieendowment.org/rss/solr/?lang=en", sourceLabel: "Carnegie", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "Brookings", url: "https://www.brookings.edu/feed/", sourceLabel: "Brookings", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "Council on Foreign Relations", url: "https://www.cfr.org/rss/blog_feed", sourceLabel: "CFR", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "RAND Corporation", url: "https://www.rand.org/content/rand/blog.xml", sourceLabel: "RAND", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "International Crisis Group", url: "https://www.crisisgroup.org/feed/rss", sourceLabel: "CrisisGrp", category: "GEOPOLITICS", region: "GLOBAL" },
  { name: "Defense One", url: "https://www.defenseone.com/rss/", sourceLabel: "DefenseOne", category: "GEOPOLITICS", region: "US" },
  { name: "Jane's Defence", url: "https://www.janes.com/feeds/news", sourceLabel: "Janes", category: "GEOPOLITICS", region: "GLOBAL" },

  // =========================================================================
  // CRYPTO & WEB3 (8)
  // =========================================================================
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", sourceLabel: "CoinDesk", category: "CRYPTO", region: "GLOBAL" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", sourceLabel: "CoinTelegraph", category: "CRYPTO", region: "GLOBAL" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", sourceLabel: "TheBlock", category: "CRYPTO", region: "GLOBAL" },
  { name: "Decrypt", url: "https://decrypt.co/feed", sourceLabel: "Decrypt", category: "CRYPTO", region: "GLOBAL" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/", sourceLabel: "BTC Mag", category: "CRYPTO", region: "GLOBAL" },
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/", sourceLabel: "CryptoSlate", category: "CRYPTO", region: "GLOBAL" },
  { name: "Blockworks", url: "https://blockworks.co/feed", sourceLabel: "Blockworks", category: "CRYPTO", region: "GLOBAL" },
  { name: "DeFi Llama News", url: "https://feed.defillama.com/", sourceLabel: "DeFiLlama", category: "CRYPTO", region: "GLOBAL" },

  // =========================================================================
  // SCIENCE & ENVIRONMENT (10)
  // =========================================================================
  { name: "Nature News", url: "https://www.nature.com/nature.rss", sourceLabel: "Nature", category: "SCIENCE", region: "GLOBAL" },
  { name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", sourceLabel: "NASA", category: "SCIENCE", region: "US" },
  { name: "Space.com", url: "https://www.space.com/feeds/all", sourceLabel: "Space.com", category: "SCIENCE", region: "GLOBAL" },
  { name: "Scientific American", url: "https://rss.sciam.com/ScientificAmerican-Global", sourceLabel: "SciAm", category: "SCIENCE", region: "GLOBAL" },
  { name: "Phys.org", url: "https://phys.org/rss-feed/", sourceLabel: "Phys.org", category: "SCIENCE", region: "GLOBAL" },
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home/", sourceLabel: "NewScientist", category: "SCIENCE", region: "GLOBAL" },
  { name: "The Conversation", url: "https://theconversation.com/articles.atom", sourceLabel: "Conversation", category: "SCIENCE", region: "GLOBAL" },
  { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/", sourceLabel: "CarbonBrief", category: "SCIENCE", region: "GLOBAL" },
  { name: "Climate Home News", url: "https://www.climatechangenews.com/feed/", sourceLabel: "ClimateHome", category: "SCIENCE", region: "GLOBAL" },
  { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml", sourceLabel: "SciDaily", category: "SCIENCE", region: "GLOBAL" },

  // =========================================================================
  // SPORTS (8)
  // =========================================================================
  { name: "ESPN Top Headlines", url: "https://www.espn.com/espn/rss/news", sourceLabel: "ESPN", category: "SPORTS", region: "US" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", sourceLabel: "BBC Sport", category: "SPORTS", region: "UK" },
  { name: "ESPN Cricinfo", url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", sourceLabel: "Cricinfo", category: "SPORTS", region: "GLOBAL" },
  { name: "Bleacher Report", url: "https://bleacherreport.com/articles/feed", sourceLabel: "BR", category: "SPORTS", region: "US" },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/12040", sourceLabel: "SkySports", category: "SPORTS", region: "UK" },
  { name: "Sportskeeda", url: "https://www.sportskeeda.com/feed", sourceLabel: "Sportskeeda", category: "SPORTS", region: "IN" },
  { name: "The Athletic", url: "https://theathletic.com/feed/", sourceLabel: "Athletic", category: "SPORTS", region: "US" },
  { name: "Sports Illustrated", url: "https://www.si.com/rss/si_topstories.rss", sourceLabel: "SI", category: "SPORTS", region: "US" },

  // =========================================================================
  // ENTERTAINMENT (5)
  // =========================================================================
  { name: "Variety", url: "https://variety.com/feed/", sourceLabel: "Variety", category: "ENTERTAINMENT", region: "US" },
  { name: "Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", sourceLabel: "THR", category: "ENTERTAINMENT", region: "US" },
  { name: "Deadline", url: "https://deadline.com/feed/", sourceLabel: "Deadline", category: "ENTERTAINMENT", region: "US" },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", sourceLabel: "RollingStone", category: "ENTERTAINMENT", region: "US" },
  { name: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss", sourceLabel: "Pitchfork", category: "ENTERTAINMENT", region: "US" },

  // =========================================================================
  // US POLITICS (8)
  // =========================================================================
  { name: "Politico", url: "https://www.politico.com/rss/politicopicks.xml", sourceLabel: "Politico", category: "US_POLITICS", region: "US" },
  { name: "The Hill", url: "https://thehill.com/feed/", sourceLabel: "TheHill", category: "US_POLITICS", region: "US" },
  { name: "Axios", url: "https://api.axios.com/feed/", sourceLabel: "Axios", category: "US_POLITICS", region: "US" },
  { name: "NPR Politics", url: "https://feeds.npr.org/1014/rss.xml", sourceLabel: "NPR Pol", category: "US_POLITICS", region: "US" },
  { name: "FiveThirtyEight", url: "https://fivethirtyeight.com/features/feed/", sourceLabel: "538", category: "US_POLITICS", region: "US" },
  { name: "Vox", url: "https://www.vox.com/rss/index.xml", sourceLabel: "Vox", category: "US_POLITICS", region: "US" },
  { name: "The Atlantic", url: "https://www.theatlantic.com/feed/all/", sourceLabel: "Atlantic", category: "US_POLITICS", region: "US" },
  { name: "Slate", url: "https://slate.com/feeds/all.rss", sourceLabel: "Slate", category: "US_POLITICS", region: "US" },

  // =========================================================================
  // MIDDLE EAST (5)
  // =========================================================================
  { name: "Al Monitor", url: "https://www.al-monitor.com/rss.xml", sourceLabel: "AlMonitor", category: "MIDDLE_EAST", region: "GLOBAL" },
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", sourceLabel: "MEE", category: "MIDDLE_EAST", region: "GLOBAL" },
  { name: "Times of Israel", url: "https://www.timesofisrael.com/feed/", sourceLabel: "TOIsrael", category: "MIDDLE_EAST", region: "GLOBAL" },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", sourceLabel: "ArabNews", category: "MIDDLE_EAST", region: "GLOBAL" },
  { name: "Al Arabiya", url: "https://english.alarabiya.net/tools/rss", sourceLabel: "AlArabiya", category: "MIDDLE_EAST", region: "GLOBAL" },

  // =========================================================================
  // ASIA PACIFIC (7)
  // =========================================================================
  { name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", sourceLabel: "SCMP", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss", sourceLabel: "Nikkei", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "Channel NewsAsia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", sourceLabel: "CNA", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "The Straits Times", url: "https://www.straitstimes.com/news/asia/rss.xml", sourceLabel: "StraitsTimes", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "Japan Times", url: "https://www.japantimes.co.jp/feed/", sourceLabel: "JapanTimes", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "Korea Herald", url: "https://www.koreaherald.com/common/rss_xml.php", sourceLabel: "KoreaHerald", category: "ASIA_PACIFIC", region: "GLOBAL" },
  { name: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", sourceLabel: "BangkokPost", category: "ASIA_PACIFIC", region: "GLOBAL" },

  // =========================================================================
  // AFRICA (4)
  // =========================================================================
  { name: "AllAfrica", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", sourceLabel: "AllAfrica", category: "AFRICA", region: "GLOBAL" },
  { name: "The East African", url: "https://www.theeastafrican.co.ke/tea/rss", sourceLabel: "EastAfrican", category: "AFRICA", region: "GLOBAL" },
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/feed/", sourceLabel: "DailyMav", category: "AFRICA", region: "GLOBAL" },
  { name: "Mail & Guardian", url: "https://mg.co.za/feed/", sourceLabel: "M&G", category: "AFRICA", region: "GLOBAL" },

  // =========================================================================
  // LATIN AMERICA (3)
  // =========================================================================
  { name: "Buenos Aires Times", url: "https://www.batimes.com.ar/feed", sourceLabel: "BATimes", category: "LATAM", region: "GLOBAL" },
  { name: "MercoPress", url: "https://en.mercopress.com/rss", sourceLabel: "MercoPress", category: "LATAM", region: "GLOBAL" },
  { name: "Brazil Wire", url: "https://www.brasilwire.com/feed/", sourceLabel: "BrazilWire", category: "LATAM", region: "GLOBAL" },
];

async function main() {
  console.log(`Seeding ${FEEDS.length} feeds into FeedCatalog...`);

  let created = 0;
  let skipped = 0;

  for (const feed of FEEDS) {
    try {
      await prisma.feedCatalog.upsert({
        where: { url: feed.url },
        update: {
          name: feed.name,
          sourceLabel: feed.sourceLabel,
          category: feed.category,
          region: feed.region || "GLOBAL",
          language: feed.language || "en",
        },
        create: {
          name: feed.name,
          url: feed.url,
          sourceLabel: feed.sourceLabel,
          category: feed.category,
          region: feed.region || "GLOBAL",
          language: feed.language || "en",
        },
      });
      created++;
    } catch (e: any) {
      console.error(`  Skipped "${feed.name}": ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Created/updated: ${created}, Skipped: ${skipped}`);
  console.log(`Total feeds in catalog: ${await prisma.feedCatalog.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
