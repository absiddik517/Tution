export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  // If it already matches dd-mm-yyyy, return it
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  
  // Check if it's YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }
  
  // Fallback: try parsing as Date
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}-${m}-${y}`;
    }
  } catch (e) {}
  
  return dateStr;
}

export function formatTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  // If it already has AM or PM (case-insensitive), return it
  if (/[a-p]m/i.test(timeStr)) return timeStr;
  
  // Try to parse HH:MM
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  }
  return timeStr;
}
