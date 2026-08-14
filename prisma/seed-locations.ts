import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// REGIONS (8)
// =============================================================================

const REGIONS = [
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Middle East & North Africa",
  "Europe",
  "Sub-Saharan Africa",
  "Americas",
  "Oceania",
];

// =============================================================================
// COUNTRIES (195) — name, ISO alpha-2, region
// =============================================================================

const COUNTRIES: [string, string, string][] = [
  // South Asia
  ["India", "IN", "South Asia"],
  ["Pakistan", "PK", "South Asia"],
  ["Bangladesh", "BD", "South Asia"],
  ["Sri Lanka", "LK", "South Asia"],
  ["Nepal", "NP", "South Asia"],
  ["Bhutan", "BT", "South Asia"],
  ["Maldives", "MV", "South Asia"],
  ["Afghanistan", "AF", "South Asia"],

  // East Asia
  ["China", "CN", "East Asia"],
  ["Japan", "JP", "East Asia"],
  ["South Korea", "KR", "East Asia"],
  ["North Korea", "KP", "East Asia"],
  ["Taiwan", "TW", "East Asia"],
  ["Mongolia", "MN", "East Asia"],
  ["Hong Kong", "HK", "East Asia"],
  ["Macau", "MO", "East Asia"],

  // Southeast Asia
  ["Indonesia", "ID", "Southeast Asia"],
  ["Thailand", "TH", "Southeast Asia"],
  ["Vietnam", "VN", "Southeast Asia"],
  ["Philippines", "PH", "Southeast Asia"],
  ["Malaysia", "MY", "Southeast Asia"],
  ["Singapore", "SG", "Southeast Asia"],
  ["Myanmar", "MM", "Southeast Asia"],
  ["Cambodia", "KH", "Southeast Asia"],
  ["Laos", "LA", "Southeast Asia"],
  ["Brunei", "BN", "Southeast Asia"],
  ["Timor-Leste", "TL", "Southeast Asia"],

  // Middle East & North Africa
  ["Saudi Arabia", "SA", "Middle East & North Africa"],
  ["Iran", "IR", "Middle East & North Africa"],
  ["Iraq", "IQ", "Middle East & North Africa"],
  ["Israel", "IL", "Middle East & North Africa"],
  ["United Arab Emirates", "AE", "Middle East & North Africa"],
  ["Qatar", "QA", "Middle East & North Africa"],
  ["Kuwait", "KW", "Middle East & North Africa"],
  ["Oman", "OM", "Middle East & North Africa"],
  ["Bahrain", "BH", "Middle East & North Africa"],
  ["Jordan", "JO", "Middle East & North Africa"],
  ["Lebanon", "LB", "Middle East & North Africa"],
  ["Syria", "SY", "Middle East & North Africa"],
  ["Yemen", "YE", "Middle East & North Africa"],
  ["Palestine", "PS", "Middle East & North Africa"],
  ["Egypt", "EG", "Middle East & North Africa"],
  ["Libya", "LY", "Middle East & North Africa"],
  ["Tunisia", "TN", "Middle East & North Africa"],
  ["Algeria", "DZ", "Middle East & North Africa"],
  ["Morocco", "MA", "Middle East & North Africa"],
  ["Turkey", "TR", "Middle East & North Africa"],
  ["Cyprus", "CY", "Middle East & North Africa"],

  // Europe
  ["United Kingdom", "GB", "Europe"],
  ["France", "FR", "Europe"],
  ["Germany", "DE", "Europe"],
  ["Italy", "IT", "Europe"],
  ["Spain", "ES", "Europe"],
  ["Portugal", "PT", "Europe"],
  ["Netherlands", "NL", "Europe"],
  ["Belgium", "BE", "Europe"],
  ["Switzerland", "CH", "Europe"],
  ["Austria", "AT", "Europe"],
  ["Sweden", "SE", "Europe"],
  ["Norway", "NO", "Europe"],
  ["Denmark", "DK", "Europe"],
  ["Finland", "FI", "Europe"],
  ["Iceland", "IS", "Europe"],
  ["Ireland", "IE", "Europe"],
  ["Poland", "PL", "Europe"],
  ["Czech Republic", "CZ", "Europe"],
  ["Slovakia", "SK", "Europe"],
  ["Hungary", "HU", "Europe"],
  ["Romania", "RO", "Europe"],
  ["Bulgaria", "BG", "Europe"],
  ["Greece", "GR", "Europe"],
  ["Croatia", "HR", "Europe"],
  ["Serbia", "RS", "Europe"],
  ["Slovenia", "SI", "Europe"],
  ["Bosnia and Herzegovina", "BA", "Europe"],
  ["Montenegro", "ME", "Europe"],
  ["North Macedonia", "MK", "Europe"],
  ["Albania", "AL", "Europe"],
  ["Kosovo", "XK", "Europe"],
  ["Lithuania", "LT", "Europe"],
  ["Latvia", "LV", "Europe"],
  ["Estonia", "EE", "Europe"],
  ["Moldova", "MD", "Europe"],
  ["Belarus", "BY", "Europe"],
  ["Ukraine", "UA", "Europe"],
  ["Russia", "RU", "Europe"],
  ["Georgia", "GE", "Europe"],
  ["Armenia", "AM", "Europe"],
  ["Azerbaijan", "AZ", "Europe"],
  ["Malta", "MT", "Europe"],
  ["Luxembourg", "LU", "Europe"],
  ["Liechtenstein", "LI", "Europe"],
  ["Monaco", "MC", "Europe"],
  ["Andorra", "AD", "Europe"],
  ["San Marino", "SM", "Europe"],
  ["Vatican City", "VA", "Europe"],

  // Sub-Saharan Africa
  ["Nigeria", "NG", "Sub-Saharan Africa"],
  ["South Africa", "ZA", "Sub-Saharan Africa"],
  ["Kenya", "KE", "Sub-Saharan Africa"],
  ["Ethiopia", "ET", "Sub-Saharan Africa"],
  ["Ghana", "GH", "Sub-Saharan Africa"],
  ["Tanzania", "TZ", "Sub-Saharan Africa"],
  ["Uganda", "UG", "Sub-Saharan Africa"],
  ["Rwanda", "RW", "Sub-Saharan Africa"],
  ["Democratic Republic of the Congo", "CD", "Sub-Saharan Africa"],
  ["Republic of the Congo", "CG", "Sub-Saharan Africa"],
  ["Cameroon", "CM", "Sub-Saharan Africa"],
  ["Senegal", "SN", "Sub-Saharan Africa"],
  ["Ivory Coast", "CI", "Sub-Saharan Africa"],
  ["Angola", "AO", "Sub-Saharan Africa"],
  ["Mozambique", "MZ", "Sub-Saharan Africa"],
  ["Zimbabwe", "ZW", "Sub-Saharan Africa"],
  ["Zambia", "ZM", "Sub-Saharan Africa"],
  ["Malawi", "MW", "Sub-Saharan Africa"],
  ["Madagascar", "MG", "Sub-Saharan Africa"],
  ["Mali", "ML", "Sub-Saharan Africa"],
  ["Burkina Faso", "BF", "Sub-Saharan Africa"],
  ["Niger", "NE", "Sub-Saharan Africa"],
  ["Chad", "TD", "Sub-Saharan Africa"],
  ["Somalia", "SO", "Sub-Saharan Africa"],
  ["Sudan", "SD", "Sub-Saharan Africa"],
  ["South Sudan", "SS", "Sub-Saharan Africa"],
  ["Eritrea", "ER", "Sub-Saharan Africa"],
  ["Djibouti", "DJ", "Sub-Saharan Africa"],
  ["Namibia", "NA", "Sub-Saharan Africa"],
  ["Botswana", "BW", "Sub-Saharan Africa"],
  ["Mauritius", "MU", "Sub-Saharan Africa"],
  ["Seychelles", "SC", "Sub-Saharan Africa"],
  ["Gabon", "GA", "Sub-Saharan Africa"],
  ["Equatorial Guinea", "GQ", "Sub-Saharan Africa"],
  ["Central African Republic", "CF", "Sub-Saharan Africa"],
  ["Togo", "TG", "Sub-Saharan Africa"],
  ["Benin", "BJ", "Sub-Saharan Africa"],
  ["Sierra Leone", "SL", "Sub-Saharan Africa"],
  ["Liberia", "LR", "Sub-Saharan Africa"],
  ["Guinea", "GN", "Sub-Saharan Africa"],
  ["Guinea-Bissau", "GW", "Sub-Saharan Africa"],
  ["Gambia", "GM", "Sub-Saharan Africa"],
  ["Cape Verde", "CV", "Sub-Saharan Africa"],
  ["Sao Tome and Principe", "ST", "Sub-Saharan Africa"],
  ["Comoros", "KM", "Sub-Saharan Africa"],
  ["Eswatini", "SZ", "Sub-Saharan Africa"],
  ["Lesotho", "LS", "Sub-Saharan Africa"],
  ["Burundi", "BI", "Sub-Saharan Africa"],

  // Americas
  ["United States", "US", "Americas"],
  ["Canada", "CA", "Americas"],
  ["Mexico", "MX", "Americas"],
  ["Brazil", "BR", "Americas"],
  ["Argentina", "AR", "Americas"],
  ["Colombia", "CO", "Americas"],
  ["Chile", "CL", "Americas"],
  ["Peru", "PE", "Americas"],
  ["Venezuela", "VE", "Americas"],
  ["Ecuador", "EC", "Americas"],
  ["Bolivia", "BO", "Americas"],
  ["Paraguay", "PY", "Americas"],
  ["Uruguay", "UY", "Americas"],
  ["Guyana", "GY", "Americas"],
  ["Suriname", "SR", "Americas"],
  ["Cuba", "CU", "Americas"],
  ["Haiti", "HT", "Americas"],
  ["Dominican Republic", "DO", "Americas"],
  ["Jamaica", "JM", "Americas"],
  ["Trinidad and Tobago", "TT", "Americas"],
  ["Barbados", "BB", "Americas"],
  ["Bahamas", "BS", "Americas"],
  ["Panama", "PA", "Americas"],
  ["Costa Rica", "CR", "Americas"],
  ["Guatemala", "GT", "Americas"],
  ["Honduras", "HN", "Americas"],
  ["El Salvador", "SV", "Americas"],
  ["Nicaragua", "NI", "Americas"],
  ["Belize", "BZ", "Americas"],
  ["Puerto Rico", "PR", "Americas"],

  // Oceania
  ["Australia", "AU", "Oceania"],
  ["New Zealand", "NZ", "Oceania"],
  ["Papua New Guinea", "PG", "Oceania"],
  ["Fiji", "FJ", "Oceania"],
  ["Solomon Islands", "SB", "Oceania"],
  ["Vanuatu", "VU", "Oceania"],
  ["Samoa", "WS", "Oceania"],
  ["Tonga", "TO", "Oceania"],
  ["Palau", "PW", "Oceania"],
  ["Marshall Islands", "MH", "Oceania"],
  ["Micronesia", "FM", "Oceania"],
  ["Kiribati", "KI", "Oceania"],
  ["Nauru", "NR", "Oceania"],
  ["Tuvalu", "TV", "Oceania"],

  // Central Asia (grouped under South Asia region for simplicity)
  ["Kazakhstan", "KZ", "South Asia"],
  ["Uzbekistan", "UZ", "South Asia"],
  ["Turkmenistan", "TM", "South Asia"],
  ["Kyrgyzstan", "KG", "South Asia"],
  ["Tajikistan", "TJ", "South Asia"],
];

