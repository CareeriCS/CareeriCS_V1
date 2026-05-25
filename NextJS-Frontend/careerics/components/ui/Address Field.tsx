"use client";

import { useMemo, useState } from "react";
import { Country, City } from "country-state-city";

interface AddressFieldProps {
  label?: string;
  isMargin?: boolean;
  layout?: "column" | "row";
  disabled?: boolean;
  country?: string;
  city?: string;
  onCountryChange?: (country: string, countryCode: string) => void;
  onCityChange?: (city: string) => void;
}

export default function AddressField({
  label = "Address",
  isMargin = true,
  layout = "column",
  disabled = false,
  country,
  city,
  onCountryChange,
  onCityChange,
}: AddressFieldProps) {
  const isRow = layout === "row";

  const countries = useMemo(() => Country.getAllCountries(), []);

  const [internalCountryCode, setInternalCountryCode] = useState<string>("");
  const [internalCity, setInternalCity] = useState<string>("");

  const resolvedCountryCode = useMemo(() => {
    if (country === undefined) {
      return internalCountryCode;
    }

    const normalizedCountry = country.trim().toLowerCase();
    if (!normalizedCountry) {
      return "";
    }

    const byIsoCode = countries.find(
      (entry) => entry.isoCode.toLowerCase() === normalizedCountry,
    );
    if (byIsoCode) {
      return byIsoCode.isoCode;
    }

    const byName = countries.find(
      (entry) => entry.name.trim().toLowerCase() === normalizedCountry,
    );
    return byName?.isoCode ?? "";
  }, [countries, country, internalCountryCode]);

  const resolvedCity = city === undefined ? internalCity : city;

  const cities = useMemo(() => {
    if (!resolvedCountryCode) return [];
    return City.getCitiesOfCountry(resolvedCountryCode) || [];
  }, [resolvedCountryCode]);

  const handleCountryChange = (value: string) => {
    if (country === undefined) {
      setInternalCountryCode(value);
    }
    if (city === undefined) {
      setInternalCity("");
    }

    if (!onCountryChange) {
      return;
    }

    const selectedCountry = countries.find((entry) => entry.isoCode === value);
    onCountryChange(selectedCountry?.name ?? "", value);
  };

  const handleCityChange = (value: string) => {
    if (city === undefined) {
      setInternalCity(value);
    }
    onCityChange?.(value);
  };

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
            value={resolvedCountryCode}
            disabled={disabled}
            onChange={(e) => handleCountryChange(e.target.value)}
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
            value={resolvedCity}
            disabled={!resolvedCountryCode || disabled}
            onChange={(e) => handleCityChange(e.target.value)}
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
              cursor: !resolvedCountryCode || disabled ? "not-allowed" : "pointer",
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
