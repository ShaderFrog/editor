export const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
export const capitalCase = (s: string) =>
  s.split(' ').map(capitalize).join(' ');

export const truncate = (s: string, limit = 32) =>
  s.length > limit ? s.substring(0, limit).replace(/\s+$/, '') + '…' : s;

export const camelCaseToWords = (s: string) => {
  const result = s.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const dashCaseToWords = (s: string) =>
  s.split('-').map(capitalize).join(' ');
