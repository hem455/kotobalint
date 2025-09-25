/**
 * シークレット検知機能
 * 機密情報が含まれている場合は送信を拒否する
 */

/**
 * Luhnアルゴリズムによるクレジットカード番号検証
 */
function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  // 右から左へ処理
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * クレジットカード番号の検証
 */
function isValidCreditCard(text: string): boolean {
  const cardMatch = /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/.exec(text);
  if (!cardMatch) {
    return false;
  }
  
  const normalizedCardNumber = cardMatch[0].replace(/[-\s]/g, '');
  return isValidLuhn(normalizedCardNumber);
}

// 単一ソース: パターンとラベル
type SecretDefinition = { pattern: RegExp; label: string };

const secretDefinitions: SecretDefinition[] = [
  { pattern: /sk-(?:proj-|svcacct-|None-)?[^\s'\"]{16,}/, label: 'OpenAI API Key' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, label: 'Google API Key' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key' },
  { pattern: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/, label: 'Private Key' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub PAT' },
  { pattern: /github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}/, label: 'GitHub Fine-grained PAT' },
  { pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/, label: 'SSN' },
  { pattern: /\b[A-Z]{2}[0-9]{7}\b/, label: 'Passport' },
];

// 文脈ベースの運転免許証番号検出（キーワード近傍±50文字に12桁連番）
function hasDriverLicenseWithContext(text: string): boolean {
  const keyword = /(運転免許証|免許証|免許番号|運転免許|driver\s*license)/i;
  const digit12 = /\b\d{12}\b/g;
  let m: RegExpExecArray | null;
  while ((m = keyword.exec(text)) !== null) {
    const center = m.index;
    const start = Math.max(0, center - 50);
    const end = Math.min(text.length, center + 50);
    const windowText = text.slice(start, end);
    digit12.lastIndex = 0;
    if (digit12.test(windowText)) return true;
  }
  return false;
}

// 互換: 正規表現配列/マップを定義から派生
const secretPatterns = secretDefinitions.map(d => d.pattern);
const secretPatternMap = secretDefinitions;

/**
 * テキストにシークレットが含まれているかチェック
 */
export function containsSecret(text: string): boolean {
  // 通常のパターンマッチング
  if (secretPatterns.some(pattern => pattern.test(text))) {
    return true;
  }
  
  // クレジットカード番号のLuhn検証
  if (isValidCreditCard(text)) {
    return true;
  }
  // 運転免許証番号（文脈ベース）
  if (hasDriverLicenseWithContext(text)) {
    return true;
  }
  
  return false;
}

/**
 * シークレットの種類を特定
 */
export function detectSecretType(text: string): string[] {
  const detectedTypes: string[] = [];
  
  // パターンマップを使用して検出
  for (const { pattern, label } of secretPatternMap) {
    if (pattern.test(text)) {
      detectedTypes.push(label);
    }
  }
  
  // クレジットカード番号の特別処理
  if (isValidCreditCard(text)) {
    detectedTypes.push('Credit Card');
  }
  // 運転免許証番号の特別処理（文脈）
  if (hasDriverLicenseWithContext(text)) {
    detectedTypes.push('Driver License');
  }
  
  return detectedTypes;
}
