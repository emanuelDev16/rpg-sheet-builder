export interface GroundedSource {
  title: string;
  uri: string;
}

export interface RulesSearchResponse {
  ok: boolean;
  query: string;
  answer: string;
  sources: GroundedSource[];
  searchQueries: string[];
  error?: string;
}

export interface RawGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export function validateRulesQuery(rawQuery: unknown): {
  ok: boolean;
  query: string;
  error?: string;
} {
  if (typeof rawQuery !== 'string') {
    return { ok: false, query: '', error: 'Consulta inválida.' };
  }
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      query: trimmed,
      error: 'Digite pelo menos 2 caracteres para pesquisar uma regra.',
    };
  }
  if (trimmed.length > 300) {
    return {
      ok: false,
      query: trimmed,
      error: 'A consulta deve ter no máximo 300 caracteres.',
    };
  }
  return { ok: true, query: trimmed };
}

export interface LocalRuleContextExcerpt {
  bookTitle: string;
  page: number;
  excerpt: string;
}

export function buildRulesSearchPrompt(query: string, systemName?: string): string {
  const sys = systemName?.trim();
  if (sys) {
    return `System context: ${sys}. Tabletop RPG rule query: "${query}". Provide a concise, accurate, practical rules summary (dice mechanics, difficulties, edge cases, and step-by-step resolution if applicable). Answer in the same language as the user's query (default Portuguese or English as queried).`;
  }
  return `Tabletop RPG rule query: "${query}". Provide a concise, accurate, practical rules summary with mechanics and resolution steps.`;
}

export function buildLocalRagPrompt(
  query: string,
  excerpts: LocalRuleContextExcerpt[],
  systemName?: string,
): string {
  const topExcerpts = excerpts.slice(0, 5);
  const contextBlocks = topExcerpts
    .map(
      (item, idx) =>
        `[${idx + 1}] Book: "${item.bookTitle}" | Page: ${item.page}\nExcerpt: ${item.excerpt}`,
    )
    .join('\n\n');

  const sysLine = systemName?.trim() ? `System: ${systemName.trim()}\n` : '';
  return `${sysLine}Rule Query: "${query}"

Retrieved Local PDF Excerpts (use ONLY these excerpts as factual context and cite [Book, p. X]):
${contextBlocks}

Instructions:
- Answer concisely (~120 words max) in the same language as the query.
- Ground every rule detail exclusively in the excerpts above and cite page numbers.
- If the excerpts do not contain enough detail to answer fully, state clearly what is missing.`;
}

export function extractGroundedSources(chunks: RawGroundingChunk[] | undefined): GroundedSource[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundedSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    // Allow only http/https URLs
    if (!/^https?:\/\//i.test(uri)) continue;
    seen.add(uri);
    const rawTitle = chunk?.web?.title?.trim();
    let fallbackHost = uri;
    try {
      fallbackHost = new URL(uri).hostname;
    } catch {
      fallbackHost = uri;
    }
    sources.push({
      title: rawTitle || fallbackHost,
      uri,
    });
  }
  return sources;
}

export function formatRulesSearchError(rawMessage: string): { status: number; message: string } {
  const normalized = rawMessage.trim();
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(normalized)) {
    return {
      status: 429,
      message:
        'Limite de cota da busca atingido no momento (429). Aguarde alguns instantes e tente novamente.',
    };
  }
  if (/PERMISSION_DENIED|API_KEY_INVALID|403/i.test(normalized)) {
    return {
      status: 502,
      message: 'Chave GEMINI_API_KEY inválida ou sem permissão para Google Search.',
    };
  }

  // Try extracting nested API JSON error message without exposing raw JSON blobs
  const jsonStart = normalized.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(normalized.slice(jsonStart)) as {
        error?: { message?: string; code?: number };
      };
      if (parsed?.error?.message) {
        const cleanMsg = parsed.error.message.replace(/https?:\/\/\S+/g, '').trim();
        return {
          status: typeof parsed.error.code === 'number' && parsed.error.code >= 400 ? 502 : 500,
          message: `Erro na busca: ${cleanMsg || 'serviço indisponível.'}`,
        };
      }
    } catch {
      // Ignore malformed JSON tail
    }
  }

  return {
    status: 500,
    message: `Falha na consulta ao Google Search: ${normalized.slice(0, 180)}`,
  };
}

