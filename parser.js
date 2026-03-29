/**
 * Parses natural language input to extract expense data.
 */
function parseText(input) {
  const normalized = input.toLowerCase();

  // 1. Extract Amount (Looks for numbers, optionally with ₹ or $)
  const amountMatch = normalized.match(/(?:₹|rs\.?|\$)?\s*(\d+(\.\d{1,2})?)\s*(rupees|rs|dollars|bucks)?/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // 2. Extract Date (Handles "today", "yesterday", "X days ago")
  let date = new Date();
  if (normalized.includes('yesterday')) {
      date.setDate(date.getDate() - 1);
  } else if (normalized.match(/(\d+)\s+days?\s+ago/)) {
      const days = parseInt(normalized.match(/(\d+)\s+days?\s+ago/)[1]);
      date.setDate(date.getDate() - days);
  }
  const dateStr = date.toISOString().split('T')[0];
  
  // 3. Extract Category (Improved for multi-word like "cold drink")
  let category = "General";
  const categoryMatch = normalized.match(/(?:on|for)\s+(.+)$/);
  
  if (categoryMatch) {
      let rawCategory = categoryMatch[1].trim();
      
      // Clean up common trailing words that shouldn't be in the category
      const dateKeywords = ['today', 'yesterday', 'tomorrow', 'now'];
      const words = rawCategory.split(/\s+/);
      const filteredWords = words.filter(word => !dateKeywords.includes(word.toLowerCase()));
      
      if (filteredWords.length > 0) {
          category = filteredWords
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
      }
  }

  return { amount, category, date: dateStr, description: input.trim() };
}

/**
 * Parses "total" commands to find a time range.
 * Returns: "today", "week", "month", "year", or "all"
 */
function parseSummaryRange(input) {
    const text = input.toLowerCase();
    if (text.includes('today')) return 'today';
    if (text.includes('week')) return 'week';
    if (text.includes('month')) return 'month';
    if (text.includes('year')) return 'year';
    return 'all';
}

module.exports = { parseText, parseSummaryRange };
