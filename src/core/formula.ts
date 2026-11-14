export type VariableMap = Record<string, number>;

export interface FormulaResult {
  ok: boolean;
  value: number;
  formatted: string;
  error?: string;
}

export type WodOutcome = 'success' | 'failure' | 'botch';

export interface WodPoolOptions {
  difficulty?: number;
  specialty?: boolean;
  willpowerAutoSuccess?: boolean;
  modifier?: number;
  isSoak?: boolean;
}

export interface DiceRollResult {
  ok: boolean;
  total: number;
  resolvedExpression: string;
  breakdown: string;
  rolls: number[];
  isCritical?: boolean;
  isFumble?: boolean;
  isPoolRoll?: boolean;
  difficulty?: number;
  specialty?: boolean;
  willpowerUsed?: boolean;
  isSoak?: boolean;
  rawDiceSuccesses?: number;
  onesCount?: number;
  canceledOnes?: number;
  doubledTensCount?: number;
  outcome?: WodOutcome;
  error?: string;
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const ALLOWED_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  round: (x: number) => Math.round(x),
  abs: (x: number) => Math.abs(x),
  min: (...args: number[]) => {
    if (args.length === 0) throw new Error('min() requer argumentos');
    return Math.min(...args);
  },
  max: (...args: number[]) => {
    if (args.length === 0) throw new Error('max() requer argumentos');
    return Math.max(...args);
  },
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') dotCount += 1;
        if (dotCount > 1) throw new Error(`Número inválido próximo a "${numStr}"`);
        numStr += input[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) throw new Error(`Número inválido: ${numStr}`);
      tokens.push({ type: 'num', value: parsed });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        id += input[i];
        i += 1;
      }
      tokens.push({ type: 'id', value: id.toLowerCase() });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }
    throw new Error(`Caractere não suportado: "${ch}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly vars: VariableMap;

  constructor(tokens: Token[], vars: VariableMap) {
    this.tokens = tokens;
    this.vars = vars;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new Error('Fórmula vazia');
    }
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Expressão incompleta ou tokens extras');
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const tok = this.tokens[this.pos];
    this.pos += 1;
    return tok;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
        this.consume();
        const right = this.parseTerm();
        left = tok.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '*' || tok.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        if (tok.value === '/') {
          if (right === 0) throw new Error('Divisão por zero');
          left = left / right;
        } else {
          left = left * right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): number {
    const tok = this.peek();
    if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      this.consume();
      const val = this.parseUnary();
      return tok.value === '-' ? -val : val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) throw new Error('Fim inesperado da fórmula');

    if (tok.type === 'num') {
      this.consume();
      return tok.value;
    }

    if (tok.type === 'lparen') {
      this.consume();
      const val = this.parseExpression();
      const close = this.peek();
      if (close?.type !== 'rparen') throw new Error('Parêntese ")" ausente');
      this.consume();
      return val;
    }

    if (tok.type === 'id') {
      this.consume();
      const next = this.peek();
      if (next?.type === 'lparen') {
        const fn = ALLOWED_FUNCTIONS[tok.value];
        if (!fn) throw new Error(`Função desconhecida: "${tok.value}"`);
        this.consume(); // '('
        const args: number[] = [];
        if (this.peek()?.type !== 'rparen') {
          args.push(this.parseExpression());
          while (this.peek()?.type === 'comma') {
            this.consume();
            args.push(this.parseExpression());
          }
        }
        if (this.peek()?.type !== 'rparen') throw new Error(`Parêntese ")" ausente em ${tok.value}()`);
        this.consume();
        return fn(...args);
      }

      if (Object.prototype.hasOwnProperty.call(this.vars, tok.value)) {
        return this.vars[tok.value];
      }
      throw new Error(`Variável indefinida: "${tok.value}"`);
    }

    throw new Error('Token inesperado na fórmula');
  }
}

export function formatSigned(value: number, showPlus = true): string {
  if (!Number.isFinite(value)) return 'ERR';
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  if (showPlus && rounded >= 0) return `+${rounded}`;
  return `${rounded}`;
}

export function evaluateFormula(
  expression: string,
  vars: VariableMap,
  showPlus = true,
): FormulaResult {
  try {
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, vars);
    const val = parser.parse();
    if (!Number.isFinite(val)) {
      return { ok: false, value: 0, formatted: 'ERR', error: 'Resultado numérico inválido' };
    }
    return {
      ok: true,
      value: val,
      formatted: formatSigned(val, showPlus),
    };
  } catch (err) {
    return {
      ok: false,
      value: 0,
      formatted: 'ERR',
      error: err instanceof Error ? err.message : 'Erro de sintaxe',
    };
  }
}

export function parseWodPoolExpression(
  expression: string,
): { countExpr: string; diffExpr: string } | null {
  const cleaned = expression.trim();
  if (!cleaned) return null;

  const poolFnMatch = cleaned.match(/^pool\((.+)\)$/i);
  if (poolFnMatch) {
    const inner = poolFnMatch[1];
    let depth = 0;
    let splitIdx = -1;
    for (let i = 0; i < inner.length; i += 1) {
      if (inner[i] === '(') depth += 1;
      else if (inner[i] === ')') depth -= 1;
      else if (inner[i] === ',' && depth === 0) {
        splitIdx = i;
        break;
      }
    }
    return {
      countExpr: (splitIdx === -1 ? inner : inner.slice(0, splitIdx)).trim(),
      diffExpr: (splitIdx === -1 ? '6' : inner.slice(splitIdx + 1)).trim(),
    };
  }

  const shortPoolMatch = cleaned.match(/^(.+?)d10\s*(?:@|>=)\s*(\d+)$/i);
  if (shortPoolMatch) {
    return {
      countExpr: shortPoolMatch[1].trim(),
      diffExpr: shortPoolMatch[2].trim(),
    };
  }

  return null;
}

export function isWodPoolExpression(expression: string): boolean {
  return parseWodPoolExpression(expression) !== null;
}

function executeWodPool(
  countExpr: string,
  diffExpr: string,
  vars: VariableMap,
  rng: () => number,
  options: WodPoolOptions = {},
): DiceRollResult {
  const countRes = evaluateFormula(countExpr, vars, false);
  if (!countRes.ok) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: countExpr,
      breakdown: countRes.error ?? 'Erro na parada de dados',
      rolls: [],
      isPoolRoll: true,
      error: countRes.error,
    };
  }

  const diffRes = evaluateFormula(diffExpr, vars, false);
  if (!diffRes.ok && options.difficulty === undefined) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: diffExpr,
      breakdown: diffRes.error ?? 'Dificuldade inválida',
      rolls: [],
      isPoolRoll: true,
      error: diffRes.error,
    };
  }

  const mod =
    typeof options.modifier === 'number' && Number.isFinite(options.modifier)
      ? Math.round(options.modifier)
      : 0;
  const poolSize = Math.max(0, Math.min(30, Math.round(countRes.value) + mod));

  const rawDiff =
    typeof options.difficulty === 'number' && Number.isFinite(options.difficulty)
      ? options.difficulty
      : diffRes.value;
  const difficulty = Math.max(2, Math.min(10, Math.round(rawDiff)));
  const specialty = Boolean(options.specialty);
  const willpowerUsed = Boolean(options.willpowerAutoSuccess);
  const isSoak = Boolean(options.isSoak);

  const rolls: number[] = [];
  let rawDiceSuccesses = 0;
  let onesCount = 0;
  let doubledTensCount = 0;
  let anyDieMetTarget = false;

  for (let i = 0; i < poolSize; i += 1) {
    const roll = Math.floor(rng() * 10) + 1;
    rolls.push(roll);
    if (roll >= difficulty) {
      anyDieMetTarget = true;
      if (roll === 10 && specialty) {
        rawDiceSuccesses += 2;
        doubledTensCount += 1;
      } else {
        rawDiceSuccesses += 1;
      }
    }
    if (roll === 1) onesCount += 1;
  }

  // 1s cancel only successes generated by the dice (clamped at 0 before Willpower)
  const diceSuccessesAfterOnes = Math.max(0, rawDiceSuccesses - onesCount);
  const canceledOnes = Math.min(rawDiceSuccesses, onesCount);
  const finalTotal = diceSuccessesAfterOnes + (willpowerUsed ? 1 : 0);

  // Botch only when finalTotal == 0, no die met Target Number, at least one 1 rolled, Willpower NOT used, and NOT a Soak roll
  const isBotch =
    !isSoak &&
    poolSize > 0 &&
    finalTotal === 0 &&
    !anyDieMetTarget &&
    onesCount > 0 &&
    !willpowerUsed;
  const outcome: WodOutcome = isBotch ? 'botch' : finalTotal > 0 ? 'success' : 'failure';
  const isExceptional = outcome === 'success' && finalTotal >= 5;

  const statusText = isBotch
    ? 'BOTCH!'
    : outcome === 'failure'
      ? isSoak
        ? '0 SOAKED · FAILURE'
        : '0 SUCESSOS · FAILURE'
      : isSoak
        ? `${finalTotal} SOAKED`
        : `${finalTotal} ${finalTotal === 1 ? 'SUCESSO' : 'SUCESSOS'}`;

  const extraTags = [
    specialty ? 'SPEC' : null,
    willpowerUsed ? '+1 WP' : null,
    isSoak ? 'SOAK' : null,
  ].filter(Boolean);

  const resolvedExpression =
    extraTags.length > 0
      ? `${poolSize}d10 (DIFF ${difficulty} · ${extraTags.join(' · ')})`
      : `${poolSize}d10 (DIFF ${difficulty})`;

  const detailParts: string[] = [];
  if (doubledTensCount > 0) detailParts.push(`10s×2 (+${doubledTensCount})`);
  if (canceledOnes > 0) detailParts.push(`-${canceledOnes} CANC BY 1s`);
  if (willpowerUsed) detailParts.push('+1 WP AUTO');
  const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(' · ')})` : '';

  return {
    ok: true,
    total: finalTotal,
    resolvedExpression,
    breakdown: `${poolSize}d10[${rolls.join(', ')}] ≥${difficulty}${detailSuffix} → ${statusText}`,
    rolls,
    isCritical: isExceptional,
    isFumble: isBotch,
    isPoolRoll: true,
    difficulty,
    specialty,
    willpowerUsed,
    isSoak,
    rawDiceSuccesses,
    onesCount,
    canceledOnes,
    doubledTensCount,
    outcome,
  };
}

