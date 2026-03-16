import { z } from "zod";

// FuelWatch station schema
export const fuelStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  suburb: z.string(),
  address: z.string(),
  phone: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  price: z.number(),
  fuelType: z.string(),
  date: z.string(),
  siteFeatures: z.string().optional(),
});

export type FuelStation = z.infer<typeof fuelStationSchema>;

export const fuelTypeOptions = [
  { value: "1", label: "Unleaded 91" },
  { value: "2", label: "Premium 95" },
  { value: "4", label: "Diesel" },
] as const;

export const waRegions = [
  { value: "25", label: "All Metro" },
  { value: "26", label: "All Country" },
  { value: "1", label: "Boulder" },
  { value: "2", label: "Bunbury" },
  { value: "3", label: "Busselton" },
  { value: "4", label: "Carnarvon" },
  { value: "5", label: "Collie" },
  { value: "6", label: "Dampier" },
  { value: "7", label: "Donnybrook" },
  { value: "8", label: "Esperance" },
  { value: "9", label: "Geraldton" },
  { value: "10", label: "Kalgoorlie" },
  { value: "11", label: "Karratha" },
  { value: "12", label: "Kununurra" },
  { value: "13", label: "Mandurah" },
  { value: "14", label: "Narrogin" },
  { value: "15", label: "Northam" },
  { value: "16", label: "Port Hedland" },
  { value: "17", label: "South Hedland" },
  { value: "18", label: "Tom Price" },
  { value: "19", label: "NW Metro" },
  { value: "20", label: "NE Metro" },
  { value: "21", label: "SE Metro" },
  { value: "22", label: "SW Metro" },
  { value: "23", label: "East Hills" },
  { value: "24", label: "Armadale/Roleystone" },
] as const;
