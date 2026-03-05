"use client";

import { useState, useEffect, useCallback } from "react";

interface UserCountry {
  countryCode: string;
  countryName: string;
}

interface UseUserCountryReturn {
  country: UserCountry | null;
  loading: boolean;
  detecting: boolean;
  requestLocation: () => void;
}

export function useUserCountry(): UseUserCountryReturn {
  const [country, setCountry] = useState<UserCountry | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  // Check if user already has a saved country
  useEffect(() => {
    fetch("/api/user/location")
      .then((res) => res.json())
      .then((data) => {
        if (data.countryCode && data.countryName) {
          setCountry({ countryCode: data.countryCode, countryName: data.countryName });
        }
      })
      .catch((err) => console.error("Failed to fetch user location:", err))
      .finally(() => setLoading(false));
  }, []);

  const detectAndSave = useCallback(async (lat: number, lng: number) => {
    try {
      // Free reverse geocoding — no API key needed
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      );
      const data = await res.json();

      const countryCode = data.countryCode;
      const countryName = data.countryName;

      if (countryCode && countryName) {
        // Save to user profile
        await fetch("/api/user/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryCode, countryName }),
        });

        setCountry({ countryCode, countryName });
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    } finally {
      setDetecting(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      return;
    }

    setDetecting(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        detectAndSave(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("Geolocation denied:", err.message);
        setDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [detectAndSave]);

  // Auto-detect on first load if no country saved
  useEffect(() => {
    if (!loading && !country) {
      requestLocation();
    }
  }, [loading, country, requestLocation]);

  return { country, loading, detecting, requestLocation };
}
