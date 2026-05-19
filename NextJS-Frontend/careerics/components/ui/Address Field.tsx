"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, City } from "country-state-city";

interface AddressFieldProps {
  label?: string;
  isMargin?: boolean;
  layout?: "column" | "row";
  disabled?: boolean;
}

export default function AddressField({
  label = "Address",
  isMargin = true,
  layout = "column",
  disabled = false,
}: AddressFieldProps) {
  const isRow = layout === "row";

  const countries = useMemo(() => Country.getAllCountries(), []);

  const [countryCode, setCountryCode] = useState<string>("");
  const [city, setCity] = useState<string>("");

  const cities = useMemo(() => {
    if (!countryCode) return [];
    return City.getCitiesOfCountry(countryCode) || [];
  }, [countryCode]);

  useEffect(() => {
    setCity("");
  }, [countryCode]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xxs)",
        ...(isMargin && { marginBottom: "var(--space-md)" }),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isRow ? "row" : "column",
          alignItems: isRow ? "center" : "flex-start",
          gap: "var(--space-md)",
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-nova-square)",
            fontSize: "var(--text-base)",
            color: "white",
            margin: 0,
            minWidth: isRow ? "10ch" : "auto",
          }}
        >
          {label}
        </p>

        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            width: "100%",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Country */}
          <select
            value={countryCode}
            disabled={disabled}
            onChange={(e) => setCountryCode(e.target.value)}
            style={{
              flex: 1,
              width: "100%",
              padding: "var(--space-xs)",
              fontFamily: "var(--font-nova-square)",
              borderRadius: "var(--radius-md)",
              border: "none",
              backgroundColor: "white",
              outline: "none",
              minWidth: 0,
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: "var(--text-sm)",
            }}
          >
            <option value="">Country</option>
            {countries.map((country) => (
              <option key={country.isoCode} value={country.isoCode}>
                {country.name}
              </option>
            ))}
          </select>

          {/* City */}
          <select
            value={city}
            disabled={!countryCode || disabled}
            onChange={(e) => setCity(e.target.value)}
            style={{
              flex: 1,
              width: "100%",
              padding: "var(--space-xs)",
              fontSize: "var(--text-sm)",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontFamily: "var(--font-nova-square)",
              backgroundColor: "white",
              outline: "none",
              minWidth: 0,
              cursor: !countryCode || disabled ? "not-allowed" : "pointer",
            }}
          >
            <option value="">City</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}