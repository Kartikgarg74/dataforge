/**
 * NL-to-SQL Generation Utilities
 *
 * Provides prompt building, SQL extraction, and validation functions
 * for translating natural language queries into safe, read-only SQL.
 */

/** Keywords that are not allowed in generated SQL */
const DISALLOWED_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'CALL',
  'MERGE',
  'RENAME',
] as const;

/**
 * Build a system prompt for NL-to-SQL translation.
 *
 * Constructs a comprehensive prompt that includes the database schema context,
 * conversation history for follow-up queries, and instructions that constrain
 * the LLM to generate only safe, read-only SELECT queries.
 *
 * @param userQuery - The user's natural language question
 * @param schemaContext - Formatted schema context from buildSchemaContext()
 * @param conversationHistory - Optional prior messages for follow-up context
 * @returns The complete prompt string to send to the LLM
 */
export function buildNLtoSQLPrompt(
  userQuery: string,
  schemaContext: string,
  conversationHistory?: string[]
): string {
  const sections: string[] = [];

  sections.push(
    'You are an expert SQL analyst. Your job is to translate natural language questions into SQL queries.'
  );
  sections.push('');

  // Rules
  sections.push('Rules:');
  sections.push('- Generate ONLY SELECT or WITH (CTE) queries. Never generate INSERT, UPDATE, DELETE, DROP, or any other data-modifying statements.');
  sections.push('- Use ONLY the table and column names provided in the schema below.');
  sections.push('- If the question cannot be answered with the available schema, explain why instead of guessing.');
  sections.push('- Prefer explicit column names over SELECT *.');
  sections.push('- Include appropriate JOINs when the question involves multiple tables.');
  sections.push('- Use aliases for readability when joining tables.');
  sections.push('- Wrap your SQL in a ```sql code block.');
  sections.push('');

  // Schema context
  sections.push('--- DATABASE SCHEMA ---');
  sections.push(schemaContext);
  sections.push('--- END SCHEMA ---');
  sections.push('');

  // Conversation history (formatted as Q&A pairs for follow-up context)
  if (conversationHistory?.length) {
    sections.push('--- CONVERSATION HISTORY ---');
    sections.push('Previous questions and their generated SQL (use for follow-up context):');
    for (let i = 0; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      // Detect if this is a user message or assistant SQL response
      if (msg.trim().toUpperCase().startsWith('SELECT') || msg.trim().toUpperCase().startsWith('WITH')) {
        sections.push(`SQL: ${msg}`);
      } else {
        sections.push(`Q: ${msg}`);
      }
    }
    sections.push('--- END HISTORY ---');
    sections.push('');
    sections.push(
      'If the user\'s question refers to a previous query (e.g., "break that down by...", ' +
      '"now show...", "same but..."), use the previous SQL as a starting point.'
    );
    sections.push('');
  }

  // User query
  sections.push(`User question: ${userQuery}`);

  return sections.join('\n');
}

/**
 * Extract SQL from an LLM response.
 *
 * Looks for SQL in ```sql code blocks first, then falls back to detecting
 * bare SELECT or WITH statements in the response text.
 *
 * @param response - The raw LLM response text
 * @returns The extracted SQL string, or null if no valid SQL was found
 */
export function extractSQLFromResponse(response: string): string | null {
  // Try to extract from ```sql code blocks
  const codeBlockMatch = response.match(/```sql\s*\n?([\s\S]*?)```/i);
  if (codeBlockMatch) {
    const sql = codeBlockMatch[1].trim();
    if (sql.length > 0) {
      return sql;
    }
  }

  // Try to extract from generic ``` code blocks
  const genericBlockMatch = response.match(/```\s*\n?([\s\S]*?)```/);
  if (genericBlockMatch) {
    const content = genericBlockMatch[1].trim();
    if (/^\s*(SELECT|WITH)\b/i.test(content)) {
      return content;
    }
  }

  // Fall back to detecting bare SELECT/WITH statements
  const statementMatch = response.match(
    /\b((?:WITH\s+[\s\S]*?\)\s*)?SELECT\b[\s\S]*?)(?:;|\n\n|$)/i
  );
  if (statementMatch) {
    const sql = statementMatch[1].trim().replace(/;$/, '').trim();
    if (sql.length > 0) {
      return sql;
    }
  }

  return null;
}

/**
 * Validate that generated SQL is safe and read-only.
 *
 * Checks that the SQL starts with SELECT or WITH and does not contain
 * any disallowed keywords that could modify data or schema.
 *
 * @param sql - The SQL string to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateGeneratedSQL(
  sql: string
): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'SQL query is empty' };
  }

  // Must start with SELECT or WITH
  if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
    return {
      valid: false,
      error: 'Query must start with SELECT or WITH (CTE)',
    };
  }

  // Strip string literals and comments to avoid false positives
  const sanitized = trimmed
    .replace(/'[^']*'/g, "''")       // Remove single-quoted strings
    .replace(/"[^"]*"/g, '""')       // Remove double-quoted identifiers
    .replace(/--[^\n]*/g, '')        // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .toUpperCase();

  // Check for disallowed keywords
  for (const keyword of DISALLOWED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(sanitized)) {
      return {
        valid: false,
        error: `Disallowed keyword found: ${keyword}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Build a prompt specifically for follow-up queries.
 *
 * Given an original question/SQL pair, constructs a prompt that helps
 * the LLM modify the original SQL to answer the follow-up question.
 *
 * @param originalQuery - The original natural language question
 * @param originalSQL - The SQL generated for the original question
 * @param followUpQuery - The follow-up natural language question
 * @param schemaContext - Formatted schema context from buildSchemaContext()
 * @returns The complete follow-up prompt string
 */
export function buildFollowUpPrompt(
  originalQuery: string,
  originalSQL: string,
  followUpQuery: string,
  schemaContext: string
): string {
  const sections: string[] = [];

  sections.push(
    'You are an expert SQL analyst. Your job is to modify an existing SQL query based on a follow-up request.'
  );
  sections.push('');

  sections.push('Rules:');
  sections.push('- Generate ONLY SELECT or WITH (CTE) queries. Never generate data-modifying statements.');
  sections.push('- Use ONLY the table and column names provided in the schema below.');
  sections.push('- Build upon the original SQL query to answer the follow-up question.');
  sections.push('- Prefer explicit column names over SELECT *.');
  sections.push('- Wrap your SQL in a ```sql code block.');
  sections.push('');

  sections.push('--- DATABASE SCHEMA ---');
  sections.push(schemaContext);
  sections.push('--- END SCHEMA ---');
  sections.push('');

  sections.push('--- ORIGINAL QUERY ---');
  sections.push(`Question: ${originalQuery}`);
  sections.push(`SQL:`);
  sections.push('```sql');
  sections.push(originalSQL);
  sections.push('```');
  sections.push('--- END ORIGINAL QUERY ---');
  sections.push('');

  sections.push(
    `Follow-up request: ${followUpQuery}`
  );
  sections.push('');
  sections.push(
    'Modify the original SQL above to satisfy the follow-up request. ' +
    'Keep as much of the original query structure as possible.'
  );

  return sections.join('\n');
}
