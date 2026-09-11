// Shared timezone data + formatting for every "pick a timezone" control in the app
// (campaign create, campaign settings automation, import-run automation).
//
// A curated IANA list keeps the dropdown scannable, while the labels are the
// *friendly* zone names ("Pacific Daylight Time") derived from Intl — so type-ahead
// finds a zone by its common name, not just its IANA path. The value stored is always
// the IANA name, so daylight saving is handled by the tz database on both ends.

export const TIMEZONES = [
  'Pacific/Niue',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Caracas',
  'America/Sao_Paulo',
  'America/St_Johns',
  'Atlantic/Azores',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Kabul',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Yangon',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Pacific/Guadalcanal',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Tongatapu',
  'Pacific/Kiritimati',
];

export interface TimezoneOption {
  value: string;
  label: string;
  subLabel: string;
  offset: number;
}

/** Friendly name + short offset for an IANA zone, e.g. "Pacific Daylight Time" / "GMT-7". */
export function formatTimezone(ianaName: string): { label: string; subLabel: string } {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaName,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    const offset = tzPart ? tzPart.value : '';

    let displayOffset = offset;
    if (offset.startsWith('GMT')) {
      const sign = offset.charAt(3);
      if (sign === '+' || sign === '-') {
        const timePart = offset.slice(4);
        const [hours, minutes] = timePart.split(':');
        const parsedHours = parseInt(hours, 10);
        displayOffset = `GMT${sign}${parsedHours}${minutes && minutes !== '00' ? `:${minutes}` : ''}`;
      } else {
        displayOffset = 'GMT';
      }
    }

    const nameFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaName,
      timeZoneName: 'long',
    });
    const nameParts = nameFormatter.formatToParts(date);
    const namePart = nameParts.find(p => p.type === 'timeZoneName');
    let friendlyName = namePart ? namePart.value : ianaName;

    if (friendlyName.includes('GMT') || friendlyName.includes('Coordinated Universal Time')) {
      if (ianaName === 'UTC') friendlyName = 'Coordinated Universal Time';
      else friendlyName = ianaName.split('/').pop()?.replace(/_/g, ' ') || ianaName;
    }

    return { label: friendlyName, subLabel: displayOffset };
  } catch {
    return { label: ianaName, subLabel: 'GMT' };
  }
}

/** Numeric UTC offset in hours, used only to sort the list west-to-east. */
export function getNumericOffset(ianaName: string): number {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaName,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    const offset = tzPart ? tzPart.value : '';

    if (offset === 'GMT') return 0;
    const sign = offset.charAt(3) === '-' ? -1 : 1;
    const timePart = offset.slice(4);
    const [hours, minutes] = timePart.split(':');
    return sign * (parseInt(hours, 10) + parseInt(minutes || '0', 10) / 60);
  } catch {
    return 0;
  }
}

/** Options for a single-select timezone dropdown, offset-sorted, always including
 *  `current` even if it is not one of the curated zones (so a saved zone shows). */
export function timezoneOptions(current: string): TimezoneOption[] {
  const zones = Array.from(
    new Set(TIMEZONES.includes(current) ? TIMEZONES : [current, ...TIMEZONES].filter(Boolean)),
  );
  return zones
    .map(tz => {
      const { label, subLabel } = formatTimezone(tz);
      return { value: tz, label, subLabel, offset: getNumericOffset(tz) };
    })
    .sort((a, b) => a.offset - b.offset);
}
