# Ripple

[![CI](https://github.com/QualiMeter/Ripple/actions/workflows/ci.yml/badge.svg)](https://github.com/QualiMeter/Ripple/actions/workflows/ci.yml)

**Система анализа последствий изменений проектного плана.**

Ripple помогает менеджеру увидеть, как изменение одной задачи распространяется по зависимостям проекта, влияет на последующие работы, риски и срок проекта. Это не ещё один task tracker: основной результат работы Ripple — объяснимая цепочка последствий и безопасное действие с ней.

```text
Изменение задачи
        ↓
Анализ зависимостей
        ↓
Затронутые задачи
        ↓
Риски и конфликты сроков
        ↓
Preview решения
        ↓
Применение или выборочный откат
```

## Что реализовано

- создание, редактирование и удаление проектов;
- задачи, проектные сотрудники и назначение ответственных;
- finish-to-start зависимости с защитой от циклов;
- timeline, интерактивный граф зависимостей и адаптивный интерфейс;
- редактирование сроков, статусов и ответственных;
- текущие конфликты проекта и анализ затронутых downstream-задач;
- вычисляемые критические задачи и календарный запас (`slack`);
- просроченные задачи, ограничения старта и фильтры плана;
- preview каскадного автоматического сдвига с отдельным подтверждением;
- серверная история, выборочный Undo и realtime-синхронизация через SignalR;
- защита формы задачи от перезаписи изменений из другой вкладки;
- mock-режим для автономной frontend-разработки.

Правило зависимости в MVP: если задача-предшественник завершается в день **D**, зависимая задача может начаться не раньше **D + 1 календарного дня**.

## Контр-фича — история изменений и выборочный откат

Backend хранит историю проекта, а пользователь выбирает конкретное изменение для отката. `POST` selective Undo выполняется на backend транзакционно: frontend не имитирует восстановление серией обратных CRUD-запросов. После операции затронутые задачи, зависимости, сотрудники и проект синхронизируются через SignalR.

Повторный Undo защищён синхронным single-flight guard и проверкой актуального состояния записи. Ответы `404` и `409` обновляют серверную историю и показываются пользователю без ложного повторного действия.

Так Ripple позволяет не только оценить последствия решения, но и безопасно вернуться к состоянию до выбранного изменения.

## Архитектура

```text
React UI
   ↓
services / typed API layer
   ↓
REST API  ← source of truth
   ↕
SignalR realtime
   ↓
ASP.NET Core
```

REST используется для начальной загрузки и подтверждения изменяющих запросов. SignalR доставляет дельта-обновления между вкладками и клиентами; после reconnect выполняется одна полная синхронизация открытого проекта. В mock-режиме те же UI/service abstractions работают с локальными данными и расчётами.

Подробнее: [архитектура](docs/ARCHITECTURE.md) и [API-контракты](docs/API_CONTRACTS.md).

## Технологии

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, официальный SignalR client, Vitest.

**Backend:** ASP.NET Core, REST API, SignalR. Публичный API: `https://92.63.102.15`, интерактивная документация: [Scalar](https://92.63.102.15/scalar).

## Быстрый старт

Требуются Node.js `20.19+` и npm.

```bash
git clone https://github.com/QualiMeter/Ripple.git
cd Ripple
npm install
cp .env.example .env
npm run dev
```

HTTP-режим с backend:

```dotenv
VITE_API_MODE=http
VITE_API_URL=https://92.63.102.15/api
```

Автономный mock-режим:

```dotenv
VITE_API_MODE=mock
```

Проверки проекта:

```bash
npm test
npm run typecheck
npm run build
```

## Автоматический deploy

Workflow `.github/workflows/deploy.yml` запускается после push в `main` или вручную через GitHub Actions. Перед отправкой содержимого `dist/` он выполняет тесты, проверку TypeScript и production build в HTTP-режиме.

Для workflow нужно настроить в GitHub:

**Repository Secrets:**

- `SERVER_SSH_KEY` — приватный SSH-ключ пользователя deploy;
- `SERVER_HOST` — адрес сервера;
- `SERVER_USER` — SSH-пользователь.

**Repository Variables:**

- `VITE_API_URL` — REST API base URL, включая `/api`, например `https://backend.example.com/api`.

SignalR использует тот же backend origin: frontend автоматически исключает завершающий `/api` и подключается к `/hubs/projects`, поэтому отдельная realtime-переменная не требуется.

Frontend публикуется непосредственно в `/var/www/site`. Для прямого открытия client-side маршрутов вроде `/projects/<id>` nginx должен возвращать `index.html`:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Структура

```text
src/
  api/          REST-клиенты, transport DTO и mapping
  components/   пользовательский интерфейс
  pages/        страницы приложения
  realtime/     SignalR lifecycle и применение delta events
  services/     бизнес- и доменная логика
  types/        frontend domain types
  mocks/        данные и API mock-режима

docs/
  API_CONTRACTS.md
  ARCHITECTURE.md
  CASE_REQUIREMENTS.md
  MVP_PLAN.md
  DEMO.md
```

## Демонстрация

Короткий сценарий презентации на 3–5 минут находится в [docs/DEMO.md](docs/DEMO.md).

## Ограничения MVP

- аутентификация и роли доступа не входят в текущую версию;
- рабочие календари, выходные и праздники не учитываются — расчёты идут в календарных днях;
- подробность отображения server history ограничена полями, которые возвращает backend DTO.
