export interface DiceResult {
  total: number;
  rolls: number[];
  dropped: number[];
  bonus: number;
  breakdown: string;
  notation: string;
}

function rand(sides: number) { return Math.floor(Math.random() * sides) + 1; }

export function rollDice(raw: string): DiceResult {
  const notation = raw.trim();

  // Plain number
  const plain = Number(notation);
  if (!isNaN(plain) && notation !== '') {
    return { total: plain, rolls: [], dropped: [], bonus: plain, breakdown: String(plain), notation };
  }

  // Pattern: NdS[kh|klN][+/-N…]
  const m = notation.toLowerCase().match(
    /^(\d+)d(\d+)(?:(kh|kl)(\d+))?(([-+]\d+)*)$/,
  );
  if (!m) throw new Error(`Notação inválida: ${notation}`);

  const count = parseInt(m[1]);
  const sides = parseInt(m[2]);
  const keepMode = m[3] as 'kh' | 'kl' | undefined;
  const keepN = m[4] ? parseInt(m[4]) : undefined;
  const bonusPart = m[5] ?? '';

  let rolls = Array.from({ length: count }, () => rand(sides));
  let dropped: number[] = [];

  if (keepMode && keepN !== undefined) {
    const asc = [...rolls].sort((a, b) => a - b);
    if (keepMode === 'kh') {
      dropped = asc.slice(0, count - keepN);
      rolls = asc.slice(count - keepN);
    } else {
      dropped = asc.slice(keepN);
      rolls = asc.slice(0, keepN);
    }
  }

  const bonus = bonusPart
    ? (bonusPart.match(/[-+]\d+/g) ?? []).reduce((s, p) => s + parseInt(p), 0)
    : 0;

  const diceSum = rolls.reduce((a, b) => a + b, 0);
  const total = diceSum + bonus;

  const droppedStr = dropped.length ? ` [✗${dropped.join(',')}]` : '';
  const bonusStr = bonus > 0 ? `+${bonus}` : bonus < 0 ? String(bonus) : '';
  const breakdown = `[${rolls.join('+')}]${droppedStr}${bonusStr ? ' ' + bonusStr : ''} = ${total}`;

  return { total, rolls, dropped, bonus, breakdown, notation };
}

export function rollModifier(mod: number): DiceResult {
  const sign = mod >= 0 ? '+' : '';
  return rollDice(`1d20${sign}${mod}`);
}