// =============================================================================
// US STATES (50)
// =============================================================================

const US_STATES: [string, string[]][] = [
  ["Alabama", []], ["Alaska", []], ["Arizona", []], ["Arkansas", []],
  ["California", ["CA"]], ["Colorado", []], ["Connecticut", []], ["Delaware", []],
  ["Florida", ["FL"]], ["Georgia", []], ["Hawaii", []], ["Idaho", []],
  ["Illinois", ["IL"]], ["Indiana", []], ["Iowa", []], ["Kansas", []],
  ["Kentucky", []], ["Louisiana", []], ["Maine", []], ["Maryland", []],
  ["Massachusetts", ["MA"]], ["Michigan", []], ["Minnesota", []], ["Mississippi", []],
  ["Missouri", []], ["Montana", []], ["Nebraska", []], ["Nevada", []],
  ["New Hampshire", []], ["New Jersey", []], ["New Mexico", []], ["New York", ["NY"]],
  ["North Carolina", []], ["North Dakota", []], ["Ohio", []], ["Oklahoma", []],
  ["Oregon", []], ["Pennsylvania", ["PA"]], ["Rhode Island", []], ["South Carolina", []],
  ["South Dakota", []], ["Tennessee", []], ["Texas", ["TX"]], ["Utah", []],
  ["Vermont", []], ["Virginia", ["VA"]], ["Washington", ["WA"]], ["West Virginia", []],
  ["Wisconsin", []], ["Wyoming", []],
];

