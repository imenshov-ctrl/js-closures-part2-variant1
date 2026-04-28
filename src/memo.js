/**
 * @fileoverview Практична робота 9.2 — Просунуті замикання
 * Варіант 1: Memoization Library
 *
 * Всі кеші зберігаються у приватних замиканнях.
 */

// ═══════════════════════════════════════════════════════════════
//  1. memoize — базова мемоізація
// ═══════════════════════════════════════════════════════════════

/**
 * Базова мемоізація: кешує результати за JSON-ключем аргументів.
 *
 * @param {Function} fn — чиста функція
 * @returns {Function} мемоізована версія зі статистикою
 *
 * @example
 * const fib = memoize(n => n <= 1 ? n : fib(n-1) + fib(n-2));
 * fib(40); // миттєво після першого виклику
 */
const memoize = (fn) => {
  // ── приватні змінні замикання ────────────────────────────────
  const cache  = new Map();
  let   hits   = 0;
  let   misses = 0;
  // ────────────────────────────────────────────────────────────

  const memoized = (...args) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      hits++;
      return cache.get(key);
    }

    misses++;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  /** @returns {{ hits, misses, size, hitRate }} */
  memoized.stats   = () => ({
    hits, misses,
    size: cache.size,
    hitRate: hits + misses === 0
      ? '0%'
      : (hits / (hits + misses) * 100).toFixed(1) + '%',
  });

  memoized.clear   = () => { cache.clear(); hits = misses = 0; };
  memoized.has     = (...args) => cache.has(JSON.stringify(args));

  return memoized;
};

// ═══════════════════════════════════════════════════════════════
//  2. memoizeWith — кастомна функція для ключа
// ═══════════════════════════════════════════════════════════════

/**
 * Мемоізація з кастомним генератором ключа.
 * Корисно для об'єктів, де JSON.stringify занадто повільний
 * або коли потрібна часткова ідентичність аргументів.
 *
 * @param {Function} fn     — функція для мемоізації
 * @param {Function} keyFn  — (...args) => string | number
 * @returns {Function}
 *
 * @example
 * // Кешувати лише за першим аргументом
 * const fn = memoizeWith(process, (a) => a.id);
 *
 * // Кешувати пару (x, y)
 * const dist = memoizeWith(distance, (x, y) => `${x}:${y}`);
 */
const memoizeWith = (fn, keyFn) => {
  // ── приватні змінні замикання ────────────────────────────────
  const cache  = new Map();
  let   hits   = 0;
  let   misses = 0;
  // ────────────────────────────────────────────────────────────

  const memoized = (...args) => {
    const key = keyFn(...args);

    if (cache.has(key)) {
      hits++;
      return cache.get(key);
    }

    misses++;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  memoized.stats = () => ({ hits, misses, size: cache.size });
  memoized.clear = () => { cache.clear(); hits = misses = 0; };

  return memoized;
};

// ═══════════════════════════════════════════════════════════════
//  3. memoizeAsync — для async функцій
// ═══════════════════════════════════════════════════════════════

/**
 * Мемоізація async функцій.
 * Кешує Promise — паралельні виклики з тим самим ключем
 * отримують один і той самий Promise, а не запускають функцію двічі.
 *
 * @param {Function} asyncFn — async функція
 * @param {Function} [keyFn] — генератор ключа
 * @returns {Function} async мемоізована функція
 *
 * @example
 * const fetchUser = memoizeAsync(async (id) => {
 *   const res = await fetch(`/api/users/${id}`);
 *   return res.json();
 * });
 * await fetchUser(1); // запит
 * await fetchUser(1); // кеш (той самий Promise)
 */
const memoizeAsync = (asyncFn, keyFn = (...a) => JSON.stringify(a)) => {
  // ── приватні змінні замикання ────────────────────────────────
  const cache      = new Map(); // key → Promise
  const results    = new Map(); // key → resolved value
  let   hits       = 0;
  let   misses     = 0;
  let   pending    = 0;
  // ────────────────────────────────────────────────────────────

  const memoized = async (...args) => {
    const key = keyFn(...args);

    // Вже є готовий результат
    if (results.has(key)) {
      hits++;
      return results.get(key);
    }

    // Вже виконується — повертаємо той самий Promise
    if (cache.has(key)) {
      hits++;
      return cache.get(key);
    }

    misses++;
    pending++;

    const promise = asyncFn(...args).then(value => {
      results.set(key, value);
      cache.delete(key); // Promise більше не потрібен
      pending--;
      return value;
    }).catch(err => {
      cache.delete(key); // при помилці — не кешуємо
      pending--;
      throw err;
    });

    cache.set(key, promise);
    return promise;
  };

  memoized.stats   = () => ({ hits, misses, pending, cached: results.size });
  memoized.clear   = () => { cache.clear(); results.clear(); hits = misses = pending = 0; };

  return memoized;
};

// ═══════════════════════════════════════════════════════════════
//  4. memoizeExpiring — з TTL (Time To Live)
// ═══════════════════════════════════════════════════════════════

/**
 * Мемоізація з часом життя кешу. Прострочені записи
 * автоматично видаляються при наступному зверненні.
 *
 * @param {Function} fn    — функція для мемоізації
 * @param {number}   ttlMs — час життя запису в мс
 * @param {Function} [keyFn]
 * @returns {Function}
 *
 * @example
 * const getRate = memoizeExpiring(fetchExchangeRate, 60_000); // 1 хвилина
 */
const memoizeExpiring = (fn, ttlMs, keyFn = (...a) => JSON.stringify(a)) => {
  // ── приватні змінні замикання ────────────────────────────────
  // Map<key, { value, expiresAt }>
  const cache  = new Map();
  let   hits   = 0;
  let   misses = 0;
  let   evictions = 0;
  // ────────────────────────────────────────────────────────────

  const memoized = (...args) => {
    const key   = keyFn(...args);
    const now   = Date.now();
    const entry = cache.get(key);

    if (entry) {
      if (entry.expiresAt > now) {
        hits++;
        return entry.value;
      }
      // прострочено — видаляємо
      cache.delete(key);
      evictions++;
    }

    misses++;
    const value = fn(...args);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  };

  /** Видалити всі прострочені записи */
  memoized.prune = () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) { cache.delete(key); evictions++; }
    }
    return cache.size;
  };

  memoized.stats = () => ({ hits, misses, evictions, size: cache.size, ttlMs });
  memoized.clear = () => { cache.clear(); hits = misses = evictions = 0; };

  return memoized;
};

