# Memoize.js — Memoization Library

> Практична робота 9.2 · Варіант 1 · Просунуті замикання

## Опис

Бібліотека мемоізації з п'ятьма стратегіями кешування. Всі кеші зберігаються у приватних змінних замикання — `Map`, лічильники hits/misses, TTL-записи недоступні ззовні.

## Запуск

```bash
start index.html   # Windows
open index.html    # macOS
```

---

## API Reference

### 1. `memoize(fn)` — базова мемоізація

```js
import { memoize } from './src/memo.js';

const fib = memoize(n => n <= 1 ? n : fib(n-1) + fib(n-2));

fib(40); // ~1500 ms без мемо → ~0.1 ms з мемо
fib(40); // ~0.001 ms (cache hit)

fib.stats();
// → { hits: 1, misses: 41, size: 41, hitRate: '2.4%' }

fib.clear(); // очистити кеш і статистику
fib.has(40); // → false (після clear)
```

---

### 2. `memoizeWith(fn, keyFn)` — кастомний ключ

```js
import { memoizeWith } from './src/memo.js';

// Кешувати тільки за userId, ігнорувати timestamp
const process = memoizeWith(
  (userId, timestamp) => fetchUser(userId),
  (userId) => userId   // ← ключ тільки за userId
);

process(42, Date.now());       // miss — виклик функції
process(42, Date.now() + 999); // hit  — інший ts, але ключ той самий
process(99, Date.now());       // miss — інший userId

process.stats(); // → { hits: 1, misses: 2, size: 2 }
```

---

### 3. `memoizeAsync(asyncFn)` — async функції

```js
import { memoizeAsync } from './src/memo.js';

const fetchUser = memoizeAsync(async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// Паралельні виклики — функція виконається лише ОДИН раз
const [a, b, c] = await Promise.all([
  fetchUser(1),
  fetchUser(1), // ← той самий Promise, не новий запит
  fetchUser(1), // ← той самий Promise
]);

fetchUser.stats();
// → { hits: 2, misses: 1, pending: 0, cached: 1 }
```

---

### 4. `memoizeExpiring(fn, ttlMs)` — TTL кеш

```js
import { memoizeExpiring } from './src/memo.js';

const getRate = memoizeExpiring(fetchExchangeRate, 60_000); // 1 хвилина

getRate('USD'); // miss → реальний виклик
getRate('USD'); // hit  → з кешу
// через 60 сек:
getRate('USD'); // miss → прострочено, новий виклик

getRate.stats();
// → { hits: 1, misses: 2, evictions: 1, size: 1, ttlMs: 60000 }

getRate.prune(); // видалити всі прострочені записи вручну
```

---

### 5. `memoizeLRU(fn, maxSize)` — LRU обмеження розміру

```js
import { memoizeLRU } from './src/memo.js';

const cached = memoizeLRU(n => n * n, 3); // максимум 3 записи

cached(1); // miss → { 1 }
cached(2); // miss → { 1, 2 }
cached(3); // miss → { 1, 2, 3 }
cached(4); // miss → { 2, 3, 4 }  ← 1 витіснено (LRU)
cached(2); // hit  → { 3, 4, 2 }  ← 2 переміщено у кінець
cached(5); // miss → { 4, 2, 5 }  ← 3 витіснено (LRU)

cached.stats();
// → { hits: 1, misses: 5, evictions: 2, size: 3, maxSize: 3 }
```

---

## Benchmark: fibonacci(40)

| Варіант | Час |
|---------|-----|
| Без мемоізації | ~1000–3000 ms |
| `memoize` (перший виклик) | ~0.1 ms |
| `memoize` (cache hit) | ~0.001 ms |
| Прискорення | ×10 000+ |

---

## Порівняння стратегій

| Функція | Ключ | TTL | Розмір | Async |
|---------|------|-----|--------|-------|
| `memoize` | JSON args | ✗ | необмежений | ✗ |
| `memoizeWith` | кастомний | ✗ | необмежений | ✗ |
| `memoizeAsync` | JSON args | ✗ | необмежений | ✅ |
| `memoizeExpiring` | JSON args | ✅ | необмежений | ✗ |
| `memoizeLRU` | JSON args | ✗ | обмежений | ✗ |

---

## Demo відео

> https://github.com/imenshov-ctrl/js-closures-part2-variant1/blob/main/Memoization%20Library%20%E2%80%94%20Demo%20-%20Google%20Chrome%202026-04-28%2020-01-08.mp4

---

## Критерії оцінювання

| Критерій | Бали | Статус |
|----------|------|--------|
| Реалізація просунутих паттернів | 3 | ✅ 5 стратегій мемоізації |
| Оптимізація та продуктивність | 2.5 | ✅ LRU, TTL eviction, Promise dedup |
| Функціональність | 2 | ✅ stats, clear, has, prune |
| Тестування та benchmark | 1.5 | ✅ fib(40) benchmark, async dedup |
| README з аналізом | 0.5 | ✅ |
| Demo відео | 0.5 | ⬜ |
| **Всього** | **10** | |
