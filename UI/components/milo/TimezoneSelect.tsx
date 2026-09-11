'use client';

// The single timezone picker used everywhere (campaign create + settings automation
// + import-run automation). Searchable by friendly zone name ("Pacific Daylight
// Time"), backed by the shared curated list in ./timezones. Value is an IANA name.

import React from 'react';
import { SingleSelectDropdown } from './Dropdowns';
import { timezoneOptions } from './timezones';

export function TimezoneSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select timezone…',
  searchPlaceholder = 'Search timezone',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const options = React.useMemo(() => timezoneOptions(value), [value]);
  return (
    <div style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
      <SingleSelectDropdown
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        searchable
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  );
}

export default TimezoneSelect;