export function rollDiceExpression(
  expression: string,
  vars: VariableMap,
  rng: () => number = Math.random,
  options: WodPoolOptions = {},
): DiceRollResult {
  const cleaned = expression.trim();
  if (!cleaned) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: '',
      breakdown: 'Expressão vazia',
      rolls: [],
      error: 'Expressão de rolagem vazia',
    };
  }

  const parsedPool = parseWodPoolExpression(cleaned);
  if (parsedPool) {
    return executeWodPool(parsedPool.countExpr, parsedPool.diffExpr, vars, rng, options);
  }

  // Replace known variable identifiers (non-dice identifiers) with their numeric values
  const substituted = cleaned.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
    const lower = match.toLowerCase();
    if (/^d\d+$/i.test(lower)) {
      return `1${lower}`;
    }
    if (Object.prototype.hasOwnProperty.call(vars, lower)) {
      const val = vars[lower];
      return val < 0 ? `(${val})` : `${val}`;
    }
    return match;
  });

  const allRolls: number[] = [];
  const diceDisplayParts: string[] = [];
  let hasSingleD20 = false;
  let singleD20Roll = 0;

  let diceCount = 0;
  const mathExpr = substituted.replace(/(\d*)d(\d+)/gi, (_full, countStr: string, sidesStr: string) => {
    const count = countStr ? Number(countStr) : 1;
    const sides = Number(sidesStr);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new Error(`Quantidade de dados inválida: ${count}`);
    }
    if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
      throw new Error(`Lados do dado inválidos: d${sides}`);
    }
    diceCount += 1;
    const rolls: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const roll = Math.floor(rng() * sides) + 1;
      rolls.push(roll);
      allRolls.push(roll);
    }
    if (count === 1 && sides === 20 && diceCount === 1) {
      hasSingleD20 = true;
      singleD20Roll = rolls[0];
    } else {
      hasSingleD20 = false;
    }
    const sum = rolls.reduce((acc, n) => acc + n, 0);
    diceDisplayParts.push(`${count}d${sides}[${rolls.join(',')}]`);
    return `${sum}`;
  });

  const evalResult = evaluateFormula(mathExpr, vars, false);
  if (!evalResult.ok) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: substituted,
      breakdown: evalResult.error ?? 'Erro na rolagem',
      rolls: allRolls,
      error: evalResult.error,
    };
  }

  const prettyResolved = mathExpr
    .replace(/\+\s*\(-(\d+)\)/g, '- $1')
    .replace(/\+\s*-(\d+)/g, '- $1')
    .replace(/\s+/g, ' ')
    .trim();

  const prettyFormula = substituted
    .replace(/\+\s*\(-(\d+)\)/g, '- $1')
    .replace(/\+\s*-(\d+)/g, '- $1')
    .replace(/\s+/g, ' ')
    .trim();

  const breakdown =
    diceDisplayParts.length > 0
      ? `${diceDisplayParts.join(' + ')} → ${prettyResolved}`
      : prettyResolved;

  return {
    ok: true,
    total: Math.round(evalResult.value),
    resolvedExpression: prettyFormula,
    breakdown,
    rolls: allRolls,
    isCritical: hasSingleD20 && singleD20Roll === 20,
    isFumble: hasSingleD20 && singleD20Roll === 1,
  };
}