// ═══════════════════════════════════════════════════════════════
//  5. memoizeLRU — LRU-кеш з обмеженням розміру
// ═══════════════════════════════════════════════════════════════

/**
 * LRU (Least Recently Used) мемоізація.
 * При досягненні maxSize витісняє найстаріший невикористаний запис.
 *
 * @param {Function} fn      — функція для мемоізації
 * @param {number}   maxSize — максимальна кількість записів у кеші
 * @param {Function} [keyFn]
 * @returns {Function}
 *
 * @example
 * const cached = memoizeLRU(heavyCompute, 100);
 */
const memoizeLRU = (fn, maxSize = 50, keyFn = (...a) => JSON.stringify(a)) => {
  if (maxSize < 1) throw new RangeError('maxSize має бути >= 1');

  // ── приватні змінні замикання ────────────────────────────────
  // Map зберігає порядок вставки; ми використовуємо delete+re-set
  // для переміщення запису у кінець (= найновіший)
  const cache      = new Map();
  let   hits       = 0;
  let   misses     = 0;
  let   evictions  = 0;
  // ────────────────────────────────────────────────────────────

  const memoized = (...args) => {
    const key = keyFn(...args);

    if (cache.has(key)) {
      hits++;
      // Перемістити у кінець (найновіший)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    misses++;

    // Витіснення найстарішого (перший ключ Map)
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      evictions++;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  memoized.stats     = () => ({ hits, misses, evictions, size: cache.size, maxSize });
  memoized.clear     = () => { cache.clear(); hits = misses = evictions = 0; };
  memoized.getCache  = () => new Map(cache); // захисна копія

  return memoized;
};

// ═══════════════════════════════════════════════════════════════
//  Benchmark utility
// ═══════════════════════════════════════════════════════════════

/**
 * Порівняльний benchmark двох функцій.
 *
 * @param {string}   label — назва тесту
 * @param {Function} fnA   — перша функція
 * @param {Function} fnB   — друга функція
 * @param {...*}     args  — аргументи
 * @returns {{ label, a: { timeMs, result }, b: { timeMs, result }, speedup }}
 */
const compareBenchmark = (label, fnA, fnB, ...args) => {
  const run = (fn) => {
    const t0 = performance.now();
    const result = fn(...args);
    return { timeMs: performance.now() - t0, result };
  };
  const a = run(fnA);
  const b = run(fnB);
  const speedup = (a.timeMs / Math.max(b.timeMs, 0.0001)).toFixed(0);
  return { label, a, b, speedup: `×${speedup}` };
};

export {
  memoize,
  memoizeWith,
  memoizeAsync,
  memoizeExpiring,
  memoizeLRU,
  compareBenchmark,
};