// =============================================================================
// INDIAN STATES & UTs (36)
// =============================================================================

const INDIAN_STATES: [string, string[]][] = [
  ["Andhra Pradesh", []], ["Arunachal Pradesh", []], ["Assam", []], ["Bihar", []],
  ["Chhattisgarh", []], ["Goa", []], ["Gujarat", []], ["Haryana", []],
  ["Himachal Pradesh", []], ["Jharkhand", []], ["Karnataka", []], ["Kerala", []],
  ["Madhya Pradesh", []], ["Maharashtra", []], ["Manipur", []], ["Meghalaya", []],
  ["Mizoram", []], ["Nagaland", []], ["Odisha", ["Orissa"]], ["Punjab", []],
  ["Rajasthan", []], ["Sikkim", []], ["Tamil Nadu", []], ["Telangana", []],
  ["Tripura", []], ["Uttar Pradesh", ["UP"]], ["Uttarakhand", ["Uttaranchal"]],
  ["West Bengal", []], ["Delhi", ["New Delhi"]], ["Jammu and Kashmir", ["J&K"]],
  ["Ladakh", []], ["Chandigarh", []], ["Puducherry", ["Pondicherry"]],
  ["Andaman and Nicobar Islands", []], ["Dadra and Nagar Haveli and Daman and Diu", []],
  ["Lakshadweep", []],
];

