/**
 * Zone groupings for the region dropdown. India follows the standard zonal
 * councils (plus North-East). States are matched to gazetteer admin1 rows by
 * name at query time, so this stays free of GeoNames code coupling.
 */
export interface ZoneDef {
  key: string;
  label: string;
  states: string[];
}

export const INDIA_ZONES: ZoneDef[] = [
  {
    key: "NORTH",
    label: "Northern",
    states: [
      "Chandigarh", "Delhi", "Haryana", "Himachal Pradesh",
      "Jammu and Kashmir", "Ladakh", "Punjab", "Rajasthan",
    ],
  },
  {
    key: "CENTRAL",
    label: "Central",
    states: ["Chhattisgarh", "Madhya Pradesh", "Uttar Pradesh", "Uttarakhand"],
  },
  {
    key: "EAST",
    label: "Eastern",
    states: ["Bihar", "Jharkhand", "Odisha", "West Bengal"],
  },
  {
    key: "WEST",
    label: "Western",
    states: [
      "Goa", "Gujarat", "Maharashtra",
      "Dadra and Nagar Haveli and Daman and Diu",
    ],
  },
  {
    key: "SOUTH",
    label: "Southern",
    states: [
      "Andhra Pradesh", "Karnataka", "Kerala", "Puducherry",
      "Tamil Nadu", "Telangana",
    ],
  },
  {
    key: "NORTHEAST",
    label: "North-Eastern",
    states: [
      "Assam", "Arunachal Pradesh", "Manipur", "Meghalaya",
      "Mizoram", "Nagaland", "Sikkim", "Tripura",
    ],
  },
];

export const ZONES_BY_COUNTRY: Record<string, ZoneDef[]> = {
  IN: INDIA_ZONES,
};
