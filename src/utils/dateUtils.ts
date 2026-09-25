/**
 * Date and Time utilities for Brasília Timezone (America/Sao_Paulo) with resilient international fallbacks
 */

/**
 * Returns the current date in Brasília (America/Sao_Paulo) as a "YYYY-MM-DD" string.
 * Resilient against environments where 'America/Sao_Paulo' timezone database is unavailable.
 */
export function getBrasiliaDateStr(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Fallback if America/Sao_Paulo is rejected on international devices or strict privacy modes
  }

  // Fallback: manually calculate Brasília time (UTC - 3 hours)
  const now = new Date();
  const brasiliaTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const year = brasiliaTime.getUTCFullYear();
  const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a Date object to its local "YYYY-MM-DD" string format, keeping the same year/month/day
 * without any UTC or timezone offset shifting.
 */
export function toLocalDateStr(date: Date): string {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Formats any Date object to "YYYY-MM-DD" considering specifically the Brasília Timezone.
 */
export function formatToBrasiliaDateStr(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Fallback: manual UTC-3
  }

  const brasiliaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const year = brasiliaTime.getUTCFullYear();
  const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets a beautiful short representation of current Brasília date for headers or displays.
 */
export function getBrasiliaUiDateStr(): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  } catch (e) {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date());
    } catch (err) {
      return new Date().toLocaleDateString('pt-BR');
    }
  }
}

/**
 * Formats a Date to a safe, resilient timestamp string (DD/MM/YYYY HH:mm:ss)
 */
export function formatSafeBrasiliaTimestamp(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  } catch (e) {
    try {
      return date.toLocaleString('pt-BR');
    } catch (err) {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }
  }
}