// =============================================================================
// CITIES (~200) — name, countryCode, aliases, stateName (for US/IN), lat, lng
// =============================================================================

interface CityEntry {
  name: string;
  cc: string;
  aliases?: string[];
  state?: string; // parent state name (for US/India)
  lat?: number;
  lng?: number;
}

const CITIES: CityEntry[] = [
  // India — Major Cities
  { name: "Mumbai", cc: "IN", aliases: ["Bombay"], state: "Maharashtra", lat: 19.076, lng: 72.878 },
  { name: "Delhi", cc: "IN", state: "Delhi", lat: 28.614, lng: 77.209 },
  { name: "Bangalore", cc: "IN", aliases: ["Bengaluru"], state: "Karnataka", lat: 12.972, lng: 77.595 },
  { name: "Hyderabad", cc: "IN", state: "Telangana", lat: 17.385, lng: 78.487 },
  { name: "Chennai", cc: "IN", aliases: ["Madras"], state: "Tamil Nadu", lat: 13.083, lng: 80.270 },
  { name: "Kolkata", cc: "IN", aliases: ["Calcutta"], state: "West Bengal", lat: 22.573, lng: 88.364 },
  { name: "Pune", cc: "IN", state: "Maharashtra", lat: 18.520, lng: 73.857 },
  { name: "Ahmedabad", cc: "IN", state: "Gujarat", lat: 23.023, lng: 72.571 },
  { name: "Jaipur", cc: "IN", state: "Rajasthan", lat: 26.913, lng: 75.787 },
  { name: "Lucknow", cc: "IN", state: "Uttar Pradesh", lat: 26.847, lng: 80.947 },
  { name: "Surat", cc: "IN", state: "Gujarat", lat: 21.170, lng: 72.831 },
  { name: "Chandigarh", cc: "IN", state: "Chandigarh", lat: 30.734, lng: 76.779 },
  { name: "Kochi", cc: "IN", aliases: ["Cochin"], state: "Kerala", lat: 9.932, lng: 76.267 },
  { name: "Indore", cc: "IN", state: "Madhya Pradesh", lat: 22.720, lng: 75.858 },
  { name: "Bhopal", cc: "IN", state: "Madhya Pradesh", lat: 23.259, lng: 77.413 },
  { name: "Nagpur", cc: "IN", state: "Maharashtra", lat: 21.146, lng: 79.089 },
  { name: "Patna", cc: "IN", state: "Bihar", lat: 25.594, lng: 85.138 },
  { name: "Guwahati", cc: "IN", state: "Assam", lat: 26.144, lng: 91.736 },
  { name: "Thiruvananthapuram", cc: "IN", aliases: ["Trivandrum"], state: "Kerala", lat: 8.524, lng: 76.936 },
  { name: "Varanasi", cc: "IN", aliases: ["Banaras", "Kashi"], state: "Uttar Pradesh", lat: 25.318, lng: 83.011 },

  // United States — Major Cities
  { name: "New York City", cc: "US", aliases: ["NYC", "New York"], state: "New York", lat: 40.713, lng: -74.006 },
  { name: "Los Angeles", cc: "US", aliases: ["LA"], state: "California", lat: 34.052, lng: -118.244 },
  { name: "Chicago", cc: "US", state: "Illinois", lat: 41.878, lng: -87.630 },
  { name: "Houston", cc: "US", state: "Texas", lat: 29.760, lng: -95.370 },
  { name: "Phoenix", cc: "US", state: "Arizona", lat: 33.449, lng: -112.074 },
  { name: "Philadelphia", cc: "US", aliases: ["Philly"], state: "Pennsylvania", lat: 39.953, lng: -75.164 },
  { name: "San Antonio", cc: "US", state: "Texas", lat: 29.425, lng: -98.495 },
  { name: "San Diego", cc: "US", state: "California", lat: 32.716, lng: -117.161 },
  { name: "Dallas", cc: "US", state: "Texas", lat: 32.777, lng: -96.797 },
  { name: "San Jose", cc: "US", state: "California", lat: 37.338, lng: -121.886 },
  { name: "Austin", cc: "US", state: "Texas", lat: 30.267, lng: -97.743 },
  { name: "San Francisco", cc: "US", aliases: ["SF"], state: "California", lat: 37.775, lng: -122.418 },
  { name: "Seattle", cc: "US", state: "Washington", lat: 47.606, lng: -122.332 },
  { name: "Denver", cc: "US", state: "Colorado", lat: 39.739, lng: -104.990 },
  { name: "Washington D.C.", cc: "US", aliases: ["Washington", "DC"], lat: 38.907, lng: -77.037 },
  { name: "Boston", cc: "US", state: "Massachusetts", lat: 42.360, lng: -71.059 },
  { name: "Nashville", cc: "US", state: "Tennessee", lat: 36.163, lng: -86.782 },
  { name: "Miami", cc: "US", state: "Florida", lat: 25.762, lng: -80.192 },
  { name: "Atlanta", cc: "US", state: "Georgia", lat: 33.749, lng: -84.388 },
  { name: "Las Vegas", cc: "US", state: "Nevada", lat: 36.169, lng: -115.140 },
  { name: "Portland", cc: "US", state: "Oregon", lat: 45.505, lng: -122.675 },
  { name: "Detroit", cc: "US", state: "Michigan", lat: 42.331, lng: -83.046 },
  { name: "Minneapolis", cc: "US", state: "Minnesota", lat: 44.978, lng: -93.265 },

  // China
  { name: "Beijing", cc: "CN", aliases: ["Peking"], lat: 39.904, lng: 116.407 },
  { name: "Shanghai", cc: "CN", lat: 31.230, lng: 121.474 },
  { name: "Guangzhou", cc: "CN", aliases: ["Canton"], lat: 23.130, lng: 113.264 },
  { name: "Shenzhen", cc: "CN", lat: 22.543, lng: 114.058 },
  { name: "Chengdu", cc: "CN", lat: 30.573, lng: 104.066 },
  { name: "Wuhan", cc: "CN", lat: 30.593, lng: 114.306 },
  { name: "Hangzhou", cc: "CN", lat: 30.275, lng: 120.155 },
  { name: "Chongqing", cc: "CN", lat: 29.563, lng: 106.552 },
  { name: "Tianjin", cc: "CN", lat: 39.084, lng: 117.201 },
  { name: "Xi'an", cc: "CN", aliases: ["Xian"], lat: 34.265, lng: 108.943 },

  // Japan
  { name: "Tokyo", cc: "JP", lat: 35.682, lng: 139.692 },
  { name: "Osaka", cc: "JP", lat: 34.694, lng: 135.502 },
  { name: "Yokohama", cc: "JP", lat: 35.444, lng: 139.638 },
  { name: "Kyoto", cc: "JP", lat: 35.012, lng: 135.768 },
  { name: "Fukuoka", cc: "JP", lat: 33.590, lng: 130.402 },

  // South Korea
  { name: "Seoul", cc: "KR", lat: 37.567, lng: 126.978 },
  { name: "Busan", cc: "KR", lat: 35.180, lng: 129.076 },

  // Southeast Asia
  { name: "Bangkok", cc: "TH", lat: 13.756, lng: 100.502 },
  { name: "Jakarta", cc: "ID", lat: -6.175, lng: 106.845 },
  { name: "Kuala Lumpur", cc: "MY", aliases: ["KL"], lat: 3.139, lng: 101.687 },
  { name: "Singapore", cc: "SG", lat: 1.352, lng: 103.820 },
  { name: "Manila", cc: "PH", lat: 14.600, lng: 120.984 },
  { name: "Ho Chi Minh City", cc: "VN", aliases: ["Saigon", "HCMC"], lat: 10.823, lng: 106.630 },
  { name: "Hanoi", cc: "VN", lat: 21.029, lng: 105.852 },

  // Middle East
  { name: "Dubai", cc: "AE", lat: 25.205, lng: 55.271 },
  { name: "Abu Dhabi", cc: "AE", lat: 24.454, lng: 54.377 },
  { name: "Riyadh", cc: "SA", lat: 24.713, lng: 46.675 },
  { name: "Jeddah", cc: "SA", lat: 21.486, lng: 39.177 },
  { name: "Doha", cc: "QA", lat: 25.286, lng: 51.534 },
  { name: "Tehran", cc: "IR", lat: 35.689, lng: 51.389 },
  { name: "Baghdad", cc: "IQ", lat: 33.312, lng: 44.361 },
  { name: "Beirut", cc: "LB", lat: 33.888, lng: 35.495 },
  { name: "Amman", cc: "JO", lat: 31.956, lng: 35.946 },
  { name: "Damascus", cc: "SY", lat: 33.513, lng: 36.292 },
  { name: "Tel Aviv", cc: "IL", lat: 32.085, lng: 34.782 },
  { name: "Jerusalem", cc: "IL", lat: 31.769, lng: 35.216 },
  { name: "Istanbul", cc: "TR", lat: 41.009, lng: 28.978 },
  { name: "Ankara", cc: "TR", lat: 39.934, lng: 32.860 },
  { name: "Cairo", cc: "EG", lat: 30.044, lng: 31.236 },
  { name: "Kuwait City", cc: "KW", lat: 29.376, lng: 47.977 },
  { name: "Muscat", cc: "OM", lat: 23.586, lng: 58.382 },

  // Europe
  { name: "London", cc: "GB", lat: 51.507, lng: -0.128 },
  { name: "Paris", cc: "FR", lat: 48.857, lng: 2.352 },
  { name: "Berlin", cc: "DE", lat: 52.520, lng: 13.405 },
  { name: "Madrid", cc: "ES", lat: 40.417, lng: -3.704 },
  { name: "Rome", cc: "IT", lat: 41.903, lng: 12.496 },
  { name: "Amsterdam", cc: "NL", lat: 52.367, lng: 4.904 },
  { name: "Brussels", cc: "BE", lat: 50.850, lng: 4.352 },
  { name: "Vienna", cc: "AT", lat: 48.209, lng: 16.373 },
  { name: "Zurich", cc: "CH", lat: 47.377, lng: 8.541 },
  { name: "Geneva", cc: "CH", lat: 46.205, lng: 6.145 },
  { name: "Stockholm", cc: "SE", lat: 59.329, lng: 18.069 },
  { name: "Oslo", cc: "NO", lat: 59.914, lng: 10.752 },
  { name: "Copenhagen", cc: "DK", lat: 55.676, lng: 12.569 },
  { name: "Helsinki", cc: "FI", lat: 60.170, lng: 24.941 },
  { name: "Dublin", cc: "IE", lat: 53.350, lng: -6.260 },
  { name: "Lisbon", cc: "PT", lat: 38.722, lng: -9.139 },
  { name: "Barcelona", cc: "ES", lat: 41.389, lng: 2.159 },
  { name: "Munich", cc: "DE", aliases: ["Muenchen", "München"], lat: 48.136, lng: 11.576 },
  { name: "Frankfurt", cc: "DE", lat: 50.111, lng: 8.682 },
  { name: "Milan", cc: "IT", aliases: ["Milano"], lat: 45.464, lng: 9.190 },
  { name: "Warsaw", cc: "PL", lat: 52.230, lng: 21.012 },
  { name: "Prague", cc: "CZ", lat: 50.076, lng: 14.438 },
  { name: "Budapest", cc: "HU", lat: 47.497, lng: 19.040 },
  { name: "Bucharest", cc: "RO", lat: 44.426, lng: 26.103 },
  { name: "Athens", cc: "GR", lat: 37.984, lng: 23.728 },
  { name: "Kyiv", cc: "UA", aliases: ["Kiev"], lat: 50.451, lng: 30.524 },
  { name: "Moscow", cc: "RU", lat: 55.756, lng: 37.617 },
  { name: "Saint Petersburg", cc: "RU", aliases: ["St Petersburg"], lat: 59.935, lng: 30.316 },
  { name: "Edinburgh", cc: "GB", lat: 55.953, lng: -3.189 },
  { name: "Manchester", cc: "GB", lat: 53.483, lng: -2.244 },

  // Africa
  { name: "Lagos", cc: "NG", lat: 6.524, lng: 3.379 },
  { name: "Nairobi", cc: "KE", lat: -1.292, lng: 36.822 },
  { name: "Johannesburg", cc: "ZA", lat: -26.205, lng: 28.050 },
  { name: "Cape Town", cc: "ZA", lat: -33.925, lng: 18.424 },
  { name: "Addis Ababa", cc: "ET", lat: 9.005, lng: 38.763 },
  { name: "Accra", cc: "GH", lat: 5.603, lng: -0.187 },
  { name: "Dar es Salaam", cc: "TZ", lat: -6.792, lng: 39.208 },
  { name: "Khartoum", cc: "SD", lat: 15.501, lng: 32.560 },
  { name: "Casablanca", cc: "MA", lat: 33.573, lng: -7.590 },
  { name: "Algiers", cc: "DZ", lat: 36.753, lng: 3.059 },
  { name: "Tunis", cc: "TN", lat: 36.807, lng: 10.182 },
  { name: "Kampala", cc: "UG", lat: 0.348, lng: 32.575 },
  { name: "Kinshasa", cc: "CD", lat: -4.325, lng: 15.322 },
  { name: "Abuja", cc: "NG", lat: 9.058, lng: 7.489 },
  { name: "Pretoria", cc: "ZA", lat: -25.747, lng: 28.188 },
  { name: "Durban", cc: "ZA", lat: -29.858, lng: 31.022 },

  // Americas (non-US)
  { name: "Toronto", cc: "CA", lat: 43.651, lng: -79.347 },
  { name: "Vancouver", cc: "CA", lat: 49.283, lng: -123.121 },
  { name: "Montreal", cc: "CA", lat: 45.502, lng: -73.567 },
  { name: "Ottawa", cc: "CA", lat: 45.421, lng: -75.697 },
  { name: "Mexico City", cc: "MX", lat: 19.433, lng: -99.133 },
  { name: "Sao Paulo", cc: "BR", aliases: ["São Paulo"], lat: -23.551, lng: -46.634 },
  { name: "Rio de Janeiro", cc: "BR", lat: -22.907, lng: -43.173 },
  { name: "Brasilia", cc: "BR", lat: -15.794, lng: -47.883 },
  { name: "Buenos Aires", cc: "AR", lat: -34.604, lng: -58.382 },
  { name: "Santiago", cc: "CL", lat: -33.447, lng: -70.673 },
  { name: "Lima", cc: "PE", lat: -12.046, lng: -77.043 },
  { name: "Bogota", cc: "CO", aliases: ["Bogotá"], lat: 4.711, lng: -74.072 },
  { name: "Caracas", cc: "VE", lat: 10.491, lng: -66.879 },
  { name: "Havana", cc: "CU", lat: 23.114, lng: -82.367 },

  // Oceania
  { name: "Sydney", cc: "AU", lat: -33.869, lng: 151.209 },
  { name: "Melbourne", cc: "AU", lat: -37.814, lng: 144.963 },
  { name: "Brisbane", cc: "AU", lat: -27.468, lng: 153.028 },
  { name: "Perth", cc: "AU", lat: -31.951, lng: 115.861 },
  { name: "Canberra", cc: "AU", lat: -35.283, lng: 149.129 },
  { name: "Auckland", cc: "NZ", lat: -36.849, lng: 174.764 },
  { name: "Wellington", cc: "NZ", lat: -41.287, lng: 174.776 },

  // Pakistan
  { name: "Karachi", cc: "PK", lat: 24.861, lng: 67.010 },
  { name: "Lahore", cc: "PK", lat: 31.550, lng: 74.351 },
  { name: "Islamabad", cc: "PK", lat: 33.693, lng: 73.039 },

  // Bangladesh
  { name: "Dhaka", cc: "BD", lat: 23.811, lng: 90.413 },
  { name: "Chittagong", cc: "BD", lat: 22.357, lng: 91.783 },

  // Others
  { name: "Kathmandu", cc: "NP", lat: 27.717, lng: 85.324 },
  { name: "Colombo", cc: "LK", lat: 6.927, lng: 79.862 },
  { name: "Yangon", cc: "MM", aliases: ["Rangoon"], lat: 16.871, lng: 96.199 },
  { name: "Phnom Penh", cc: "KH", lat: 11.557, lng: 104.929 },
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log("🌍 Seeding locations...\n");

  // --- 1. REGIONS ---
  const regionMap = new Map<string, string>(); // name → id
  for (const name of REGIONS) {
    const loc = await prisma.location.upsert({
      where: { name_type_parentId: { name, type: "REGION", parentId: null as unknown as string } },
      update: {},
      create: { name, type: "REGION", aliases: [] },
    }).catch(async () => {
      // Fallback for null parentId unique constraint (Prisma doesn't handle null well in composite unique)
      const existing = await prisma.location.findFirst({ where: { name, type: "REGION", parentId: null } });
      if (existing) return existing;
      return prisma.location.create({ data: { name, type: "REGION", aliases: [] } });
    });
    regionMap.set(name, loc.id);
  }
  console.log(`  ✓ ${REGIONS.length} regions`);

  // --- 2. COUNTRIES ---
  const countryMap = new Map<string, string>(); // "CC" → id
  let countryCount = 0;
  for (const [name, cc, region] of COUNTRIES) {
    const parentId = regionMap.get(region);
    if (!parentId) { console.warn(`  ⚠ Region "${region}" not found for ${name}`); continue; }

    const existing = await prisma.location.findFirst({
      where: { name, type: "COUNTRY", parentId },
    });
    const loc = existing
      ? await prisma.location.update({ where: { id: existing.id }, data: { countryCode: cc } })
      : await prisma.location.create({
          data: { name, type: "COUNTRY", countryCode: cc, parentId, aliases: [] },
        });
    countryMap.set(cc, loc.id);
    countryCount++;
  }
  console.log(`  ✓ ${countryCount} countries`);

  // --- 3. US STATES ---
  const usId = countryMap.get("US");
  const stateMap = new Map<string, string>(); // "CC:StateName" → id
  let stateCount = 0;
  if (usId) {
    for (const [name, aliases] of US_STATES) {
      const existing = await prisma.location.findFirst({
        where: { name, type: "STATE", parentId: usId },
      });
      const loc = existing
        ? await prisma.location.update({ where: { id: existing.id }, data: { aliases, countryCode: "US" } })
        : await prisma.location.create({
            data: { name, type: "STATE", countryCode: "US", parentId: usId, aliases },
          });
      stateMap.set(`US:${name}`, loc.id);
      stateCount++;
    }
  }

  // --- 4. INDIAN STATES ---
  const inId = countryMap.get("IN");
  if (inId) {
    for (const [name, aliases] of INDIAN_STATES) {
      const existing = await prisma.location.findFirst({
        where: { name, type: "STATE", parentId: inId },
      });
      const loc = existing
        ? await prisma.location.update({ where: { id: existing.id }, data: { aliases, countryCode: "IN" } })
        : await prisma.location.create({
            data: { name, type: "STATE", countryCode: "IN", parentId: inId, aliases },
          });
      stateMap.set(`IN:${name}`, loc.id);
      stateCount++;
    }
  }
  console.log(`  ✓ ${stateCount} states`);

  // --- 5. CITIES ---
  let cityCount = 0;
  for (const city of CITIES) {
    // Determine parent: state if specified, otherwise country
    let parentId: string | undefined;
    if (city.state) {
      parentId = stateMap.get(`${city.cc}:${city.state}`);
    }
    if (!parentId) {
      parentId = countryMap.get(city.cc);
    }
    if (!parentId) {
      console.warn(`  ⚠ No parent for city ${city.name} (${city.cc})`);
      continue;
    }

    const existing = await prisma.location.findFirst({
      where: { name: city.name, type: "CITY", parentId },
    });

    if (existing) {
      await prisma.location.update({
        where: { id: existing.id },
        data: {
          aliases: city.aliases || [],
          countryCode: city.cc,
          lat: city.lat || null,
          lng: city.lng || null,
        },
      });
    } else {
      await prisma.location.create({
        data: {
          name: city.name,
          type: "CITY",
          countryCode: city.cc,
          parentId,
          aliases: city.aliases || [],
          lat: city.lat || null,
          lng: city.lng || null,
        },
      });
    }
    cityCount++;
  }
  console.log(`  ✓ ${cityCount} cities`);

  const total = REGIONS.length + countryCount + stateCount + cityCount;
  console.log(`\n🎉 Done! ${total} locations seeded.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
